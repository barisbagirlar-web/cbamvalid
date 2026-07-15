import { z } from "zod";
import { createCallable } from "../wrapper";
import { adminDb } from "../firebase-admin";
import { COMMERCIAL_CONTRACT } from "../commerce/commercial-contract";
import { normalizeCreditSummary, type CreditLedgerEntry } from "../commerce/credit-service";
import type { CommerceOrder } from "../commerce/order-service";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const getAccountOverview = createCallable({}, async (_, { auth }) => {
  const uid = auth.uid;
  const [profileSnapshot, creditSnapshot, holdSnapshot, entitlementSnapshot] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("users").doc(uid).collection("creditSummary").doc("current").get(),
    adminDb.collection("users").doc(uid).collection("commerceHold").doc("current").get(),
    adminDb.collection("entitlements").where("uid", "==", uid).get(),
  ]);
  const profile = object(profileSnapshot.data());
  const credits = normalizeCreditSummary(creditSnapshot.exists ? creditSnapshot.data() : undefined);
  const hold = object(holdSnapshot.data());
  const activePacks = entitlementSnapshot.docs
    .map((document) => object(document.data()))
    .filter((entry) =>
      entry.productCode === COMMERCIAL_CONTRACT.productCode &&
      ["AVAILABLE", "RESERVED"].includes(string(entry.status)) &&
      Number(entry.releasesCount || 0) < COMMERCIAL_CONTRACT.releasesPerPack
    );
  const releasesRemaining = activePacks.reduce((sum, entry) => {
    const releasesCount = Number(entry.releasesCount || 0);
    return sum + Math.max(0, COMMERCIAL_CONTRACT.releasesPerPack - releasesCount);
  }, 0);

  return {
    profile: {
      displayName: string(profile.displayName),
      company: string(profile.company),
      country: string(profile.country),
      email: string(auth.token.email),
      emailVerified: auth.token.email_verified === true,
    },
    credits,
    commerceHold: {
      active: hold.active === true,
      reason: string(hold.reason),
      deficitCredits: Number.isSafeInteger(Number(hold.deficitCredits))
        ? Math.max(0, Number(hold.deficitCredits))
        : 0,
    },
    preparationPacks: {
      activeCount: activePacks.length,
      releasesRemaining,
    },
  };
});

export const updateOwnProfile = createCallable({
  schema: z.object({
    displayName: z.string().trim().max(120).optional(),
    company: z.string().trim().max(180).optional(),
    country: z.string().trim().max(80).optional(),
  }).strict(),
}, async (data, { auth }) => {
  const updateData: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.country !== undefined) updateData.country = data.country;
  await adminDb.collection("users").doc(auth.uid).set(updateData, { merge: true });
  return { success: true as const };
});

export const listCreditLedger = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  }).optional(),
}, async (data, { auth }) => {
  const snapshot = await adminDb.collection("users").doc(auth.uid)
    .collection("creditLedger")
    .orderBy("createdAt", "desc")
    .limit(data?.limit || 50)
    .get();
  const ledger = snapshot.docs.map((document) => {
    const entry = document.data() as Partial<CreditLedgerEntry>;
    const amount = Number(entry.amount);
    const balanceAfter = Number(entry.balanceAfter);
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(balanceAfter) || balanceAfter < 0) {
      throw new Error(`ACCOUNT_CREDIT_LEDGER_INVALID:${document.id}`);
    }
    if (!entry.type || !["PURCHASE", "PACK_UNLOCK", "ADMIN_ADJUSTMENT", "REFUND"].includes(entry.type)) {
      throw new Error(`ACCOUNT_CREDIT_LEDGER_TYPE_INVALID:${document.id}`);
    }
    return {
      entryId: entry.entryId || document.id,
      amount,
      type: entry.type,
      reason: entry.reason || "",
      createdAt: entry.createdAt || new Date(0).toISOString(),
      balanceAfter,
      orderId: entry.orderId,
      transactionId: entry.transactionId,
      caseId: entry.caseId,
      entitlementId: entry.entitlementId,
    };
  });
  return { ledger };
});

export const listPurchaseHistory = createCallable({
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  }).optional(),
}, async (data, { auth }) => {
  const snapshot = await adminDb.collection("commerce_orders")
    .where("uid", "==", auth.uid)
    .orderBy("createdAt", "desc")
    .limit(data?.limit || 50)
    .get();
  const history = snapshot.docs.map((document) => {
    const order = document.data() as CommerceOrder;
    if (
      order.orderId !== document.id ||
      order.uid !== auth.uid ||
      order.productCode !== COMMERCIAL_CONTRACT.productCode ||
      order.currency !== COMMERCIAL_CONTRACT.currency ||
      order.amountMinor !== COMMERCIAL_CONTRACT.priceMinor
    ) throw new Error(`ACCOUNT_ORDER_CONTRACT_INVALID:${document.id}`);
    return {
      orderId: order.orderId,
      productCode: order.productCode,
      status: order.status,
      currency: order.currency,
      amountMinor: order.amountMinor,
      paddleTransactionId: order.paddleTransactionId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });
  return { history };
});

export const requestAccountClosure = createCallable({}, async (_, { auth }) => {
  await adminDb.collection("account_closures").doc(auth.uid).set({
    uid: auth.uid,
    email: auth.token.email || "",
    requestedAt: new Date().toISOString(),
    status: "PENDING",
  }, { merge: false });
  return { success: true as const };
});
