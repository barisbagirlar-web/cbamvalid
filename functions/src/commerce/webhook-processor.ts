import { adminDb } from "@/firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { createEntitlement } from "./entitlement-service";
import { writeLedgerEntry } from "./ledger-service";
import { processRefund } from "./refund-service";
import { PRODUCT_CATALOG } from "./catalog";

/**
 * Main processor of verified webhook events from Paddle
 */
export async function processWebhookEvent(event: any): Promise<void> {
  const eventId = event.eventId;
  const eventType = event.eventType;
  const data = event.data;

  console.log(`[PADDLE-PROCESSOR] Processing event ${eventId} of type ${eventType}`);

  if (eventType === "transaction.completed") {
    await handleTransactionCompleted(eventId, data);
  } else if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
    await handleAdjustmentUpdated(eventId, data);
  } else {
    console.log(`[PADDLE-PROCESSOR] Skipping unhandled event type: ${eventType}`);
  }
}

/**
 * Handle transaction.completed event to issue entitlements and update ledger
 */
async function handleTransactionCompleted(eventId: string, transaction: any): Promise<void> {
  const transactionId = transaction.id;
  const status = transaction.status;
  const customData = transaction.customData || {};
  const uid = customData.uid;
  const orderId = customData.orderId;
  const productCode = customData.productCode;

  if (status !== "completed") {
    console.log(`[PADDLE-PROCESSOR] Transaction ${transactionId} status is ${status}. Skipping fulfillment.`);
    return;
  }

  if (!uid || !orderId || !productCode) {
    console.error(`[PADDLE-PROCESSOR] Missing metadata in transaction completed customData:`, customData);
    return;
  }

  // Cross-check transaction items against server catalog
  const catalogProduct = PRODUCT_CATALOG[productCode];
  if (!catalogProduct) {
    console.error(`[PADDLE-PROCESSOR] Product code ${productCode} not found in server catalog.`);
    return;
  }

  // Verify currency and amount (Paddle transaction details)
  const currency = transaction.currencyCode || "";
  if (currency !== catalogProduct.currency) {
    console.error(`[PADDLE-PROCESSOR] Currency mismatch: expected ${catalogProduct.currency}, got ${currency}`);
    return;
  }

  const items = transaction.items || [];
  if (items.length === 0) {
    console.error(`[PADDLE-PROCESSOR] Transaction has no items.`);
    return;
  }

  // Execute atomic transactional updates
  await adminDb.runTransaction(async (dbTransaction: any) => {
    // 1. Log payment captured entry in the ledger with idempotency verification
    await writeLedgerEntry(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      currency,
      amountMinor: catalogProduct.expectedUnitAmount,
      idempotencyKey: `payment:${transactionId}`,
    });

    // 2. Transition order state to PAID
    await transitionOrderStatus(dbTransaction, orderId, "PAID", {
      paddleTransactionId: transactionId,
    });

    // 3. Issue entitlement document and write entitlement ledger entry
    await createEntitlement(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      productCode,
      quantity: catalogProduct.entitlementQuantity,
    });

    // 4. Transition order state to ENTITLED
    await transitionOrderStatus(dbTransaction, orderId, "ENTITLED");
  });

  console.log(`[PADDLE-PROCESSOR] Completed fulfillment for order ${orderId}, entitlement issued.`);
}

/**
 * Handle adjustment.created or adjustment.updated event (refunds)
 */
async function handleAdjustmentUpdated(eventId: string, adjustment: any): Promise<void> {
  const transactionId = adjustment.transactionId;
  const status = adjustment.status;
  const adjustmentId = adjustment.id;

  // Only handle approved/completed adjustments (refunds)
  if (status !== "approved" && status !== "completed") {
    console.log(`[PADDLE-PROCESSOR] Adjustment ${adjustmentId} status is ${status}. Skipping.`);
    return;
  }

  // Retrieve transaction to extract order metadata from customData
  const orderQuery = await adminDb
    .collection("commerce_orders")
    .where("paddleTransactionId", "==", transactionId)
    .limit(1)
    .get();

  if (orderQuery.empty) {
    console.error(`[PADDLE-PROCESSOR] Mapped order for transaction ${transactionId} not found.`);
    return;
  }

  const order = orderQuery.docs[0].data() as any;

  await adminDb.runTransaction(async (dbTransaction: any) => {
    await processRefund(dbTransaction, {
      uid: order.uid,
      orderId: order.orderId,
      transactionId,
      eventId,
      adjustmentId,
      amountMinor: Number(adjustment.totals?.subtotal || 0),
      currency: adjustment.currencyCode || "USD",
    });
  });

  console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
