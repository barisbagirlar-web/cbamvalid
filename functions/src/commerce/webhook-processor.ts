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
  const transactionAmount = Math.round(
    Number(transaction.details?.totals?.grandTotal || transaction.totals?.grandTotal || 0)
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

  // Execute atomic transactional updates
  await adminDb.runTransaction(async (dbTransaction: firestore.Transaction) => {
    // 1. Log payment captured entry in the ledger with idempotency verification
    await writeLedgerEntry(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: purchasedQuantity,
      currency,
      amountMinor: order.amountMinor,
      idempotencyKey: `payment:${transactionId}`,
    });

    // 2. Transition order state to PAID
    await transitionOrderStatus(dbTransaction, orderId, "PAID", {
      paddleTransactionId: transactionId,
    });

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
    await transitionOrderStatus(dbTransaction, orderId, "ENTITLED");
  });

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
      amountMinor: Number(adjustment.totals?.subtotal || 0),
      currency: adjustment.currencyCode || "USD",
    });
  });

  console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
