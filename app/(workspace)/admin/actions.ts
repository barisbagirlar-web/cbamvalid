"use server";

import crypto from "node:crypto";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

type CreditSummary = {
  availableCredits: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  lifetimeAdjusted: number;
  lifetimeRefunded: number;
  updatedAt: string;
};

function safeInteger(value: unknown, field: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`INVALID_CREDIT_SUMMARY:${field}`);
  return parsed;
}

function normalizeSummary(value: unknown): CreditSummary {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    availableCredits: safeInteger(source.availableCredits, "availableCredits"),
    lifetimePurchased: safeInteger(source.lifetimePurchased, "lifetimePurchased"),
    lifetimeConsumed: safeInteger(source.lifetimeConsumed, "lifetimeConsumed"),
    lifetimeAdjusted: safeInteger(source.lifetimeAdjusted, "lifetimeAdjusted"),
    lifetimeRefunded: safeInteger(source.lifetimeRefunded, "lifetimeRefunded"),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date(0).toISOString(),
  };
}

function validateUid(uid: string): string {
  const clean = uid.trim();
  if (!/^[A-Za-z0-9:_-]{1,256}$/.test(clean)) throw new Error("INVALID_TARGET_UID");
  return clean;
}

function validateAdjustment(amount: number, reason: string, requestId: string): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000) throw new Error("INVALID_CREDIT_AMOUNT");
  if (reason.trim().length < 10 || reason.trim().length > 500) throw new Error("INVALID_ADJUSTMENT_REASON");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("INVALID_ADMIN_REQUEST_ID");
}

function isoDate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") return toDate().toISOString();
  }
  return null;
}

export async function fetchAllUsers() {
  await requireSuperAdmin();
  const usersSnapshot = await adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get();
  const creditRefs = usersSnapshot.docs.map((document) =>
    adminDb.collection("users").doc(document.id).collection("creditSummary").doc("current")
  );
  const creditSnapshots = creditRefs.length ? await adminDb.getAll(...creditRefs) : [];
  const creditByUid = new Map(creditSnapshots.map((snapshot) => [snapshot.ref.parent.parent?.id || "", normalizeSummary(snapshot.exists ? snapshot.data() : undefined)]));

  return usersSnapshot.docs.map((document) => {
    const data = document.data() as Record<string, unknown>;
    return {
      id: document.id,
      email: typeof data.email === "string" ? data.email : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      company: typeof data.company === "string" ? data.company : "",
      credits: creditByUid.get(document.id)?.availableCredits || 0,
      createdAt: isoDate(data.createdAt),
      role: typeof data.role === "string" ? data.role : "user",
    };
  });
}

export async function fetchUserDetails(uid: string) {
  await requireSuperAdmin();
  const targetUid = validateUid(uid);
  const [userRecord, userDocument, creditSnapshot, holdSnapshot, entitlementSnapshot] = await Promise.all([
    adminAuth.getUser(targetUid).catch(() => null),
    adminDb.collection("users").doc(targetUid).get(),
    adminDb.collection("users").doc(targetUid).collection("creditSummary").doc("current").get(),
    adminDb.collection("users").doc(targetUid).collection("commerceHold").doc("current").get(),
    adminDb.collection("entitlements").where("uid", "==", targetUid).get(),
  ]);
  if (!userRecord) throw new Error("USER_NOT_FOUND");

  return {
    auth: {
      uid: userRecord.uid,
      email: userRecord.email || "",
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
      customClaims: userRecord.customClaims || {},
    },
    profile: userDocument.data() || {},
    credits: normalizeSummary(creditSnapshot.exists ? creditSnapshot.data() : undefined),
    commerceHold: holdSnapshot.exists ? holdSnapshot.data() : { active: false },
    entitlementCount: entitlementSnapshot.size,
  };
}

