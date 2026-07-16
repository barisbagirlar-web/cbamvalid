import { createHash } from "node:crypto";
import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { PREPARATION_PACK } from "./preparation-pack";

export interface CreditSummary {
  availableCredits: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  lifetimeAdjusted: number;
  lifetimeRefunded: number;
  updatedAt: string;
}

export type CreditLedgerType =
  | "PURCHASE_CREDIT"
  | "SEAL_CONSUMPTION"
  | "ADMIN_ADJUSTMENT_ADD"
  | "ADMIN_ADJUSTMENT_SUBTRACT"
  | "REFUND_REVERSAL";

function integer(value: unknown, field: string): number {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`CREDIT_SUMMARY_INVALID:${field}`);
  return number;
}

export function normalizeCreditSummary(value: unknown): CreditSummary {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    availableCredits: integer(source.availableCredits, "availableCredits"),
    lifetimePurchased: integer(source.lifetimePurchased, "lifetimePurchased"),
    lifetimeConsumed: integer(source.lifetimeConsumed, "lifetimeConsumed"),
    lifetimeAdjusted: integer(source.lifetimeAdjusted, "lifetimeAdjusted"),
    lifetimeRefunded: integer(source.lifetimeRefunded, "lifetimeRefunded"),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date(0).toISOString(),
  };
}

function markerId(kind: string, uid: string, idempotencyKey: string): string {
  const digest = createHash("sha256").update(`${kind}\u0000${uid}\u0000${idempotencyKey}`).digest("hex");
  return `${kind}_${digest}`;
}

async function applyCreditMutation(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    idempotencyKey: string;
    type: CreditLedgerType;
    amount: number;
    reason: string;
    orderId?: string;
    reportId?: string;
    actorUid?: string;
    lifetimeField: "lifetimePurchased" | "lifetimeConsumed" | "lifetimeAdjusted" | "lifetimeRefunded";
  }
): Promise<CreditSummary> {
  if (!Number.isSafeInteger(params.amount) || params.amount === 0) throw new Error("CREDIT_MUTATION_AMOUNT_INVALID");
  const markerRef = adminDb.collection("credit_events").doc(markerId(params.type, params.uid, params.idempotencyKey));
  const summaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const ledgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(markerRef.id);
  const [marker, summarySnapshot] = await Promise.all([
    transaction.get(markerRef),
    transaction.get(summaryRef),
  ]);
  if (marker.exists) {
    return normalizeCreditSummary(summarySnapshot.data());
  }

  const current = normalizeCreditSummary(summarySnapshot.data());
  const nextBalance = current.availableCredits + params.amount;
  if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) {
    throw new Error(`CREDIT_BALANCE_INSUFFICIENT:${current.availableCredits}:${Math.abs(params.amount)}`);
  }

  const lifetimeDelta = Math.abs(params.amount);
  const now = new Date().toISOString();
  const next: CreditSummary = {
    ...current,
    availableCredits: nextBalance,
    [params.lifetimeField]: current[params.lifetimeField] + lifetimeDelta,
    updatedAt: now,
  };
  transaction.set(summaryRef, next, { merge: true });
  transaction.create(ledgerRef, {
    uid: params.uid,
    type: params.type,
    amount: params.amount,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
    orderId: params.orderId || null,
    reportId: params.reportId || null,
    actorUid: params.actorUid || null,
    createdAt: now,
    balanceAfter: nextBalance,
  });
  transaction.create(markerRef, {
    uid: params.uid,
    type: params.type,
    idempotencyKey: params.idempotencyKey,
    amount: params.amount,
    balanceAfter: nextBalance,
    createdAt: now,
  });
  return next;
}

export function grantPurchasedCredits(
  transaction: admin.firestore.Transaction,
  params: { uid: string; transactionId: string; orderId: string }
): Promise<CreditSummary> {
  return applyCreditMutation(transaction, {
    uid: params.uid,
    idempotencyKey: params.transactionId,
    type: "PURCHASE_CREDIT",
    amount: PREPARATION_PACK.accountCredits,
    reason: "PREPARATION_PACK_PURCHASE",
    orderId: params.orderId,
    lifetimeField: "lifetimePurchased",
  });
}

export function consumeSealCredits(
  transaction: admin.firestore.Transaction,
  params: { uid: string; reportId: string; orderId: string }
): Promise<CreditSummary> {
  return applyCreditMutation(transaction, {
    uid: params.uid,
    idempotencyKey: params.reportId,
    type: "SEAL_CONSUMPTION",
    amount: -PREPARATION_PACK.creditsPerRelease,
    reason: "SUCCESSFUL_REPORT_SEAL",
    orderId: params.orderId,
    reportId: params.reportId,
    lifetimeField: "lifetimeConsumed",
  });
}

export function adjustCredits(
  transaction: admin.firestore.Transaction,
  params: { uid: string; amount: number; reason: string; actorUid: string; requestId: string }
): Promise<CreditSummary> {
  return applyCreditMutation(transaction, {
    uid: params.uid,
    idempotencyKey: params.requestId,
    type: params.amount > 0 ? "ADMIN_ADJUSTMENT_ADD" : "ADMIN_ADJUSTMENT_SUBTRACT",
    amount: params.amount,
    reason: params.reason,
    actorUid: params.actorUid,
    lifetimeField: "lifetimeAdjusted",
  });
}

export function reverseCreditsForRefund(
  transaction: admin.firestore.Transaction,
  params: { uid: string; adjustmentId: string; orderId: string; amount: number }
): Promise<CreditSummary> {
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) throw new Error("REFUND_CREDIT_AMOUNT_INVALID");
  return applyCreditMutation(transaction, {
    uid: params.uid,
    idempotencyKey: params.adjustmentId,
    type: "REFUND_REVERSAL",
    amount: -params.amount,
    reason: "PADDLE_REFUND",
    orderId: params.orderId,
    lifetimeField: "lifetimeRefunded",
  });
}
