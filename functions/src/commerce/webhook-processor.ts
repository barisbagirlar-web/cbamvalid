import type { firestore } from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus, type CommerceOrder } from "./order-service";
import { createEntitlement, entitlementIdForOrder, type Entitlement } from "./entitlement-service";
import { ledgerEntryId, writeLedgerEntry, type LedgerEntry } from "./ledger-service";
import { processRefund } from "./refund-service";
import { PRODUCT_CATALOG } from "./catalog";
import { CASE_COMMERCIAL_SERVER } from "./case-commercial-contract";

type PaddleWebhookEvent = {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
};

type PaddleTransactionItem = {
  quantity?: number;
  priceId?: string;
  price?: { id?: string };
};

type PaddleTransactionPayload = {
  id?: string;
  status?: string;
  currencyCode?: string;
  customData?: Record<string, unknown>;
  items?: PaddleTransactionItem[];
  details?: { totals?: { grandTotal?: number | string } };
  totals?: { grandTotal?: number | string };
};

type CommerceOrderRecord = {
  uid: string;
  caseId?: string;
  canonicalProductCode?: string;
  paddlePriceId?: string;
  currency?: string;
  amountMinor?: number;
};

type PaddleAdjustmentPayload = {
  id?: string;
  status?: string;
  transactionId?: string;
  currencyCode?: string;
  totals?: { subtotal?: number | string };
};

/**
 * Main processor of verified webhook events from Paddle
 */
export async function processWebhookEvent(event: PaddleWebhookEvent): Promise<void> {
  const eventId = event.eventId;
  const eventType = event.eventType;
  const data = event.data;

  console.log(`[PADDLE-PROCESSOR] Processing event ${eventId} of type ${eventType}`);

  if (eventType === "transaction.completed") {
    await handleTransactionCompleted(eventId, data as PaddleTransactionPayload);
  } else if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
    await handleAdjustmentUpdated(eventId, data as PaddleAdjustmentPayload);
  } else {
    console.log(`[PADDLE-PROCESSOR] Skipping unhandled event type: ${eventType}`);
  }
}

/**
 * Handle transaction.completed event to issue entitlements and update ledger
 */
