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
      organisationId: typeof profile?.organisationId === "string" ? profile.organisationId : "",
      role: String(profile?.role ?? "").toUpperCase(),
      email: auth.token.email,
      emailVerified: auth.token.email_verified || false,
    },
    credits
  };
});

const OrganisationIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/, "Only letters, numbers and dashes are allowed.")
  .optional()
  .or(z.literal(""));

export const updateOwnProfile = createCallable({
  schema: z.object({
    displayName: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    country: z.string().max(100).optional(),
    organisationId: OrganisationIdSchema
  })
}, async (data, { auth }) => {
  const uid = auth.uid;
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.country !== undefined) updateData.country = data.country;
  if (data.organisationId !== undefined) {
    updateData.organisationId = data.organisationId === "" ? "" : data.organisationId.trim();
  }

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
  const { toCustomerPurchaseRecord } = await import("../commerce/purchase-history");
  try {
    // commerce_orders is the fulfillment SSOT (confirm path + webhook).
    // paddle_events has no uid field and is often empty when confirm fulfilled first.
    let history: ReturnType<typeof toCustomerPurchaseRecord>[] = [];
    try {
      const snapshot = await adminDb
        .collection("commerce_orders")
        .where("uid", "==", auth.uid)
        .orderBy("createdAt", "desc")
        .limit(limitCount)
        .get();
      history = snapshot.docs.map((doc) =>
        toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>)
      );
    } catch (indexError) {
      console.warn("listPurchaseHistory orderBy fallback", indexError);
      const snapshot = await adminDb
        .collection("commerce_orders")
        .where("uid", "==", auth.uid)
        .limit(Math.min(limitCount * 3, 150))
        .get();
      history = [...snapshot.docs]
        .sort((a, b) => {
          const aTime = Date.parse(String(a.data().createdAt || a.data().updatedAt || 0)) || 0;
          const bTime = Date.parse(String(b.data().createdAt || b.data().updatedAt || 0)) || 0;
          return bTime - aTime;
        })
        .slice(0, limitCount)
        .map((doc) => toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>));
    }

    return { history };
  } catch (error) {
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
