import { adminDb } from "../firebase-admin";
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
  const orderId = customData.orderId;

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
  const order = orderDoc.data() as any;

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

  const matchesPrice = items.some((item: any) => {
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
  const transactionAmount = Math.round(Number(transaction.details?.totals?.grandTotal || transaction.totals?.grandTotal || 0));
  if (transactionAmount !== order.amountMinor) {
    console.error(`[PADDLE-PROCESSOR] Amount mismatch: expected ${order.amountMinor}, got ${transactionAmount}`);
    return;
  }

  // Verify quantity
  const purchasedQuantity = items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
  if (purchasedQuantity !== 1) {
    console.error(`[PADDLE-PROCESSOR] Quantity mismatch: expected 1, got ${purchasedQuantity}`);
    return;
  }

  const uid = order.uid;
  const totalEntitlementsToGrant = catalogProduct.entitlementQuantity * purchasedQuantity;

  // Execute atomic transactional updates
  await adminDb.runTransaction(async (dbTransaction: any) => {
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
    await createEntitlement(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      productCode,
      quantity: totalEntitlementsToGrant,
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
