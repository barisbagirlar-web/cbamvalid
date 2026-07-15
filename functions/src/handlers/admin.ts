import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { normalizeCreditSummary, type CreditLedgerEntry } from "../commerce/credit-service";
import { adminDb } from "../firebase-admin";
import { validateIdentifier } from "../firestore-validator";
import { createCallable } from "../wrapper";

type AdminAuth = {
  uid: string;
  token: {
    admin?: unknown;
    ownerAdmin?: unknown;
    email_verified?: unknown;
    email?: unknown;
  };
};

function requireAdmin(auth: AdminAuth): void {
  if (
    auth.token.admin !== true ||
    auth.token.ownerAdmin !== true ||
    auth.token.email_verified !== true
  ) {
    throw new HttpsError("permission-denied", "Verified owner-administrator privileges are required.");
  }
}

function encodeCursor(email: string, id: string): string {
  return Buffer.from(JSON.stringify({ email, id }), "utf8").toString("base64url");
}

function decodeCursor(value: string): { email: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.email !== "string" || typeof parsed.id !== "string") throw new Error("INVALID_CURSOR");
    validateIdentifier("uid", parsed.id);
    return { email: parsed.email, id: parsed.id };
  } catch {
    throw new HttpsError("invalid-argument", "Invalid user pagination cursor.");
  }
}

export const listAllUsers = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(50),
    pageToken: z.string().max(1024).optional(),
  }).strict().optional(),
}, async (data, { auth }) => {
  requireAdmin(auth);
  const limit = data?.limit || 50;
  let query = adminDb.collection("users")
    .orderBy("email", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(limit + 1);
  if (data?.pageToken) {
    const cursor = decodeCursor(data.pageToken);
    query = query.startAfter(cursor.email, cursor.id);
  }

  const snapshot = await query.get();
  const pageDocs = snapshot.docs.slice(0, limit);
  const users = await Promise.all(pageDocs.map(async (document) => {
    const profile = document.data() as Record<string, unknown>;
    const creditSnapshot = await adminDb.collection("users").doc(document.id)
      .collection("creditSummary").doc("current").get();
    const credits = normalizeCreditSummary(creditSnapshot.exists ? creditSnapshot.data() : undefined);
    return {
      id: document.id,
      email: typeof profile.email === "string" ? profile.email : "",
      displayName: typeof profile.displayName === "string" ? profile.displayName : "",
      company: typeof profile.company === "string" ? profile.company : "",
      credits: credits.availableCredits,
      createdAt: typeof profile.createdAt === "string" ? profile.createdAt : "",
      role: typeof profile.role === "string" ? profile.role : "user",
    };
  }));
  const last = pageDocs.at(-1);
  const nextPageToken = snapshot.docs.length > limit && last
    ? encodeCursor(String(last.data().email || ""), last.id)
    : undefined;
  return { users, nextPageToken };
});

export const listAllTransactions = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  }).strict().optional(),
}, async (data, { auth }) => {
  requireAdmin(auth);
  const snapshot = await adminDb.collection("commerce_orders")
    .orderBy("createdAt", "desc")
    .limit(data?.limit || 50)
    .get();
  const transactions = snapshot.docs.map((document) => {
    const order = document.data() as Record<string, unknown>;
    return {
      orderId: document.id,
      uid: String(order.uid || ""),
      productCode: String(order.productCode || ""),
      status: String(order.status || ""),
      currency: String(order.currency || ""),
      amountMinor: Number(order.amountMinor || 0),
      paddleTransactionId: typeof order.paddleTransactionId === "string"
        ? order.paddleTransactionId
        : undefined,
      createdAt: String(order.createdAt || ""),
      updatedAt: String(order.updatedAt || ""),
    };
  });
  return { transactions };
});

export const adminSetUserTokens = createCallable({
  schema: z.object({
    targetUserId: z.string().min(1).max(256),
    tokensToSet: z.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(10).max(500).optional().default("Owner administrator absolute credit correction"),
  }).strict(),
}, async ({ targetUserId, tokensToSet, reason }, { auth }) => {
  requireAdmin(auth);
  validateIdentifier("uid", targetUserId);

  const summaryRef = adminDb.collection("users").doc(targetUserId)
    .collection("creditSummary").doc("current");
  const ledgerRef = adminDb.collection("users").doc(targetUserId)
    .collection("creditLedger").doc();
  const auditRef = adminDb.collection("admin_audit").doc();

  const result = await adminDb.runTransaction(async (transaction) => {
    const summarySnapshot = await transaction.get(summaryRef);
    const current = normalizeCreditSummary(summarySnapshot.exists ? summarySnapshot.data() : undefined);
    const difference = tokensToSet - current.availableCredits;
    if (difference === 0) {
      return { changed: false, balanceAfter: current.availableCredits, ledgerEntryId: null };
    }

    const now = new Date().toISOString();
    const nextSummary = {
      ...current,
      availableCredits: tokensToSet,
      lifetimeAdjusted: current.lifetimeAdjusted + Math.abs(difference),
      updatedAt: now,
    };
    const ledgerEntry: CreditLedgerEntry = {
      entryId: ledgerRef.id,
      uid: targetUserId,
      amount: difference,
      type: "ADMIN_ADJUSTMENT",
      reason,
      createdAt: now,
      balanceAfter: tokensToSet,
    };

    transaction.set(summaryRef, nextSummary, { merge: true });
    transaction.create(ledgerRef, ledgerEntry);
    transaction.create(auditRef, {
      auditId: auditRef.id,
      actorUid: auth.uid,
      actorEmail: typeof auth.token.email === "string" ? auth.token.email : "",
      action: "SET_USER_CREDIT_BALANCE",
      targetUid: targetUserId,
      previousBalance: current.availableCredits,
      balanceAfter: tokensToSet,
      difference,
      reason,
      createdAt: now,
    });
    return { changed: true, balanceAfter: tokensToSet, ledgerEntryId: ledgerRef.id };
  });

  return { success: true as const, ...result };
});
