import { adminDb } from "../firebase-admin";
import { COMMERCIAL_CONTRACT, normalizeProductCode } from "./commercial-contract";
import { preparePurchasedCreditGrant, commitPurchasedCreditGrant } from "./credit-service";
import { prepareLedgerEntry, commitLedgerEntry } from "./ledger-service";
import { assertOrderTransition, type CommerceOrder } from "./order-service";
import { processRefund } from "./refund-service";
import type { VerifiedWebhookEvent } from "./webhook-verifier";

export interface NormalizedCompletedTransaction {
  transactionId: string;
  status: "completed";
  currency: string;
  totalMinor: number;
  uid: string;
  orderId: string;
  requestId: string;
  productCode: string;
  quantity: number;
  priceId: string;
}

export interface ProcessedWebhookResult {
  handled: boolean;
  eventType: string;
  uid?: string;
  orderId?: string;
  transactionId?: string;
  productCode?: string;
  idempotentReplay?: boolean;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`PADDLE_FIELD_INVALID:${field}`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`PADDLE_FIELD_INVALID:${field}`);
  return value.trim();
}

function totalMinor(data: Record<string, unknown>): number {
  const details = data.details && typeof data.details === "object" ? data.details as Record<string, unknown> : {};
  const detailsTotals = details.totals && typeof details.totals === "object" ? details.totals as Record<string, unknown> : {};
  const totals = data.totals && typeof data.totals === "object" ? data.totals as Record<string, unknown> : {};
  const raw = detailsTotals.total ?? totals.total;
  const parsed = typeof raw === "number" ? raw : Number(requiredString(raw, "totals.total"));
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("PADDLE_TOTAL_INVALID");
  return parsed;
}

export function normalizeCompletedTransaction(value: unknown): NormalizedCompletedTransaction {
  const data = record(value, "transaction");
  const status = requiredString(data.status, "status");
  if (status !== "completed") throw new Error(`PADDLE_TRANSACTION_NOT_COMPLETED:${status}`);
  const customData = record(data.customData ?? data.custom_data, "customData");
  const items = data.items;
  if (!Array.isArray(items) || items.length !== 1) throw new Error("PADDLE_LINE_ITEM_COUNT_INVALID");
  const item = record(items[0], "items.0");
  const quantity = Number(item.quantity);
  if (!Number.isSafeInteger(quantity) || quantity !== 1) throw new Error("PADDLE_QUANTITY_INVALID");
  const price = item.price && typeof item.price === "object" ? item.price as Record<string, unknown> : {};
  const priceId = requiredString(price.id ?? item.priceId ?? item.price_id, "items.0.priceId");
  const productCode = normalizeProductCode(requiredString(customData.productCode, "customData.productCode"));
  return {
    transactionId: requiredString(data.id, "id"),
    status: "completed",
    currency: requiredString(data.currencyCode ?? data.currency_code, "currencyCode").toUpperCase(),
    totalMinor: totalMinor(data),
    uid: requiredString(customData.uid, "customData.uid"),
    orderId: requiredString(customData.orderId, "customData.orderId"),
    requestId: requiredString(customData.requestId, "customData.requestId"),
    productCode,
    quantity,
    priceId,
  };
}

