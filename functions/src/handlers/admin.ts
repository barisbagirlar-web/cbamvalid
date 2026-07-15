import { createCallable } from "../wrapper";
import { z } from "zod";
import { adminDb } from "../firebase-admin";
import { requireOwnerSuperAdmin } from "../auth/owner-admin";
import { adjustCredits } from "../commerce/credit-service";

export const listAllUsers = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(500).nullish().transform((value) => value ?? 100),
  }).optional(),
}, async (data, { auth }) => {
  requireOwnerSuperAdmin(auth);
  const snapshot = await adminDb.collection("users").orderBy("email").limit(data?.limit || 100).get();
  const users = await Promise.all(snapshot.docs.map(async (document) => {
    const profile = document.data() as Record<string, unknown>;
    const creditSnapshot = await adminDb.collection("users").doc(document.id).collection("creditSummary").doc("current").get();
    const creditData = creditSnapshot.exists ? creditSnapshot.data() as Record<string, unknown> : {};
    const availableCredits = Number(creditData.availableCredits || 0);
    return {
      id: document.id,
      email: typeof profile.email === "string" ? profile.email : "",
      displayName: typeof profile.displayName === "string" ? profile.displayName : "",
      credits: Number.isSafeInteger(availableCredits) && availableCredits >= 0 ? availableCredits : 0,
      role: typeof profile.role === "string" ? profile.role : "user",
    };
  }));
  return { users };
});

export const listAllTransactions = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(500).nullish().transform((value) => value ?? 100),
  }).optional(),
}, async (data, { auth }) => {
  requireOwnerSuperAdmin(auth);
  const snapshot = await adminDb.collection("paddle_events")
    .orderBy("occurredAt", "desc")
    .limit(data?.limit || 100)
    .get();
  return { transactions: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) };
});

export const adminAdjustUserCredits = createCallable({
  schema: z.object({
    targetUserId: z.string().trim().min(1).max(128),
    amount: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
    reason: z.string().trim().min(10).max(500),
    requestId: z.string().uuid(),
  }),
}, async ({ targetUserId, amount, reason, requestId }, { auth }) => {
  requireOwnerSuperAdmin(auth);
  const summary = await adminDb.runTransaction((transaction) => adjustCredits(transaction, {
    uid: targetUserId,
    amount,
    reason,
    actorUid: auth.uid,
    requestId,
  }));
  return { success: true as const, availableCredits: summary.availableCredits };
});

export const adminSetUserTokens = createCallable({
  schema: z.object({
    targetUserId: z.string().trim().min(1).max(128),
    tokensToSet: z.number().int().min(0).max(10_000),
  }),
}, async () => {
  throw new Error("LEGACY_ABSOLUTE_CREDIT_SETTER_DISABLED");
});
