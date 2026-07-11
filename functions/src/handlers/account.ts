import { createCallable } from "../wrapper";
import { z } from "zod";
import { adminDb } from "@/firebase-admin";

export const getAccountOverview = createCallable({}, async (_, { auth }) => {
  const uid = auth.uid;

  // 1. Fetch user profile and auth data securely
  const [profileSnap, creditSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("users").doc(uid).collection("creditSummary").doc("current").get()
  ]);

  const profile = profileSnap.exists ? profileSnap.data() : { email: auth.token.email };
  const credits = creditSnap.exists ? creditSnap.data() : {
    availableCredits: 0,
    lifetimePurchased: 0,
    lifetimeConsumed: 0,
    lifetimeAdjusted: 0,
    lifetimeRefunded: 0
  };

  return {
    profile: {
      displayName: profile?.displayName || "",
      company: profile?.company || "",
      country: profile?.country || "",
      email: auth.token.email,
      emailVerified: auth.token.email_verified || false,
    },
    credits
  };
});

export const updateOwnProfile = createCallable({
  schema: z.object({
    displayName: z.string().optional(),
    company: z.string().optional(),
    country: z.string().optional()
  })
}, async (data, { auth }) => {
  const uid = auth.uid;
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.country !== undefined) updateData.country = data.country;

  await adminDb.collection("users").doc(uid).set(updateData, { merge: true });
  return { success: true };
});

export const listCreditLedger = createCallable({
  schema: z.object({
    limit: z.number().max(100).default(50)
  }).optional()
}, async (data, { auth }) => {
  const limitCount = data?.limit || 50;
  const snapshot = await adminDb.collection("users").doc(auth.uid)
    .collection("creditLedger")
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();

  return { ledger: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
});

export const listPurchaseHistory = createCallable({
  schema: z.object({
    limit: z.number().max(100).default(50)
  }).optional()
}, async (data, { auth }) => {
  const limitCount = data?.limit || 50;
  const snapshot = await adminDb.collection("paddle_events")
    .where("uid", "==", auth.uid)
    .orderBy("occurredAt", "desc")
    .limit(limitCount)
    .get();

  return { history: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
});

export const requestAccountClosure = createCallable({}, async (_, { auth }) => {
  const uid = auth.uid;
  // Create an explicit closure request record that an admin can review
  await adminDb.collection("account_closures").doc(uid).set({
    uid,
    email: auth.token.email,
    requestedAt: new Date().toISOString(),
    status: "PENDING"
  });
  return { success: true };
});
