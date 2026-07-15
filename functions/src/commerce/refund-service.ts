import crypto from "node:crypto";
import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { COMMERCIAL_CONTRACT } from "./commercial-contract";
import { normalizeCreditSummary, type CreditLedgerEntry } from "./credit-service";
import { commitLedgerEntry, prepareLedgerEntry } from "./ledger-service";
import { assertOrderTransition, type CommerceOrder } from "./order-service";

function digest(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export async function processRefund(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    adjustmentId: string;
    amountMinor: number;
    currency: string;
  }
): Promise<void> {
  if (params.amountMinor !== COMMERCIAL_CONTRACT.priceMinor) throw new Error("REFUND_FULL_AMOUNT_REQUIRED");
  if (params.currency !== COMMERCIAL_CONTRACT.currency) throw new Error("REFUND_CURRENCY_MISMATCH");

  const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
  const summaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const purchaseLedgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger")
    .doc(`purchase_${digest([params.uid, params.transactionId])}`);
  const refundEntryId = `refund_${digest([params.uid, params.adjustmentId])}`;
  const refundLedgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(refundEntryId);
  const holdRef = adminDb.collection("users").doc(params.uid).collection("commerceHold").doc("current");

  const [orderSnapshot, summarySnapshot, purchaseLedgerSnapshot, refundLedgerSnapshot, holdSnapshot] = await Promise.all([
    transaction.get(orderRef),
    transaction.get(summaryRef),
    transaction.get(purchaseLedgerRef),
    transaction.get(refundLedgerRef),
    transaction.get(holdRef),
  ]);
  if (!orderSnapshot.exists) throw new Error("REFUND_ORDER_NOT_FOUND");
  if (!purchaseLedgerSnapshot.exists) throw new Error("REFUND_PURCHASE_CREDIT_LEDGER_MISSING");

  const order = orderSnapshot.data() as CommerceOrder;
  const purchaseLedger = purchaseLedgerSnapshot.data() as CreditLedgerEntry;
  if (
    order.uid !== params.uid ||
    order.orderId !== params.orderId ||
    order.paddleTransactionId !== params.transactionId ||
    order.productCode !== COMMERCIAL_CONTRACT.productCode ||
    order.amountMinor !== params.amountMinor ||
    order.currency !== params.currency ||
    purchaseLedger.type !== "PURCHASE" ||
    purchaseLedger.amount !== COMMERCIAL_CONTRACT.creditsGranted ||
    purchaseLedger.orderId !== params.orderId ||
    purchaseLedger.transactionId !== params.transactionId
  ) throw new Error("REFUND_PURCHASE_IDENTITY_MISMATCH");

  const current = normalizeCreditSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);
  if (refundLedgerSnapshot.exists) {
    const existing = refundLedgerSnapshot.data() as CreditLedgerEntry & { adjustmentId?: string; refundCredits?: number; deficitCredits?: number };
    if (
      existing.uid !== params.uid ||
      existing.orderId !== params.orderId ||
      existing.transactionId !== params.transactionId ||
      existing.adjustmentId !== params.adjustmentId ||
      existing.refundCredits !== COMMERCIAL_CONTRACT.creditsGranted
    ) throw new Error("REFUND_IDEMPOTENCY_COLLISION");
    return;
  }

  const debitedCredits = Math.min(current.availableCredits, COMMERCIAL_CONTRACT.creditsGranted);
  const deficitCredits = COMMERCIAL_CONTRACT.creditsGranted - debitedCredits;
  const balanceAfter = current.availableCredits - debitedCredits;
  const now = new Date().toISOString();
  const nextSummary = {
    ...current,
    availableCredits: balanceAfter,
    lifetimeRefunded: current.lifetimeRefunded + COMMERCIAL_CONTRACT.creditsGranted,
    updatedAt: now,
  };
  const refundLedger: CreditLedgerEntry & {
    adjustmentId: string;
    refundCredits: number;
    debitedCredits: number;
    deficitCredits: number;
  } = {
    entryId: refundEntryId,
    uid: params.uid,
    amount: -debitedCredits,
    type: "REFUND",
    reason: deficitCredits === 0
      ? `Refunded unused ${COMMERCIAL_CONTRACT.displayName}`
      : `Refund approved after ${deficitCredits} credit-equivalent had already been consumed`,
    orderId: params.orderId,
    transactionId: params.transactionId,
    createdAt: now,
    balanceAfter,
    adjustmentId: params.adjustmentId,
    refundCredits: COMMERCIAL_CONTRACT.creditsGranted,
    debitedCredits,
    deficitCredits,
  };

  const globalLedger = await prepareLedgerEntry(transaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "REFUND_APPROVED",
    quantity: 1,
    currency: params.currency,
    amountMinor: params.amountMinor,
    idempotencyKey: `refund:${params.adjustmentId}`,
    createdAt: now,
  });

  const finalStatus = deficitCredits === 0 ? "REFUNDED_UNUSED" : "REFUNDED_AFTER_DELIVERY";
  assertOrderTransition(order.status, finalStatus);
  commitLedgerEntry(transaction, globalLedger);
  transaction.set(summaryRef, nextSummary, { merge: true });
  transaction.create(refundLedgerRef, refundLedger);
  transaction.update(orderRef, {
    status: finalStatus,
    refundAdjustmentId: params.adjustmentId,
    refundedAt: now,
    updatedAt: now,
  });

  if (deficitCredits > 0) {
    if (holdSnapshot.exists && holdSnapshot.data()?.active === true) {
      throw new Error("REFUND_COMMERCE_HOLD_ALREADY_ACTIVE");
    }
    transaction.set(holdRef, {
      active: true,
      reason: "REFUND_AFTER_CREDIT_CONSUMPTION",
      orderId: params.orderId,
      transactionId: params.transactionId,
      adjustmentId: params.adjustmentId,
      deficitCredits,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    transaction.set(holdRef, {
      active: false,
      reason: "REFUND_UNUSED_CREDITS_RECOVERED",
      orderId: params.orderId,
      transactionId: params.transactionId,
      adjustmentId: params.adjustmentId,
      deficitCredits: 0,
      updatedAt: now,
    }, { merge: true });
  }
}
