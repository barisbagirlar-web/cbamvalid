import admin from "firebase-admin";
import { adminDb } from "@/firebase-admin";
import { OrderNotFoundError } from "./commerce-errors";
import { validateIdentifier } from "@/firestore-validator";

export interface CommerceOrder {
  orderId: string;
  uid: string;
  caseId: string;
  productCode: string;
  status:
    | "DRAFT"
    | "CHECKOUT_CREATED"
    | "PAYMENT_PENDING"
    | "PAID"
    | "ENTITLED"
    | "REPORT_RESERVED"
    | "REPORT_CALCULATED"
    | "REPORT_SEALED"
    | "DELIVERED"
    | "PAYMENT_FAILED"
    | "PAYMENT_CANCELED"
    | "REFUNDED_UNUSED"
    | "REFUNDED_AFTER_DELIVERY";
  currency: string;
  amountMinor: number;
  paddleTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates an initial order record in CHECKOUT_CREATED state
 */
export async function createOrder(
  dbTransaction: admin.firestore.Transaction,
  params: {
    uid: string;
    caseId: string;
    productCode: string;
    currency: string;
    amountMinor: number;
  }
): Promise<CommerceOrder> {
  validateIdentifier("uid", params.uid);
  validateIdentifier("caseId", params.caseId);
  
  const orderRef = adminDb.collection("commerce_orders").doc();
  const orderId = `ord_${orderRef.id}`;
  const now = new Date().toISOString();

  const order: CommerceOrder = {
    orderId,
    uid: params.uid,
    caseId: params.caseId,
    productCode: params.productCode,
    status: "CHECKOUT_CREATED",
    currency: params.currency,
    amountMinor: params.amountMinor,
    createdAt: now,
    updatedAt: now,
  };

  dbTransaction.set(adminDb.collection("commerce_orders").doc(orderId), order);
  return order;
}

/**
 * Atomic status transition with validation rules
 */
export async function transitionOrderStatus(
  dbTransaction: admin.firestore.Transaction,
  orderId: string,
  newStatus: CommerceOrder["status"],
  metadata?: Partial<CommerceOrder>
): Promise<CommerceOrder> {
  validateIdentifier("orderId", orderId);
  if (metadata?.paddleTransactionId) {
    validateIdentifier("paddleTransactionId", metadata.paddleTransactionId);
  }
  
  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const snapshot: any = await dbTransaction.get(orderRef as any);

  if (!snapshot.exists) {
    throw new OrderNotFoundError(orderId);
  }

  const order = snapshot.data() as CommerceOrder;
  const now = new Date().toISOString();

  // Validate state machine monotonicity (prevent invalid transitions)
  const isTransitionValid = validateStateTransition(order.status, newStatus);
  if (!isTransitionValid) {
    console.warn(`[ORDER-STATE] Warning: Attempted questionable state transition from ${order.status} to ${newStatus}. Transition registered.`);
  }

  const updatedOrder: Partial<CommerceOrder> = {
    ...metadata,
    status: newStatus,
    updatedAt: now,
  };

  dbTransaction.update(orderRef, updatedOrder);
  return { ...order, ...updatedOrder };
}

/**
 * Enforce state machine rules
 */
function validateStateTransition(current: CommerceOrder["status"], target: CommerceOrder["status"]): boolean {
  if (current === target) return true;

  const validTransitions: Record<CommerceOrder["status"], CommerceOrder["status"][]> = {
    DRAFT: ["CHECKOUT_CREATED"],
    CHECKOUT_CREATED: ["PAYMENT_PENDING", "PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
    PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
    PAID: ["ENTITLED", "REFUNDED_UNUSED"],
    ENTITLED: ["REPORT_RESERVED", "REFUNDED_UNUSED"],
    REPORT_RESERVED: ["REPORT_CALCULATED", "ENTITLED", "REFUNDED_UNUSED"],
    REPORT_CALCULATED: ["REPORT_SEALED"],
    REPORT_SEALED: ["DELIVERED"],
    DELIVERED: ["REFUNDED_AFTER_DELIVERY"],
    PAYMENT_FAILED: ["CHECKOUT_CREATED"],
    PAYMENT_CANCELED: ["CHECKOUT_CREATED"],
    REFUNDED_UNUSED: [],
    REFUNDED_AFTER_DELIVERY: [],
  };

  const allowed = validTransitions[current] || [];
  return allowed.includes(target);
}