async function handleTransactionCompleted(
  event: VerifiedWebhookEvent
): Promise<ProcessedWebhookResult> {
  const purchase = normalizeCompletedTransaction(event.data);
  const orderRef = adminDb.collection("commerce_orders").doc(purchase.orderId);

  const result = await adminDb.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw new Error("PADDLE_ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as CommerceOrder;
    if (
      order.orderId !== purchase.orderId ||
      order.uid !== purchase.uid ||
      order.productCode !== purchase.productCode ||
      order.checkoutRequestId !== purchase.requestId ||
      order.paddleTransactionId !== purchase.transactionId ||
      order.paddlePriceId !== purchase.priceId ||
      order.currency !== purchase.currency ||
      order.amountMinor !== purchase.totalMinor ||
      purchase.productCode !== COMMERCIAL_CONTRACT.productCode ||
      purchase.totalMinor !== COMMERCIAL_CONTRACT.priceMinor ||
      purchase.currency !== COMMERCIAL_CONTRACT.currency
    ) throw new Error("PADDLE_ORDER_FULFILLMENT_MISMATCH");

    const paymentLedger = await prepareLedgerEntry(transaction, {
      uid: purchase.uid,
      orderId: purchase.orderId,
      transactionId: purchase.transactionId,
      eventId: event.eventId,
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      currency: purchase.currency,
      amountMinor: purchase.totalMinor,
      idempotencyKey: `payment:${purchase.transactionId}`,
      createdAt: event.occurredAt,
    });
    const creditGrant = await preparePurchasedCreditGrant(transaction, {
      uid: purchase.uid,
      orderId: purchase.orderId,
      transactionId: purchase.transactionId,
      eventId: event.eventId,
      credits: COMMERCIAL_CONTRACT.creditsGranted,
      occurredAt: event.occurredAt,
    });

    const bothReplay = paymentLedger.idempotentReplay && creditGrant.idempotentReplay;
    if (order.status === "CREDITS_GRANTED") {
      if (!bothReplay) throw new Error("PADDLE_FULFILLMENT_PARTIAL_STATE");
      return { idempotentReplay: true };
    }
    if (paymentLedger.idempotentReplay !== creditGrant.idempotentReplay) {
      throw new Error("PADDLE_FULFILLMENT_PARTIAL_STATE");
    }
    if (order.status !== "PAYMENT_PENDING") throw new Error(`PADDLE_ORDER_STATE_INVALID:${order.status}`);
    assertOrderTransition(order.status, "PAID");
    assertOrderTransition("PAID", "CREDITS_GRANTED");

    commitLedgerEntry(transaction, paymentLedger);
    commitPurchasedCreditGrant(transaction, creditGrant);
    transaction.update(orderRef, {
      status: "CREDITS_GRANTED",
      paidAt: event.occurredAt,
      creditsGranted: COMMERCIAL_CONTRACT.creditsGranted,
      updatedAt: new Date().toISOString(),
    });
    return { idempotentReplay: false };
  });

  return {
    handled: true,
    eventType: event.eventType,
    uid: purchase.uid,
    orderId: purchase.orderId,
    transactionId: purchase.transactionId,
    productCode: purchase.productCode,
    idempotentReplay: result.idempotentReplay,
  };
}

async function handleAdjustmentUpdated(event: VerifiedWebhookEvent): Promise<ProcessedWebhookResult> {
  const adjustment = record(event.data, "adjustment");
  const status = requiredString(adjustment.status, "adjustment.status");
  if (status !== "approved" && status !== "completed") {
    return { handled: false, eventType: event.eventType };
  }
  const transactionId = requiredString(adjustment.transactionId ?? adjustment.transaction_id, "adjustment.transactionId");
  const adjustmentId = requiredString(adjustment.id, "adjustment.id");
  const orderQuery = await adminDb.collection("commerce_orders")
    .where("paddleTransactionId", "==", transactionId)
    .limit(2)
    .get();
  if (orderQuery.docs.length !== 1) throw new Error("REFUND_ORDER_RESOLUTION_FAILED");
  const order = orderQuery.docs[0].data() as CommerceOrder;
  const totals = record(adjustment.totals, "adjustment.totals");
  const amountMinor = Number(requiredString(totals.subtotal ?? totals.total, "adjustment.totals.total"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > order.amountMinor) {
    throw new Error("REFUND_AMOUNT_INVALID");
  }
  const currency = requiredString(adjustment.currencyCode ?? adjustment.currency_code, "adjustment.currencyCode").toUpperCase();
  if (currency !== order.currency) throw new Error("REFUND_CURRENCY_MISMATCH");

  await adminDb.runTransaction((transaction) => processRefund(transaction, {
    uid: order.uid,
    orderId: order.orderId,
    transactionId,
    eventId: event.eventId,
    adjustmentId,
    amountMinor,
    currency,
  }));
  return {
    handled: true,
    eventType: event.eventType,
    uid: order.uid,
    orderId: order.orderId,
    transactionId,
    productCode: order.productCode,
  };
}

export async function processWebhookEvent(event: VerifiedWebhookEvent): Promise<ProcessedWebhookResult> {
  if (event.eventType === "transaction.completed") return handleTransactionCompleted(event);
  if (event.eventType === "adjustment.created" || event.eventType === "adjustment.updated") {
    return handleAdjustmentUpdated(event);
  }
  return { handled: false, eventType: event.eventType };
}
