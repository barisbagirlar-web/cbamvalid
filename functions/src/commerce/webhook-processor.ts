import { adminDb } from "../firebase-admin";
import { transitionOrderStatus, CommerceOrder } from "./order-service";
import { issuePreparationPack } from "./preparation-pack-service";
import { writeLedgerEntry } from "./ledger-service";
import { processRefund } from "./refund-service";
import { getPriceIdForProduct, PRODUCT_CATALOG } from "./catalog";
import { isSandboxMode } from "./paddle-client";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function transactionAmountMinor(transaction: any): number {
  const raw =
    transaction?.details?.totals?.grandTotal ??
    transaction?.details?.totals?.total ??
    transaction?.totals?.grandTotal ??
    transaction?.totals?.total;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function itemPriceId(item: any): string {
  return asString(item?.price?.id || item?.priceId || item?.price_id);
}

/** Main processor of verified webhook events from Paddle. */
export async function processWebhookEvent(event: any): Promise<void> {
  const eventId = asString(event?.eventId);
  const eventType = asString(event?.eventType);
  const data = event?.data;

  if (!eventId || !eventType || !data) {
    throw new Error("PADDLE_EVENT_SHAPE_INVALID");
  }

  console.log(`[PADDLE-PROCESSOR] Processing event ${eventId} of type ${eventType}`);

  if (eventType === "transaction.completed") {
    await handleTransactionCompleted(eventId, data);
  } else if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
    await handleAdjustmentUpdated(eventId, data);
  } else {
    console.log(`[PADDLE-PROCESSOR] Skipping unhandled event type: ${eventType}`);
  }
}

async function handleTransactionCompleted(eventId: string, transaction: any): Promise<void> {
  const transactionId = asString(transaction?.id);
  const status = asString(transaction?.status);
  const customData = transaction?.customData || {};
  const uid = asString(customData.uid);
  const orderId = asString(customData.orderId);
  const caseId = asString(customData.caseId);
  const productCode = asString(customData.productCode);
  const eventEnvironment = asString(customData.environment);

  if (!transactionId || !uid || !orderId || !caseId || !productCode) {
    throw new Error("PADDLE_TRANSACTION_METADATA_MISSING");
  }
  if (status !== "completed") {
    throw new Error(`PADDLE_TRANSACTION_STATUS_INVALID:${status || "missing"}`);
  }

  const catalogProduct = PRODUCT_CATALOG[productCode];
  if (!catalogProduct || !catalogProduct.active || productCode !== "CBAM_CREDIT_PACK_5") {
    throw new Error("PADDLE_PRODUCT_MAPPING_INVALID");
  }

  const sandbox = isSandboxMode();
  const expectedEnvironment = sandbox ? "sandbox" : "production";
  if (eventEnvironment !== expectedEnvironment) {
    throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
  }

  const currency = asString(transaction?.currencyCode || transaction?.currency_code);
  if (currency !== catalogProduct.currency) {
    throw new Error(`PADDLE_CURRENCY_MISMATCH:${currency || "missing"}`);
  }

  const items = Array.isArray(transaction?.items) ? transaction.items : [];
  const purchasedQuantity = items.reduce(
    (total: number, item: any) => total + Number(item?.quantity || 0),
    0
  );
  if (items.length !== 1 || purchasedQuantity !== 1) {
    throw new Error("PADDLE_ITEM_QUANTITY_INVALID");
  }

  const expectedPriceId = getPriceIdForProduct(productCode, sandbox);
  if (!expectedPriceId || itemPriceId(items[0]) !== expectedPriceId) {
    throw new Error("PADDLE_PRICE_ID_MISMATCH");
  }

  const actualAmountMinor = transactionAmountMinor(transaction);
  if (!Number.isFinite(actualAmountMinor) || actualAmountMinor !== catalogProduct.expectedUnitAmount) {
    throw new Error("PADDLE_AMOUNT_MISMATCH");
  }

  const orderRef = adminDb.collection("commerce_orders").doc(orderId);

  await adminDb.runTransaction(async (dbTransaction: any) => {
    const orderSnapshot = await dbTransaction.get(orderRef);
    if (!orderSnapshot.exists) {
      throw new Error("PADDLE_ORDER_NOT_FOUND");
    }

    const order = orderSnapshot.data() as CommerceOrder;
    if (
      order.uid !== uid ||
      order.caseId !== caseId ||
      order.productCode !== productCode ||
      order.currency !== currency ||
      order.amountMinor !== actualAmountMinor ||
      order.paddleTransactionId !== transactionId
    ) {
      throw new Error("PADDLE_ORDER_PAYLOAD_MISMATCH");
    }

    await writeLedgerEntry(dbTransaction, {
      uid,
      orderId,
      transactionId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      currency,
      amountMinor: actualAmountMinor,
      idempotencyKey: `payment:${transactionId}`,
    });

    await transitionOrderStatus(dbTransaction, orderId, "PAID", {
      paddleTransactionId: transactionId,
    });

    await issuePreparationPack(dbTransaction, {
      uid,
      orderId,
      caseId,
      transactionId,
      eventId,
      productCode,
      versions: catalogProduct.entitlementQuantity,
    });

    await transitionOrderStatus(dbTransaction, orderId, "ENTITLED");
  });

  console.log(`[PADDLE-PROCESSOR] Completed fulfillment for order ${orderId}; five case-bound versions issued.`);
}

async function handleAdjustmentUpdated(eventId: string, adjustment: any): Promise<void> {
  const transactionId = asString(adjustment?.transactionId || adjustment?.transaction_id);
  const status = asString(adjustment?.status);
  const adjustmentId = asString(adjustment?.id);

  if (!transactionId || !adjustmentId) {
    throw new Error("PADDLE_ADJUSTMENT_METADATA_MISSING");
  }
  if (status !== "approved" && status !== "completed") {
    console.log(`[PADDLE-PROCESSOR] Adjustment ${adjustmentId} status is ${status}. Skipping.`);
    return;
  }

  const orderQuery = await adminDb
    .collection("commerce_orders")
    .where("paddleTransactionId", "==", transactionId)
    .limit(1)
    .get();

  if (orderQuery.empty) {
    throw new Error("PADDLE_REFUND_ORDER_NOT_FOUND");
  }

  const order = orderQuery.docs[0].data() as CommerceOrder;
  const amountMinor = Number(
    adjustment?.totals?.subtotal ??
    adjustment?.totals?.total ??
    order.amountMinor
  );

  await adminDb.runTransaction(async (dbTransaction: any) => {
    await processRefund(dbTransaction, {
      uid: order.uid,
      orderId: order.orderId,
      transactionId,
      eventId,
      adjustmentId,
      amountMinor: Number.isFinite(amountMinor) ? amountMinor : order.amountMinor,
      currency: asString(adjustment?.currencyCode || adjustment?.currency_code) || order.currency,
    });
  });

  console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
