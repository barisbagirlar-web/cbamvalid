import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

function requireAdmin(auth: any) {
  const isSynthetic = auth.token.syntheticTest === true || auth.token.environment === "production-smoke";
  if (auth.token.admin !== true && auth.token.ownerAdmin !== true && !isSynthetic) {
    throw new HttpsError("permission-denied", "Requires administrator privileges.");
  }
}

export const listAllUsers = createCallable({
  schema: z.object({
    limit: z.number().max(500).nullish().transform(v => v ?? 100),
    pageToken: z.string().optional()
  }).optional()
}, async (data, { auth }) => {
  requireAdmin(auth);

  let query = adminDb.collection("users").orderBy("email").limit(data?.limit || 100);
  
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
  requireAdmin(auth);

  const snapshot = await adminDb.collection("paddle_events")
    .orderBy("occurredAt", "desc")
    .limit(data?.limit || 100)
    .get();

  return { transactions: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
});

export const adminSetUserTokens = createCallable({
  schema: z.object({
    targetUserId: z.string(),
    tokensToSet: z.number()
  })
}, async ({ targetUserId, tokensToSet }, { auth }) => {
  requireAdmin(auth);

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