export async function grantCredits(uid: string, amount: number, reason: string, requestId: string) {
  const adminClaims = await requireSuperAdmin();
  const targetUid = validateUid(uid);
  validateAdjustment(amount, reason, requestId);

  const summaryRef = adminDb.collection("users").doc(targetUid).collection("creditSummary").doc("current");
  const markerRef = adminDb.collection("admin_idempotency").doc(`grant_${requestId}`);
  const ledgerRef = adminDb.collection("users").doc(targetUid).collection("creditLedger").doc(`admin_grant_${requestId}`);
  const auditRef = adminDb.collection("admin_audit").doc(`grant_${requestId}`);

  const result = await adminDb.runTransaction(async (transaction) => {
    const [summarySnapshot, markerSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(markerRef),
      transaction.get(ledgerRef),
    ]);
    const current = normalizeSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);
    if (markerSnapshot.exists) {
      const marker = markerSnapshot.data() as Record<string, unknown>;
      if (marker.targetUid !== targetUid || marker.amount !== amount || marker.reason !== reason.trim() || !ledgerSnapshot.exists) {
        throw new Error("ADMIN_GRANT_IDEMPOTENCY_COLLISION");
      }
      return { transactionId: ledgerRef.id, balanceAfter: current.availableCredits, idempotentReplay: true };
    }
    if (ledgerSnapshot.exists) throw new Error("ADMIN_GRANT_PARTIAL_STATE");

    const balanceAfter = current.availableCredits + amount;
    if (!Number.isSafeInteger(balanceAfter)) throw new Error("CREDIT_BALANCE_OVERFLOW");
    const now = new Date().toISOString();
    transaction.set(summaryRef, {
      ...current,
      availableCredits: balanceAfter,
      lifetimeAdjusted: current.lifetimeAdjusted + amount,
      updatedAt: now,
    }, { merge: true });
    transaction.create(ledgerRef, {
      entryId: ledgerRef.id,
      uid: targetUid,
      amount,
      type: "ADMIN_ADJUSTMENT",
      reason: reason.trim(),
      createdAt: now,
      balanceAfter,
      adminRequestId: requestId,
      actorUid: adminClaims.uid,
    });
    transaction.create(markerRef, {
      requestId,
      targetUid,
      amount,
      reason: reason.trim(),
      ledgerEntryId: ledgerRef.id,
      processedAt: now,
    });
    transaction.create(auditRef, {
      auditId: auditRef.id,
      actorUid: adminClaims.uid,
      actorEmail: adminClaims.email || "",
      action: "GRANT_CREDITS",
      targetUid,
      amount,
      reason: reason.trim(),
      balanceBefore: current.availableCredits,
      balanceAfter,
      createdAt: now,
    });
    return { transactionId: ledgerRef.id, balanceAfter, idempotentReplay: false };
  });

  return { success: true as const, ...result };
}

