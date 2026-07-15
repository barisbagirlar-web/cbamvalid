import { z } from "zod";
import { adminDb } from "../firebase-admin";
import { processRefund } from "./refund-service";
import { isSandboxMode } from "./paddle-client";
import { validateCompletedTransaction } from "./transaction-contract";
import { fulfillPreparationPackPurchase } from "./purchase-fulfillment";

const WebhookEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  eventType: z.string().min(1).max(128),
  occurredAt: z.union([z.string(), z.date()]),
  data: z.unknown(),
}).passthrough();

const AdjustmentSchema = z.object({
  id: z.string().min(1).max(128),
  transactionId: z.string().min(1).max(128),
  status: z.string(),
  currencyCode: z.string().length(3),
  totals: z.object({ subtotal: z.union([z.string(), z.number()]) }).passthrough(),
}).passthrough();

function positiveMinor(value: string | number): number {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error("PADDLE_ADJUSTMENT_AMOUNT_INVALID");
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("PADDLE_ADJUSTMENT_AMOUNT_INVALID");
  return amount;
}

export async function processWebhookEvent(input: unknown): Promise<void> {
  const event = WebhookEventSchema.parse(input);
  if (event.eventType === "transaction.completed") {
    const transaction = validateCompletedTransaction(event.data, isSandboxMode());
    await adminDb.runTransaction((dbTransaction) =>
      fulfillPreparationPackPurchase(dbTransaction, transaction, event.eventId)
    );
    return;
  }

  if (event.eventType === "adjustment.created" || event.eventType === "adjustment.updated") {
    const adjustment = AdjustmentSchema.parse(event.data);
    if (adjustment.status !== "approved" && adjustment.status !== "completed") return;

    const orderQuery = await adminDb.collection("commerce_orders")
      .where("paddleTransactionId", "==", adjustment.transactionId)
      .limit(2)
      .get();
    if (orderQuery.empty) throw new Error("REFUND_ORDER_NOT_FOUND");
    if (orderQuery.docs.length !== 1) throw new Error("REFUND_ORDER_COLLISION");
    const order = orderQuery.docs[0].data() as Record<string, unknown>;
    const uid = typeof order.uid === "string" ? order.uid : "";
    const orderId = typeof order.orderId === "string" ? order.orderId : "";
    if (!uid || !orderId) throw new Error("REFUND_ORDER_INVALID");

    await adminDb.runTransaction((dbTransaction) => processRefund(dbTransaction, {
      uid,
      orderId,
      transactionId: adjustment.transactionId,
      eventId: event.eventId,
      adjustmentId: adjustment.id,
      amountMinor: positiveMinor(adjustment.totals.subtotal),
      currency: adjustment.currencyCode,
    }));
    return;
  }

  console.log(`[PADDLE-PROCESSOR] Ignored unsupported event type ${event.eventType}`);
}