async function handleTransactionCompleted(
  eventId: string,
  transaction: PaddleTransactionPayload
): Promise<void> {
  const transactionId = transaction.id;
  const status = transaction.status;
  const customData = transaction.customData || {};
  const orderId = typeof customData.orderId === "string" ? customData.orderId : undefined;

  if (!transactionId) {
    throw new Error("TRANSACTION_ID_REQUIRED");
  }

  if (status !== "completed") {
    throw new Error(`TRANSACTION_NOT_COMPLETED:${status || "missing"}`);
  }

  if (!orderId) {
    throw new Error("ORDER_ID_REQUIRED");
  }

  // Load the order server-side
  const orderDoc = await adminDb.collection("commerce_orders").doc(orderId).get();
  if (!orderDoc.exists) {
    throw new Error(`ORDER_NOT_FOUND:${orderId}`);
  }
  const order = orderDoc.data() as CommerceOrderRecord;

  const productCode = order.canonicalProductCode || "pack_premium_dossier_v5";
  const catalogProduct = PRODUCT_CATALOG[productCode];
  if (!catalogProduct) {
    throw new Error(`PRODUCT_NOT_FOUND:${productCode}`);
  }

  // Verify Paddle price ID
  const priceId = order.paddlePriceId;
  const items = transaction.items || [];
  if (items.length === 0) {
    throw new Error("TRANSACTION_HAS_NO_ITEMS");
  }

  const matchesPrice = items.some((item) => {
    const itemPriceId = item.priceId || item.price?.id || "";
    return itemPriceId === priceId;
  });

  if (!matchesPrice) {
    throw new Error(`PRICE_ID_MISMATCH:${priceId || "missing"}`);
  }

  // Verify currency
  const currency = transaction.currencyCode || "";
  if (currency !== order.currency) {
    throw new Error(`CURRENCY_MISMATCH:${order.currency || "missing"}:${currency || "missing"}`);
  }

  // Verify amount
  const rawTransactionAmount =
    transaction.details?.totals?.grandTotal ?? transaction.totals?.grandTotal;
  const transactionAmount = Number(rawTransactionAmount);
  if (
    rawTransactionAmount === undefined ||
    !Number.isFinite(transactionAmount) ||
    !Number.isInteger(transactionAmount) ||
    transactionAmount !== order.amountMinor
  ) {
    throw new Error(`AMOUNT_MISMATCH:${order.amountMinor}:${String(rawTransactionAmount)}`);
  }

  // Verify quantity
  const purchasedQuantity = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
  if (purchasedQuantity !== 1) {
    throw new Error(`QUANTITY_MISMATCH:1:${purchasedQuantity}`);
  }

  const uid = order.uid;
  const totalEntitlementsToGrant = catalogProduct.entitlementQuantity * purchasedQuantity;
  const scopeCaseId =
    typeof order.caseId === "string" && order.caseId.trim() ? order.caseId.trim() : "";
  if (!scopeCaseId) {
    throw new Error("CASE_ID_REQUIRED_FOR_FULFILLMENT");
  }

  // Execute atomic transactional updates
  await adminDb.runTransaction(async (dbTransaction: firestore.Transaction) => {
    const orderRef = adminDb.collection("commerce_orders").doc(orderId);
    const paymentKey = `payment:${transactionId}`;
    const entitlementKey = `entitlement:${transactionId}:${productCode}`;
    const entitlementId = entitlementIdForOrder(orderId, productCode);
    const paymentRef = adminDb.collection("commerce_ledger").doc(ledgerEntryId(paymentKey));
    const entitlementLedgerRef = adminDb.collection("commerce_ledger").doc(ledgerEntryId(entitlementKey));
    const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);
    const latestLedgerQuery = adminDb.collection("commerce_ledger").orderBy("createdAt", "desc").limit(1);
    const [freshOrderSnap, paymentSnap, entitlementLedgerSnap, entitlementSnap, latestLedgerSnap] =
      await Promise.all([
        dbTransaction.get(orderRef),
        dbTransaction.get(paymentRef),
        dbTransaction.get(entitlementLedgerRef),
        dbTransaction.get(entitlementRef),
        dbTransaction.get(latestLedgerQuery),
      ]);
    if (!freshOrderSnap.exists) throw new Error(`ORDER_NOT_FOUND:${orderId}`);
    const freshOrder = freshOrderSnap.data() as CommerceOrder;
    if (freshOrder.uid !== uid || freshOrder.caseId !== scopeCaseId) {
      throw new Error("ORDER_SCOPE_CHANGED_DURING_FULFILLMENT");
    }
    const previousEntryHash = latestLedgerSnap.empty
      ? ""
      : String((latestLedgerSnap.docs[0].data() as LedgerEntry).entryHash || "");

    // 1. Log payment captured entry in the ledger with idempotency verification
    const paymentEntry = await writeLedgerEntry(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: purchasedQuantity,
      currency,
      amountMinor: order.amountMinor,
      idempotencyKey: paymentKey,
    }, {
      existingEntry: paymentSnap.exists ? paymentSnap.data() as LedgerEntry : null,
      previousEntryHash,
    });

    // 2. Issue exactly one deterministic entitlement for this order.
    await createEntitlement(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      productCode,
      quantity: totalEntitlementsToGrant,
      scopeCaseId,
      billingModel: "CASE_PAY_AT_LOCK",
      maxReleases: CASE_COMMERCIAL_SERVER.maxReleasesPerPaidCase,
    }, {
      existingEntitlement: entitlementSnap.exists
        ? { entitlementId: entitlementSnap.id, ...entitlementSnap.data() } as Entitlement
        : null,
      existingLedgerEntry: entitlementLedgerSnap.exists
        ? entitlementLedgerSnap.data() as LedgerEntry
        : null,
      previousEntryHash: paymentEntry.entryHash,
    });

    const caseRef = adminDb.collection("cbam_cases").doc(scopeCaseId);
    dbTransaction.set(
      caseRef,
      {
        commercial: {
          status: "PAID",
          billingModel: "CASE_PAY_AT_LOCK",
          orderId,
          paddleTransactionId: transactionId,
          paidAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 3. Publish ENTITLED only after the entitlement write is queued.
    await transitionOrderStatus(
      dbTransaction,
      orderId,
      "ENTITLED",
      { paddleTransactionId: transactionId },
      freshOrder
    );
  });

  // 5. Exactly-once purchase analytics (persistent Firestore idempotency; outside
  // commerce txn so analytics failure cannot roll back entitlement).
  try {
    const { emitVerifiedPurchaseAnalytics } = await import("./seo-purchase-analytics");
    const analytics = await emitVerifiedPurchaseAnalytics({
      transactionId,
      eventId,
      valueMinor: order.amountMinor,
      currency,
    });
    console.log(
      `[PADDLE-PROCESSOR] Purchase analytics ${analytics.status} delta=${analytics.emissionDelta} for ${transactionId}`,
    );
  } catch (analyticsError) {
    console.error(
      `[PADDLE-PROCESSOR] Purchase analytics failed (non-fatal) for ${transactionId}:`,
      analyticsError,
    );
  }

  console.log(`[PADDLE-PROCESSOR] Completed fulfillment for order ${orderId}, entitlement issued.`);
}

/**
 * Handle adjustment.created or adjustment.updated event (refunds)
 */
async function handleAdjustmentUpdated(eventId: string, adjustment: PaddleAdjustmentPayload): Promise<void> {
  const transactionId = adjustment.transactionId;
  const status = adjustment.status;
  const adjustmentId = adjustment.id;

  // Only handle approved/completed adjustments (refunds)
  if (status !== "approved" && status !== "completed") {
    console.log(`[PADDLE-PROCESSOR] Adjustment ${adjustmentId} status is ${status}. Skipping.`);
    return;
  }

  if (!transactionId) {
    throw new Error(`ADJUSTMENT_TRANSACTION_ID_REQUIRED:${adjustmentId || eventId}`);
  }

  const orderQuery = await adminDb
    .collection("commerce_orders")
    .where("paddleTransactionId", "==", transactionId)
    .limit(1)
    .get();

  if (orderQuery.empty) {
    throw new Error(`REFUND_ORDER_NOT_FOUND:${transactionId}`);
  }

  const order = orderQuery.docs[0].data() as CommerceOrderRecord & { orderId: string };

  await adminDb.runTransaction(async (dbTransaction: firestore.Transaction) => {
    await processRefund(dbTransaction, {
      uid: order.uid,
      orderId: order.orderId,
      transactionId,
      eventId,
      adjustmentId: adjustmentId || eventId,
      amountMinor: Number(adjustment.totals?.subtotal || 0),
      currency: adjustment.currencyCode || "USD",
    });
  });

  console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
