import { createCallable } from "../wrapper";
import { z } from "zod";
import { adminDb } from "../firebase-admin";
import {
  CREDIT_LEDGER_COLLECTION,
  LEGACY_CREDIT_LEDGER_COLLECTION,
  mergeCreditLedgerEntries,
  normalizeCreditLedgerEntry,
} from "../commerce/credit-ledger";

export const getAccountOverview = createCallable({}, async (_, { auth }) => {
  const uid = auth.uid;

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
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.country !== undefined) updateData.country = data.country;

  await adminDb.collection("users").doc(uid).set(updateData, { merge: true });
  return { success: true };
});

export const listCreditLedger = createCallable({
  schema: z.object({
    limit: z.number().max(100).nullish().transform(v => v ?? 50)
  }).optional()
}, async (data, { auth }) => {
  const limitCount = data?.limit || 50;
  const userRef = adminDb.collection("users").doc(auth.uid);

  const [primarySnap, legacySnap] = await Promise.all([
    userRef.collection(CREDIT_LEDGER_COLLECTION).orderBy("createdAt", "desc").limit(limitCount).get(),
    userRef.collection(LEGACY_CREDIT_LEDGER_COLLECTION).orderBy("createdAt", "desc").limit(limitCount).get(),
  ]);

  const primary = primarySnap.docs.map((document) =>
    normalizeCreditLedgerEntry(
      document.id,
      document.data() as Record<string, unknown>,
      CREDIT_LEDGER_COLLECTION
    )
  );
  const legacy = legacySnap.docs.map((document) =>
    normalizeCreditLedgerEntry(
      document.id,
      document.data() as Record<string, unknown>,
      LEGACY_CREDIT_LEDGER_COLLECTION
    )
  );

  return {
    ledger: mergeCreditLedgerEntries(primary, legacy).slice(0, limitCount),
  };
});

export const listPurchaseHistory = createCallable({
  schema: z.object({
    limit: z.number().max(100).nullish().transform(v => v ?? 50)
  }).optional()
}, async (data, { auth }) => {
  const limitCount = data?.limit || 50;
  try {
    const snapshot = await adminDb.collection("paddle_events")
      .where("uid", "==", auth.uid)
      .orderBy("occurredAt", "desc")
      .limit(limitCount)
      .get();

    return { history: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    // Missing composite index or empty collection must not zero the account overview.
    console.error("listPurchaseHistory failed", error);
    return { history: [] };
  }
});

export const requestAccountClosure = createCallable({}, async (_, { auth }) => {
  const uid = auth.uid;
  await adminDb.collection("account_closures").doc(uid).set({
    uid,
    email: auth.token.email,
    requestedAt: new Date().toISOString(),
    status: "PENDING"
  });
  return { success: true };
});