export async function reverseCreditGrant(
  uid: string,
  amount: number,
  originalTransactionId: string,
  reason: string,
  requestId: string
) {
  const adminClaims = await requireSuperAdmin();
  const targetUid = validateUid(uid);
  validateAdjustment(amount, reason, requestId);
  if (!/^admin_grant_[0-9a-f-]{36}$/i.test(originalTransactionId)) throw new Error("INVALID_ORIGINAL_TRANSACTION_ID");

  const summaryRef = adminDb.collection("users").doc(targetUid).collection("creditSummary").doc("current");
  const originalRef = adminDb.collection("users").doc(targetUid).collection("creditLedger").doc(originalTransactionId);
  const markerRef = adminDb.collection("admin_idempotency").doc(`reversal_${requestId}`);
  const reversalRef = adminDb.collection("users").doc(targetUid).collection("creditLedger").doc(`admin_reversal_${requestId}`);
  const auditRef = adminDb.collection("admin_audit").doc(`reversal_${requestId}`);

  const result = await adminDb.runTransaction(async (transaction) => {
    const [summarySnapshot, originalSnapshot, markerSnapshot, reversalSnapshot, priorReversals] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(originalRef),
      transaction.get(markerRef),
      transaction.get(reversalRef),
      transaction.get(adminDb.collection("users").doc(targetUid).collection("creditLedger").where("originalTransactionId", "==", originalTransactionId)),
    ]);
    if (!originalSnapshot.exists) throw new Error("ORIGINAL_GRANT_NOT_FOUND");
    const original = originalSnapshot.data() as Record<string, unknown>;
    if (original.type !== "ADMIN_ADJUSTMENT" || Number(original.amount) <= 0 || original.uid !== targetUid) {
      throw new Error("ORIGINAL_GRANT_INVALID");
    }
    const current = normalizeSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);
    if (markerSnapshot.exists) {
      const marker = markerSnapshot.data() as Record<string, unknown>;
      if (marker.targetUid !== targetUid || marker.amount !== amount || marker.originalTransactionId !== originalTransactionId || !reversalSnapshot.exists) {
        throw new Error("ADMIN_REVERSAL_IDEMPOTENCY_COLLISION");
      }
      return { reversalId: reversalRef.id, balanceAfter: current.availableCredits, idempotentReplay: true };
    }
    if (reversalSnapshot.exists) throw new Error("ADMIN_REVERSAL_PARTIAL_STATE");

    const alreadyReversed = priorReversals.docs.reduce((sum, document) => {
      const value = Number(document.data().reversedAmount || 0);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error("REVERSAL_LEDGER_INVALID");
      return sum + value;
    }, 0);
    const originalAmount = Number(original.amount);
    if (alreadyReversed + amount > originalAmount) throw new Error("REVERSAL_EXCEEDS_ORIGINAL_GRANT");
    if (current.availableCredits < amount) throw new Error("REVERSAL_WOULD_CREATE_NEGATIVE_BALANCE");

    const balanceAfter = current.availableCredits - amount;
    const now = new Date().toISOString();
    transaction.set(summaryRef, {
      ...current,
      availableCredits: balanceAfter,
      lifetimeAdjusted: current.lifetimeAdjusted + amount,
      updatedAt: now,
    }, { merge: true });
    transaction.create(reversalRef, {
      entryId: reversalRef.id,
      uid: targetUid,
      amount: -amount,
      reversedAmount: amount,
      type: "ADMIN_ADJUSTMENT",
      reason: reason.trim(),
      originalTransactionId,
      createdAt: now,
      balanceAfter,
      adminRequestId: requestId,
      actorUid: adminClaims.uid,
    });
    transaction.create(markerRef, {
      requestId,
      targetUid,
      amount,
      originalTransactionId,
      reason: reason.trim(),
      ledgerEntryId: reversalRef.id,
      processedAt: now,
    });
    transaction.create(auditRef, {
      auditId: auditRef.id,
      actorUid: adminClaims.uid,
      actorEmail: adminClaims.email || "",
      action: "REVERSE_CREDITS",
      targetUid,
      amount,
      originalTransactionId,
      reason: reason.trim(),
      balanceBefore: current.availableCredits,
      balanceAfter,
      createdAt: now,
    });
    return { reversalId: reversalRef.id, balanceAfter, idempotentReplay: false };
  });

  return { success: true as const, ...result };
}

export async function fetchSystemMetrics() {
  await requireSuperAdmin();
  const [usersAggregate, reportsAggregate, ordersSnapshot, holdsAggregate] = await Promise.all([
    adminDb.collection("users").count().get(),
    adminDb.collection("cbam_reports").where("status", "==", "SEALED").count().get(),
    adminDb.collection("commerce_orders").where("status", "in", ["CREDITS_GRANTED", "REFUNDED_UNUSED", "REFUNDED_AFTER_DELIVERY"]).get(),
    adminDb.collectionGroup("commerceHold").where("active", "==", true).count().get(),
  ]);
  const collectedRevenueMinor = ordersSnapshot.docs.reduce((sum, document) => {
    const order = document.data() as Record<string, unknown>;
    if (order.status !== "CREDITS_GRANTED") return sum;
    const amountMinor = Number(order.amountMinor || 0);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error(`INVALID_ORDER_AMOUNT:${document.id}`);
    return sum + amountMinor;
  }, 0);

  return {
    totalUsers: usersAggregate.data().count,
    sealedReports: reportsAggregate.data().count,
    collectedRevenueMinor,
    activeCommerceHolds: holdsAggregate.data().count,
  };
}
