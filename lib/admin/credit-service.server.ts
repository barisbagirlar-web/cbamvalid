import "server-only";
import { adminDb } from "@/lib/firebase/admin";

function requestId(value: string): string {
  const normalized = value.trim();
  if (!/^[0-9a-f-]{36}$/i.test(normalized)) throw new Error("ADMIN_REQUEST_ID_INVALID");
  return normalized;
}

function positiveCredits(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 10_000) {
    throw new Error("ADMIN_CREDIT_AMOUNT_INVALID");
  }
  return value;
}

function reasonText(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 10 || normalized.length > 500) throw new Error("ADMIN_REASON_INVALID");
  return normalized;
}

export async function grantAccountCredits(params: {
  uid: string;
  amount: number;
  reason: string;
  actorUid: string;
  requestId: string;
}) {
  const amount = positiveCredits(params.amount);
  const reason = reasonText(params.reason);
  const id = `admin_grant_${requestId(params.requestId)}`;
  return adminDb.runTransaction(async (transaction) => {
    const summaryRef = adminDb.doc(`users/${params.uid}/creditSummary/current`);
    const ledgerRef = adminDb.doc(`users/${params.uid}/creditLedger/${id}`);
    const [summarySnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(ledgerRef),
    ]);
    if (ledgerSnapshot.exists) {
      const existing = ledgerSnapshot.data() as Record<string, unknown>;
      if (existing.amount !== amount || existing.reason !== reason || existing.actorUid !== params.actorUid) {
        throw new Error("ADMIN_GRANT_IDEMPOTENCY_COLLISION");
      }
      return { transactionId: id, balanceAfter: Number(existing.balanceAfter), idempotent: true };
    }
    const current = Number(summarySnapshot.data()?.availableCredits || 0);
    if (!Number.isSafeInteger(current) || current < 0) throw new Error("CREDIT_SUMMARY_INVALID");
    const balanceAfter = current + amount;
    if (!Number.isSafeInteger(balanceAfter)) throw new Error("CREDIT_BALANCE_OVERFLOW");
    const now = new Date().toISOString();
    transaction.set(summaryRef, {
      availableCredits: balanceAfter,
      lifetimeAdjusted: Number(summarySnapshot.data()?.lifetimeAdjusted || 0) + amount,
      updatedAt: now,
    }, { merge: true });
    transaction.create(ledgerRef, {
      uid: params.uid,
      type: "ADMIN_ADJUSTMENT_ADD",
      amount,
      reason,
      actorUid: params.actorUid,
      requestId: params.requestId,
      createdAt: now,
      balanceAfter,
    });
    return { transactionId: id, balanceAfter, idempotent: false };
  });
}

export async function reverseAccountCreditGrant(params: {
  uid: string;
  amount: number;
  originalTransactionId: string;
  reason: string;
  actorUid: string;
  requestId: string;
}) {
  const amount = positiveCredits(params.amount);
  const reason = reasonText(params.reason);
  if (!/^admin_grant_[0-9a-f-]{36}$/i.test(params.originalTransactionId)) {
    throw new Error("ORIGINAL_GRANT_ID_INVALID");
  }
  const reversalId = `admin_reversal_${requestId(params.requestId)}`;
  return adminDb.runTransaction(async (transaction) => {
    const summaryRef = adminDb.doc(`users/${params.uid}/creditSummary/current`);
    const originalRef = adminDb.doc(`users/${params.uid}/creditLedger/${params.originalTransactionId}`);
    const reversalRef = adminDb.doc(`users/${params.uid}/creditLedger/${reversalId}`);
    const markerRef = adminDb.doc(`admin_credit_reversals/${params.originalTransactionId}`);
    const [summarySnapshot, originalSnapshot, reversalSnapshot, markerSnapshot] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(originalRef),
      transaction.get(reversalRef),
      transaction.get(markerRef),
    ]);
    if (!originalSnapshot.exists) throw new Error("ORIGINAL_GRANT_NOT_FOUND");
    const original = originalSnapshot.data() as Record<string, unknown>;
    if (original.type !== "ADMIN_ADJUSTMENT_ADD" || original.amount !== amount) {
      throw new Error("REVERSAL_MUST_MATCH_ORIGINAL_GRANT");
    }
    if (markerSnapshot.exists) {
      if (!reversalSnapshot.exists || markerSnapshot.data()?.reversalId !== reversalId) {
        throw new Error("ADMIN_REVERSAL_PARTIAL_STATE");
      }
      return { reversalId, balanceAfter: Number(reversalSnapshot.data()?.balanceAfter), idempotent: true };
    }
    if (reversalSnapshot.exists) throw new Error("ADMIN_REVERSAL_ORPHAN_RECORD");
    const current = Number(summarySnapshot.data()?.availableCredits || 0);
    if (!Number.isSafeInteger(current) || current < amount) throw new Error("ADMIN_REVERSAL_INSUFFICIENT_BALANCE");
    const balanceAfter = current - amount;
    const now = new Date().toISOString();
    transaction.set(summaryRef, {
      availableCredits: balanceAfter,
      lifetimeAdjusted: Number(summarySnapshot.data()?.lifetimeAdjusted || 0) + amount,
      updatedAt: now,
    }, { merge: true });
    transaction.create(reversalRef, {
      uid: params.uid,
      type: "ADMIN_ADJUSTMENT_SUBTRACT",
      amount: -amount,
      originalTransactionId: params.originalTransactionId,
      reason,
      actorUid: params.actorUid,
      requestId: params.requestId,
      createdAt: now,
      balanceAfter,
    });
    transaction.create(markerRef, {
      uid: params.uid,
      originalTransactionId: params.originalTransactionId,
      reversalId,
      amount,
      createdAt: now,
    });
    return { reversalId, balanceAfter, idempotent: false };
  });
}
