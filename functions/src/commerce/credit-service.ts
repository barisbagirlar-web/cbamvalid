import crypto from "node:crypto";
import type admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { validateIdentifier } from "../firestore-validator";
import { COMMERCIAL_CONTRACT } from "./commercial-contract";

export interface CreditSummary {
  availableCredits: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  lifetimeAdjusted: number;
  lifetimeRefunded: number;
  updatedAt: string;
}

export interface CreditLedgerEntry {
  entryId: string;
  uid: string;
  amount: number;
  type: "PURCHASE" | "PACK_UNLOCK" | "ADMIN_ADJUSTMENT" | "REFUND";
  reason: string;
  orderId?: string;
  transactionId?: string;
  requestId?: string;
  caseId?: string;
  entitlementId?: string;
  createdAt: string;
  balanceAfter: number;
}

export interface PreparedPurchasedCreditGrant {
  summaryRef: admin.firestore.DocumentReference;
  ledgerRef: admin.firestore.DocumentReference;
  nextSummary: CreditSummary;
  ledgerEntry: CreditLedgerEntry;
  idempotentReplay: boolean;
}

function integer(value: unknown, field: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`CREDIT_SUMMARY_INVALID:${field}`);
  return parsed;
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

function digest(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export async function preparePurchasedCreditGrant(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    credits: number;
    occurredAt: string;
  }
): Promise<PreparedPurchasedCreditGrant> {
  validateIdentifier("uid", params.uid);
  validateIdentifier("orderId", params.orderId);
  validateIdentifier("transactionId", params.transactionId);
  if (params.credits !== COMMERCIAL_CONTRACT.creditsGranted) throw new Error("PURCHASE_CREDIT_QUANTITY_MISMATCH");

  const entryId = `purchase_${digest([params.uid, params.transactionId])}`;
  const summaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const ledgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(entryId);
  const [summarySnapshot, ledgerSnapshot] = await Promise.all([
    transaction.get(summaryRef),
    transaction.get(ledgerRef),
  ]);
  const current = normalizeCreditSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);

  if (ledgerSnapshot.exists) {
    const existing = ledgerSnapshot.data() as CreditLedgerEntry;
    if (
      existing.uid !== params.uid ||
      existing.transactionId !== params.transactionId ||
      existing.orderId !== params.orderId ||
      existing.amount !== params.credits ||
      existing.balanceAfter !== current.availableCredits
    ) throw new Error("PURCHASE_CREDIT_IDEMPOTENCY_COLLISION");
    return {
      summaryRef,
      ledgerRef,
      nextSummary: current,
      ledgerEntry: existing,
      idempotentReplay: true,
    };
  }

  const balanceAfter = current.availableCredits + params.credits;
  if (!Number.isSafeInteger(balanceAfter)) throw new Error("CREDIT_BALANCE_OVERFLOW");
  const nextSummary: CreditSummary = {
    ...current,
    availableCredits: balanceAfter,
    lifetimePurchased: current.lifetimePurchased + params.credits,
    updatedAt: params.occurredAt,
  };
  const ledgerEntry: CreditLedgerEntry = {
    entryId,
    uid: params.uid,
    amount: params.credits,
    type: "PURCHASE",
    reason: `Purchased ${COMMERCIAL_CONTRACT.displayName}`,
    orderId: params.orderId,
    transactionId: params.transactionId,
    createdAt: params.occurredAt,
    balanceAfter,
  };
  return { summaryRef, ledgerRef, nextSummary, ledgerEntry, idempotentReplay: false };
}

export function commitPurchasedCreditGrant(
  transaction: admin.firestore.Transaction,
  prepared: PreparedPurchasedCreditGrant
): void {
  if (prepared.idempotentReplay) return;
  transaction.set(prepared.summaryRef, prepared.nextSummary, { merge: true });
  transaction.create(prepared.ledgerRef, prepared.ledgerEntry);
}

export async function grantPurchasedCredits(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    credits: number;
    occurredAt: string;
  }
): Promise<CreditSummary> {
  const prepared = await preparePurchasedCreditGrant(transaction, params);
  commitPurchasedCreditGrant(transaction, prepared);
  return prepared.nextSummary;
}

