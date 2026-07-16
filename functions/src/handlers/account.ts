import { createCallable } from "../wrapper";
import { z } from "zod";
import { adminDb } from "../firebase-admin";
import { requireVerifiedUser } from "../auth/verified-user";
import { normalizeCreditSummary } from "../commerce/credit-service";

function iso(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export const getAccountOverview = createCallable({}, async (_, { auth }) => {
  requireVerifiedUser(auth);
  const [profileSnapshot, creditSnapshot] = await Promise.all([
    adminDb.collection("users").doc(auth.uid).get(),
    adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current").get(),
  ]);
  const profile = profileSnapshot.exists
    ? profileSnapshot.data() as Record<string, unknown>
    : {};
  return {
    profile: {
      displayName: text(profile, "displayName"),
      email: typeof auth.token.email === "string" ? auth.token.email : text(profile, "email"),
      companyName: text(profile, "companyName") || text(profile, "company"),
      phone: text(profile, "phone"),
      country: text(profile, "country"),
    },
    creditSummary: normalizeCreditSummary(creditSnapshot.data()),
    authenticatedAt: typeof auth.token.auth_time === "number"
      ? new Date(auth.token.auth_time * 1000).toISOString()
      : "",
  };
});

export const updateOwnProfile = createCallable(
  {
    schema: z.object({
      displayName: z.string().trim().min(1).max(100).optional(),
      companyName: z.string().trim().max(150).optional(),
      phone: z.string().trim().max(50).optional(),
      country: z.string().trim().max(100).optional(),
    }),
  },
  async (data, { auth }) => {
    requireVerifiedUser(auth);
    const updatedAt = new Date().toISOString();
    await adminDb.collection("users").doc(auth.uid).set({
      ...data,
      email: typeof auth.token.email === "string" ? auth.token.email : "",
      updatedAt,
    }, { merge: true });
    return { success: true as const, updatedAt };
  }
);

export const listCreditLedger = createCallable(
  { schema: z.object({ limit: z.number().int().min(1).max(100).optional().default(25) }) },
  async ({ limit }, { auth }) => {
    requireVerifiedUser(auth);
    const snapshot = await adminDb.collection("users").doc(auth.uid).collection("creditLedger")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return {
      ledger: snapshot.docs.map((document) => {
        const data = document.data() as Record<string, unknown>;
        const amount = Number(data.amount || 0);
        const balanceAfter = Number(data.balanceAfter || 0);
        if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(balanceAfter) || balanceAfter < 0) {
          throw new Error("CREDIT_LEDGER_ENTRY_INVALID");
        }
        return {
          id: document.id,
          type: text(data, "type") || text(data, "reason"),
          amount,
          reason: text(data, "reason"),
          balanceAfter,
          createdAt: iso(data.createdAt),
          orderId: text(data, "orderId") || null,
          reportId: text(data, "reportId") || null,
        };
      }),
    };
  }
);

export const listPurchaseHistory = createCallable(
  { schema: z.object({ limit: z.number().int().min(1).max(100).optional().default(25) }) },
  async ({ limit }, { auth }) => {
    requireVerifiedUser(auth);
    const snapshot = await adminDb.collection("paddle_events")
      .where("uid", "==", auth.uid)
      .orderBy("occurredAt", "desc")
      .limit(limit)
      .get();
    return {
      history: snapshot.docs.map((document) => {
        const record = document.data() as Record<string, unknown>;
        const payload = record.payload && typeof record.payload === "object"
          ? record.payload as Record<string, unknown>
          : {};
        const data = payload.data && typeof payload.data === "object"
          ? payload.data as Record<string, unknown>
          : {};
        const customData = data.customData && typeof data.customData === "object"
          ? data.customData as Record<string, unknown>
          : {};
        return {
          eventId: document.id,
          eventType: text(record, "eventType"),
          occurredAt: iso(record.occurredAt),
          processingState: text(record, "processingState"),
          transactionId: text(data, "id"),
          orderId: text(customData, "orderId"),
          productCode: text(customData, "productCode"),
        };
      }),
    };
  }
);

export const requestAccountClosure = createCallable({}, async (_, { auth }) => {
  requireVerifiedUser(auth);
  const requestedAt = new Date().toISOString();
  await adminDb.collection("account_closure_requests").doc(auth.uid).set({
    uid: auth.uid,
    status: "REQUESTED",
    requestedAt,
    updatedAt: requestedAt,
  }, { merge: true });
  return { success: true as const, requestedAt };
});
