import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { OrderNotFoundError } from "./commerce-errors";
import { validateIdentifier } from "../firestore-validator";

export type CommerceOrderStatus =
  | "CHECKOUT_CREATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "CREDITS_GRANTED"
  | "PAYMENT_FAILED"
  | "PAYMENT_CANCELED"
  | "CHECKOUT_RECOVERY_REQUIRED"
  | "REFUNDED_UNUSED"
  | "REFUNDED_AFTER_DELIVERY";

export interface CommerceOrder {
  orderId: string;
  uid: string;
  productCode: string;
  status: CommerceOrderStatus;
  currency: string;
  amountMinor: number;
  checkoutRequestId: string;
  caseId?: string;
  paddleTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

const VALID_TRANSITIONS: Record<CommerceOrderStatus, readonly CommerceOrderStatus[]> = {
  CHECKOUT_CREATED: ["PAYMENT_PENDING", "PAYMENT_FAILED", "CHECKOUT_RECOVERY_REQUIRED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED", "CHECKOUT_RECOVERY_REQUIRED"],
  PAID: ["CREDITS_GRANTED", "REFUNDED_UNUSED"],
  CREDITS_GRANTED: ["REFUNDED_UNUSED", "REFUNDED_AFTER_DELIVERY"],
  PAYMENT_FAILED: [],
  PAYMENT_CANCELED: [],
  CHECKOUT_RECOVERY_REQUIRED: [],
  REFUNDED_UNUSED: [],
  REFUNDED_AFTER_DELIVERY: [],
};

export function assertOrderTransition(current: CommerceOrderStatus, target: CommerceOrderStatus): void {
  if (current === target) return;
  if (!VALID_TRANSITIONS[current]?.includes(target)) {
    throw new Error(`ORDER_STATE_TRANSITION_INVALID:${current}:${target}`);
  }
}

export async function createOrder(
  transaction: admin.firestore.Transaction,
  params: {
    orderId: string;
    uid: string;
    productCode: string;
    currency: string;
    amountMinor: number;
    checkoutRequestId: string;
    caseId?: string;
    now: string;
  }
): Promise<CommerceOrder> {
  validateIdentifier("orderId", params.orderId);
  validateIdentifier("uid", params.uid);
  const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
  const existing = await transaction.get(orderRef);
  if (existing.exists) throw new Error("ORDER_ID_COLLISION");
  const order: CommerceOrder = {
    orderId: params.orderId,
    uid: params.uid,
    productCode: params.productCode,
    status: "CHECKOUT_CREATED",
    currency: params.currency,
    amountMinor: params.amountMinor,
    checkoutRequestId: params.checkoutRequestId,
    ...(params.caseId ? { caseId: params.caseId } : {}),
    createdAt: params.now,
    updatedAt: params.now,
  };
  transaction.create(orderRef, order);
  return order;
}

export async function transitionOrderStatus(
  transaction: admin.firestore.Transaction,
  orderId: string,
  newStatus: CommerceOrderStatus,
  metadata?: Partial<Omit<CommerceOrder, "orderId" | "uid" | "status" | "createdAt">>
): Promise<CommerceOrder> {
  validateIdentifier("orderId", orderId);
  if (metadata?.paddleTransactionId) validateIdentifier("paddleTransactionId", metadata.paddleTransactionId);
  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const snapshot = await transaction.get(orderRef);
  if (!snapshot.exists) throw new OrderNotFoundError(orderId);
  const order = snapshot.data() as CommerceOrder;
  assertOrderTransition(order.status, newStatus);
  const updatedAt = new Date().toISOString();
  const update = { ...metadata, status: newStatus, updatedAt };
  transaction.update(orderRef, update);
  return { ...order, ...update };
}
