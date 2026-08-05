import type { firestore } from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { createEntitlement } from "./entitlement-service";
import { writeLedgerEntry } from "./ledger-service";
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
 * Paddle notification entities expose money as major-unit strings ("449.00"),
 * while our order records store minor units (44900). Normalize either form to
 * minor units so fulfillment amount checks match.
 */
function toMinorUnits(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (typeof value === "string" && value.includes(".")) {
    return Math.round(numeric * 100);
  }
  return Math.round(numeric);
}

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
    console.error(`[PADDLE-PROCESSOR] Missing transaction id on completed event.`);
    return;
  }

  if (status !== "completed") {
    console.log(`[PADDLE-PROCESSOR] Transaction ${transactionId} status is ${status}. Skipping fulfillment.`);
    return;
  }

  if (!orderId) {
    console.error(`[PADDLE-PROCESSOR] Missing orderId in transaction completed customData:`, customData);
    return;
  }

  // Load the order server-side
  const orderDoc = await adminDb.collection("commerce_orders").doc(orderId).get();
  if (!orderDoc.exists) {
    console.error(`[PADDLE-PROCESSOR] Order ${orderId} not found in database.`);
    return;
  }
  const order = orderDoc.data() as CommerceOrderRecord;

  const productCode = order.canonicalProductCode || "pack_premium_dossier_v5";
  const catalogProduct = PRODUCT_CATALOG[productCode];
  if (!catalogProduct) {
    console.error(`[PADDLE-PROCESSOR] Product code ${productCode} not found in server catalog.`);
    return;
  }

  // Verify Paddle price ID
  const priceId = order.paddlePriceId;
  const items = transaction.items || [];
  if (items.length === 0) {
    console.error(`[PADDLE-PROCESSOR] Transaction has no items.`);
    return;
  }

  const matchesPrice = items.some((item) => {
    const itemPriceId = item.priceId || item.price?.id || "";
    return itemPriceId === priceId;
  });

  if (!matchesPrice) {
    console.error(`[PADDLE-PROCESSOR] Price ID mismatch. Expected ${priceId}, items:`, items);
    return;
  }

  // Verify currency
  const currency = transaction.currencyCode || "";
  if (currency !== order.currency) {
    console.error(`[PADDLE-PROCESSOR] Currency mismatch: expected ${order.currency}, got ${currency}`);
    return;
  }

  // Verify amount
  const transactionAmount = toMinorUnits(
    transaction.details?.totals?.grandTotal ?? transaction.totals?.grandTotal
  );
  if (transactionAmount !== order.amountMinor) {
    console.error(`[PADDLE-PROCESSOR] Amount mismatch: expected ${order.amountMinor}, got ${transactionAmount}`);
    return;
  }

  // Verify quantity
  const purchasedQuantity = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
  if (purchasedQuantity !== 1) {
    console.error(`[PADDLE-PROCESSOR] Quantity mismatch: expected 1, got ${purchasedQuantity}`);
    return;
  }

  const uid = order.uid;
  const totalEntitlementsToGrant = catalogProduct.entitlementQuantity * purchasedQuantity;

  // Execute atomic transactional updates.
  // Firestore requires ALL reads to precede ALL writes inside a transaction
  // (reads after writes throw FAILED_PRECONDITION). Every document/query we
  // need is therefore fetched up front, then writes run against prefetched data.
  await adminDb.runTransaction(async (dbTransaction: firestore.Transaction) => {
    const ledgerCollection = adminDb.collection("commerce_ledger");
    const orderRef = adminDb.collection("commerce_orders").doc(orderId);

    // ---- READ PHASE (all reads before any write) ----
    const existingPaymentQuery = await dbTransaction.get(
      ledgerCollection.where("idempotencyKey", "==", `payment:${transactionId}`).limit(1)
    );
    const existingPaymentEntry = existingPaymentQuery.empty
      ? null
      : (existingPaymentQuery.docs[0].data() as {
          entryHash: string;
          idempotencyKey: string;
        });

    const latestLedgerQuery = await dbTransaction.get(
      ledgerCollection.orderBy("createdAt", "desc").limit(1)
    );
    const previousEntryHash = latestLedgerQuery.empty
      ? ""
      : (latestLedgerQuery.docs[0].data() as { entryHash: string }).entryHash;

    const orderSnapshot = await dbTransaction.get(orderRef);

    const existingEntitlementQuery = await dbTransaction.get(
      ledgerCollection
        .where("idempotencyKey", "==", `entitlement:${transactionId}:${productCode}`)
        .limit(1)
    );
    const existingEntitlementEntry = existingEntitlementQuery.empty
      ? null
      : (existingEntitlementQuery.docs[0].data() as { entryHash: string });

    // ---- WRITE PHASE (writes only; no reads after this point) ----
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
      idempotencyKey: `payment:${transactionId}`,
    }, {
      existingEntry: existingPaymentEntry as never,
      previousEntryHash,
    });

    // 2. Transition order state to PAID
    await transitionOrderStatus(dbTransaction, orderId, "PAID", {
      paddleTransactionId: transactionId,
    }, orderSnapshot);

    // 3. Issue entitlement document and write entitlement ledger entry
    const scopeCaseId = typeof order.caseId === "string" && order.caseId.trim() ? order.caseId.trim() : undefined;
    if (!scopeCaseId) {
      throw new Error("CASE_ID_REQUIRED_FOR_FULFILLMENT");
    }

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
      existingEntry: existingEntitlementEntry as never,
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

    // 4. Transition order state to ENTITLED
    await transitionOrderStatus(dbTransaction, orderId, "ENTITLED", undefined, orderSnapshot);
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
    console.error(`[PADDLE-PROCESSOR] Adjustment ${adjustmentId} missing transactionId.`);
    return;
  }

  const orderQuery = await adminDb
    .collection("commerce_orders")
    .where("paddleTransactionId", "==", transactionId)
    .limit(1)
    .get();

  if (orderQuery.empty) {
    console.error(`[PADDLE-PROCESSOR] Mapped order for transaction ${transactionId} not found.`);
    return;
  }

  const order = orderQuery.docs[0].data() as CommerceOrderRecord & { orderId: string };

  await adminDb.runTransaction(async (dbTransaction: firestore.Transaction) => {
    await processRefund(dbTransaction, {
      uid: order.uid,
      orderId: order.orderId,
      transactionId,
      eventId,
      adjustmentId: adjustmentId || eventId,
      amountMinor: toMinorUnits(adjustment.totals?.subtotal),
      currency: adjustment.currencyCode || "USD",
    });
  });

  console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
