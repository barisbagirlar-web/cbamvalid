import { createHash } from "node:crypto";
import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { PREPARATION_PACK } from "./preparation-pack";
import type { ValidatedCompletedTransaction } from "./transaction-contract";
import type { CommerceOrder } from "./order-service";
import { assertOrderTransition } from "./order-state";
import { normalizeCreditSummary } from "./credit-service";
import { writeLedgerEntry } from "./ledger-service";

function entitlementId(transaction: ValidatedCompletedTransaction): string {
  const digest = createHash("sha256")
    .update(`${transaction.uid}\u0000${transaction.transactionId}\u0000${transaction.productCode}`)
    .digest("hex");
  return `ent_${digest}`;
}

export async function fulfillPreparationPackPurchase(
  dbTransaction: admin.firestore.Transaction,
  transaction: ValidatedCompletedTransaction,
  eventId: string
): Promise<{ entitlementId: string; balanceAfter: number; idempotent: boolean }> {
  const orderRef = adminDb.collection("commerce_orders").doc(transaction.orderId);
  const entitlementRef = adminDb.collection("entitlements").doc(entitlementId(transaction));
  const creditSummaryRef = adminDb.collection("users").doc(transaction.uid).collection("creditSummary").doc("current");
  const creditMarkerRef = adminDb.collection("credit_events").doc(`purchase_${transaction.transactionId}`);
  const creditLedgerRef = adminDb.collection("users").doc(transaction.uid).collection("creditLedger").doc(`purchase_${transaction.transactionId}`);

  const [orderSnapshot, entitlementSnapshot, creditSummarySnapshot, markerSnapshot] = await Promise.all([
    dbTransaction.get(orderRef),
    dbTransaction.get(entitlementRef),
    dbTransaction.get(creditSummaryRef),
    dbTransaction.get(creditMarkerRef),
  ]);
  if (!orderSnapshot.exists) throw new Error("PURCHASE_ORDER_NOT_FOUND");
  const order = orderSnapshot.data() as CommerceOrder;
  if (
    order.uid !== transaction.uid ||
    order.productCode !== transaction.productCode ||
    order.currency !== transaction.currency ||
    order.amountMinor !== transaction.totalMinor ||
    order.caseId !== transaction.caseId
  ) {
    throw new Error("PURCHASE_ORDER_CONTRACT_MISMATCH");
  }
  if (order.paddleTransactionId && order.paddleTransactionId !== transaction.transactionId) {
    throw new Error("PURCHASE_TRANSACTION_ID_MISMATCH");
  }

  const completed = order.status === "ENTITLED" && entitlementSnapshot.exists && markerSnapshot.exists;
  if (completed) {
    const current = normalizeCreditSummary(creditSummarySnapshot.data());
    return { entitlementId: entitlementRef.id, balanceAfter: current.availableCredits, idempotent: true };
  }
  if (order.status === "ENTITLED" || entitlementSnapshot.exists || markerSnapshot.exists) {
    throw new Error("PURCHASE_FULFILLMENT_PARTIAL_STATE");
  }

  assertOrderTransition(order.status, "PAID");
  assertOrderTransition("PAID", "ENTITLED");
  const current = normalizeCreditSummary(creditSummarySnapshot.data());
  const balanceAfter = current.availableCredits + PREPARATION_PACK.accountCredits;
  if (!Number.isSafeInteger(balanceAfter)) throw new Error("PURCHASE_CREDIT_OVERFLOW");
  const now = new Date().toISOString();

  dbTransaction.update(orderRef, {
    status: "ENTITLED",
    paddleTransactionId: transaction.transactionId,
    paymentCapturedAt: now,
    entitledAt: now,
    updatedAt: now,
  });
  dbTransaction.create(entitlementRef, {
    entitlementId: entitlementRef.id,
    uid: transaction.uid,
    orderId: transaction.orderId,
    productCode: transaction.productCode,
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: PREPARATION_PACK.maxReleases,
    createdAt: now,
    updatedAt: now,
    releasesCount: 0,
    releasesList: [],
  });
  dbTransaction.set(creditSummaryRef, {
    ...current,
    availableCredits: balanceAfter,
    lifetimePurchased: current.lifetimePurchased + PREPARATION_PACK.accountCredits,
    updatedAt: now,
  }, { merge: true });
  dbTransaction.create(creditLedgerRef, {
    uid: transaction.uid,
    type: "PURCHASE_CREDIT",
    amount: PREPARATION_PACK.accountCredits,
    reason: "PREPARATION_PACK_PURCHASE",
    orderId: transaction.orderId,
    transactionId: transaction.transactionId,
    eventId,
    createdAt: now,
    balanceAfter,
  });
  dbTransaction.create(creditMarkerRef, {
    uid: transaction.uid,
    orderId: transaction.orderId,
    transactionId: transaction.transactionId,
    creditsGranted: PREPARATION_PACK.accountCredits,
    createdAt: now,
  });
  await writeLedgerEntry(dbTransaction, {
    uid: transaction.uid,
    orderId: transaction.orderId,
    transactionId: transaction.transactionId,
    eventId,
    type: "PAYMENT_CAPTURED",
    quantity: 1,
    currency: transaction.currency,
    amountMinor: transaction.totalMinor,
    idempotencyKey: `payment:${transaction.transactionId}`,
  });
  await writeLedgerEntry(dbTransaction, {
    uid: transaction.uid,
    orderId: transaction.orderId,
    transactionId: transaction.transactionId,
    eventId,
    type: "ENTITLEMENT_ISSUED",
    quantity: 1,
    idempotencyKey: `entitlement:${transaction.transactionId}:${transaction.productCode}`,
  });

  return { entitlementId: entitlementRef.id, balanceAfter, idempotent: false };
}
