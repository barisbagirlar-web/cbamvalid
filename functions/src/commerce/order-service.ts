import admin from "firebase-admin";
import { createHash } from "node:crypto";
import { adminDb } from "../firebase-admin";
import { OrderNotFoundError } from "./commerce-errors";
import { validateIdentifier } from "../firestore-validator";
import { assertOrderTransition, type OrderStatus } from "./order-state";

export interface CommerceOrder {
  orderId: string;
  requestId: string;
  uid: string;
  caseId?: string;
  productCode: string;
  status: OrderStatus;
  currency: string;
  amountMinor: number;
  paddleTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export function deriveOrderId(uid: string, requestId: string): string {
  validateIdentifier("uid", uid);
  const normalizedRequestId = requestId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedRequestId)) {
    throw new Error("CHECKOUT_REQUEST_ID_INVALID");
  }
  const digest = createHash("sha256").update(`${uid}\u0000${normalizedRequestId}`).digest("hex");
  return `ord_${digest}`;
}

export async function createOrder(
  dbTransaction: admin.firestore.Transaction,
  params: {
    uid: string;
    requestId: string;
    caseId?: string;
    productCode: string;
    currency: string;
    amountMinor: number;
  }
): Promise<{ order: CommerceOrder; created: boolean }> {
  validateIdentifier("uid", params.uid);
  if (params.caseId) validateIdentifier("caseId", params.caseId);
  if (!Number.isSafeInteger(params.amountMinor) || params.amountMinor <= 0) {
    throw new Error("ORDER_AMOUNT_INVALID");
  }

  const orderId = deriveOrderId(params.uid, params.requestId);
  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const snapshot = await dbTransaction.get(orderRef);
  if (snapshot.exists) {
    const existing = snapshot.data() as Partial<CommerceOrder>;
    if (
      existing.uid !== params.uid ||
      existing.requestId !== params.requestId ||
      existing.productCode !== params.productCode ||
      existing.currency !== params.currency ||
      existing.amountMinor !== params.amountMinor ||
      existing.caseId !== params.caseId
    ) {
      throw new Error("CHECKOUT_IDEMPOTENCY_COLLISION");
    }
    return { order: existing as CommerceOrder, created: false };
  }

  const now = new Date().toISOString();
  const order: CommerceOrder = {
    orderId,
    requestId: params.requestId,
    uid: params.uid,
    ...(params.caseId ? { caseId: params.caseId } : {}),
    productCode: params.productCode,
    status: "CHECKOUT_CREATED",
    currency: params.currency,
    amountMinor: params.amountMinor,
    createdAt: now,
    updatedAt: now,
  };
  dbTransaction.create(orderRef, order);
  return { order, created: true };
}

export async function transitionOrderStatus(
  dbTransaction: admin.firestore.Transaction,
  orderId: string,
  newStatus: OrderStatus,
  metadata?: Partial<CommerceOrder>
): Promise<CommerceOrder> {
  validateIdentifier("orderId", orderId);
  if (metadata?.paddleTransactionId) validateIdentifier("paddleTransactionId", metadata.paddleTransactionId);

  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const snapshot = await dbTransaction.get(orderRef);
  if (!snapshot.exists) throw new OrderNotFoundError(orderId);

  const order = snapshot.data() as CommerceOrder;
  assertOrderTransition(order.status, newStatus);
  const updatedOrder: CommerceOrder = {
    ...order,
    ...metadata,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  dbTransaction.update(orderRef, {
    ...metadata,
    status: newStatus,
    updatedAt: updatedOrder.updatedAt,
  });
  return updatedOrder;
}