export async function unlockPreparationPack(
  transaction: admin.firestore.Transaction,
  params: { uid: string; caseId: string; requestId: string; now: string }
): Promise<{
  entitlementId: string;
  releasesGranted: number;
  creditsConsumed: number;
  balanceAfter: number;
  idempotentReplay: boolean;
}> {
  validateIdentifier("uid", params.uid);
  validateIdentifier("caseId", params.caseId);
  const requestDigest = digest([params.uid, params.caseId, params.requestId]);
  const idempotencyRef = adminDb.collection("idempotency").doc(`unlock_${requestDigest}`);
  const summaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const entitlementId = `ent_${requestDigest.slice(0, 48)}`;
  const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);
  const ledgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(`unlock_${requestDigest}`);

  const [idempotencySnapshot, summarySnapshot, entitlementSnapshot, ledgerSnapshot] = await Promise.all([
    transaction.get(idempotencyRef),
    transaction.get(summaryRef),
    transaction.get(entitlementRef),
    transaction.get(ledgerRef),
  ]);
  const current = normalizeCreditSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);

  if (idempotencySnapshot.exists) {
    const marker = idempotencySnapshot.data() as Record<string, unknown>;
    if (
      marker.uid !== params.uid ||
      marker.caseId !== params.caseId ||
      marker.requestId !== params.requestId ||
      marker.entitlementId !== entitlementId ||
      !entitlementSnapshot.exists ||
      !ledgerSnapshot.exists
    ) throw new Error("PACK_UNLOCK_IDEMPOTENCY_BROKEN");
    return {
      entitlementId,
      releasesGranted: COMMERCIAL_CONTRACT.releasesPerPack,
      creditsConsumed: COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
      balanceAfter: current.availableCredits,
      idempotentReplay: true,
    };
  }

  if (entitlementSnapshot.exists || ledgerSnapshot.exists) throw new Error("PACK_UNLOCK_PARTIAL_STATE");
  if (current.availableCredits < COMMERCIAL_CONTRACT.creditsRequiredToUnlock) {
    throw new HttpsError(
      "failed-precondition",
      `${COMMERCIAL_CONTRACT.creditsRequiredToUnlock} account credits are required to unlock one Preparation Pack.`
    );
  }

  const balanceAfter = current.availableCredits - COMMERCIAL_CONTRACT.creditsRequiredToUnlock;
  const next: CreditSummary = {
    ...current,
    availableCredits: balanceAfter,
    lifetimeConsumed: current.lifetimeConsumed + COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    updatedAt: params.now,
  };
  const ledgerEntry: CreditLedgerEntry = {
    entryId: `unlock_${requestDigest}`,
    uid: params.uid,
    amount: -COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    type: "PACK_UNLOCK",
    reason: `Unlocked ${COMMERCIAL_CONTRACT.displayName} for case ${params.caseId}`,
    requestId: params.requestId,
    caseId: params.caseId,
    entitlementId,
    createdAt: params.now,
    balanceAfter,
  };

  transaction.set(summaryRef, next, { merge: true });
  transaction.create(ledgerRef, ledgerEntry);
  transaction.create(entitlementRef, {
    entitlementId,
    uid: params.uid,
    orderId: `CREDIT_UNLOCK_${requestDigest}`,
    productCode: COMMERCIAL_CONTRACT.productCode,
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: COMMERCIAL_CONTRACT.releasesPerPack,
    releasesCount: 0,
    releasesList: [],
    scopeCaseId: params.caseId,
    createdAt: params.now,
    updatedAt: params.now,
  });
  transaction.create(idempotencyRef, {
    uid: params.uid,
    caseId: params.caseId,
    requestId: params.requestId,
    entitlementId,
    creditsConsumed: COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    releasesGranted: COMMERCIAL_CONTRACT.releasesPerPack,
    processedAt: params.now,
  });

  return {
    entitlementId,
    releasesGranted: COMMERCIAL_CONTRACT.releasesPerPack,
    creditsConsumed: COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    balanceAfter,
    idempotentReplay: false,
  };
}
