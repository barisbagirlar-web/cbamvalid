import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

async function requireAdmin(auth: { token?: Record<string, unknown> }): Promise<void> {
  if (auth.token?.admin === true || auth.token?.ownerAdmin === true) {
    return;
  }
  // Production-smoke UID must NEVER satisfy requireAdmin (no general admin capability).
  throw new HttpsError("permission-denied", "Requires administrator privileges.");
}

export const listAllUsers = createCallable({
  schema: z.object({
    limit: z.number().max(500).nullish().transform(v => v ?? 100),
    pageToken: z.string().optional()
  }).optional()
}, async (data, { auth }) => {
  await requireAdmin(auth);

  const query = adminDb.collection("users").orderBy("email").limit(data?.limit || 100);
  
  if (data?.pageToken) {
    // Basic pagination mock (replace with real document reference in production)
    // For simplicity, we assume we just return the first set.
  }

  const snapshot = await query.get();
  const users = await Promise.all(snapshot.docs.map(async (doc) => {
    const profile = doc.data();
    const creditSnap = await adminDb.collection("users").doc(doc.id).collection("creditSummary").doc("current").get();
    const credits = creditSnap.exists ? creditSnap.data() : { availableCredits: 0 };

    return {
      id: doc.id,
      email: profile.email || "",
      displayName: profile.displayName || "",
      credits: credits?.availableCredits || 0,
      role: profile.role || "user"
    };
  }));

  return { users };
});

export const listAllTransactions = createCallable({
  schema: z.object({
    limit: z.number().max(500).nullish().transform(v => v ?? 100)
  }).optional()
}, async (data, { auth }) => {
  await requireAdmin(auth);
  const { toCustomerPurchaseRecord } = await import("../commerce/purchase-history");
  const limitCount = data?.limit || 100;

  try {
    const snapshot = await adminDb
      .collection("commerce_orders")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    return {
      transactions: snapshot.docs.map((doc) => ({
        ...toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>),
        uid: String((doc.data() as { uid?: string }).uid || ""),
      })),
    };
  } catch (error) {
    console.warn("listAllTransactions orderBy fallback", error);
    const snapshot = await adminDb.collection("commerce_orders").limit(limitCount).get();
    const rows = snapshot.docs
      .map((doc) => ({
        ...toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>),
        uid: String((doc.data() as { uid?: string }).uid || ""),
      }))
      .sort((a, b) => Date.parse(b.occurredAt || "0") - Date.parse(a.occurredAt || "0"));
    return { transactions: rows };
  }
});

export const adminSetUserTokens = createCallable({
  schema: z.object({
    targetUserId: z.string(),
    tokensToSet: z.number()
  })
}, async ({ targetUserId, tokensToSet }, { auth }) => {
  await requireAdmin(auth);

  const creditRef = adminDb.collection("users").doc(targetUserId).collection("creditSummary").doc("current");
  const ledgerRef = adminDb.collection("users").doc(targetUserId).collection("creditLedger").doc();

  await adminDb.runTransaction(async (t) => {
    const doc = await t.get(creditRef);
    let currentCredits = 0;
    if (doc.exists) {
      currentCredits = doc.data()?.availableCredits || 0;
    }

    const diff = tokensToSet - currentCredits;
    if (diff === 0) return;

    t.set(creditRef, {
      availableCredits: tokensToSet,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    t.set(ledgerRef, {
      amount: diff,
      type: diff > 0 ? "ADMIN_ADJUSTMENT_ADD" : "ADMIN_ADJUSTMENT_SUBTRACT",
      createdAt: new Date().toISOString(),
      balanceAfter: tokensToSet,
      reason: `Manual adjustment by admin ${auth.token.email}`
    });
  });

  return { success: true };
});
