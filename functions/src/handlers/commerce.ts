import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { PREPARATION_PACK } from "../commerce/preparation-pack";

export type PreparationPackEntitlementView = {
  entitlementId: string;
  orderId: string;
  productCode: typeof PREPARATION_PACK.productCode;
  status: "AVAILABLE" | "RESERVED";
  scopeCaseId?: string;
  releasesCount: number;
  releasesRemaining: number;
  maxReleases: typeof PREPARATION_PACK.maxReleases;
  reservedReportId?: string;
  reservationExpiresAt?: string;
};

function safeCount(value: unknown): number {
  const count = Number(value ?? 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > PREPARATION_PACK.maxReleases) {
    throw new HttpsError("data-loss", "Preparation Pack release counter is invalid.");
  }
  return count;
}

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .where("status", "in", ["AVAILABLE", "RESERVED"])
    .get();

  const grouped = new Map<string, PreparationPackEntitlementView>();
  for (const document of snapshot.docs) {
    const data = document.data() as Record<string, unknown>;
    if (data.productCode !== PREPARATION_PACK.productCode) continue;
    const releasesCount = safeCount(data.releasesCount);
    const releasesRemaining = PREPARATION_PACK.maxReleases - releasesCount;
    if (releasesRemaining <= 0) continue;
    const orderId = typeof data.orderId === "string" && data.orderId ? data.orderId : document.id;
    const status = data.status === "RESERVED" ? "RESERVED" : "AVAILABLE";
    const candidate: PreparationPackEntitlementView = {
      entitlementId: document.id,
      orderId,
      productCode: PREPARATION_PACK.productCode,
      status,
      releasesCount,
      releasesRemaining,
      maxReleases: PREPARATION_PACK.maxReleases,
      ...(typeof data.scopeCaseId === "string" ? { scopeCaseId: data.scopeCaseId } : {}),
      ...(typeof data.reservedReportId === "string" ? { reservedReportId: data.reservedReportId } : {}),
      ...(typeof data.reservationExpiresAt === "string" ? { reservationExpiresAt: data.reservationExpiresAt } : {}),
    };
    const groupKey = `${orderId}:${PREPARATION_PACK.productCode}`;
    const existing = grouped.get(groupKey);
    if (!existing || candidate.entitlementId.localeCompare(existing.entitlementId) < 0) {
      grouped.set(groupKey, candidate);
    }
  }

  const entitlements = [...grouped.values()].sort((left, right) => left.entitlementId.localeCompare(right.entitlementId));
  return {
    entitlements,
    totalReleasesRemaining: entitlements.reduce((sum, item) => sum + item.releasesRemaining, 0),
    status: "success" as const,
  };
});

export const createCheckoutSession = createCallable(
  {
    schema: z.object({
      productCode: z.literal(PREPARATION_PACK.productCode),
      requestId: z.string().uuid(),
      caseId: z.string().trim().min(1).max(128).optional(),
    }),
  },
  async ({ productCode, requestId, caseId }, { auth }) => {
    const { createCheckout } = await import("../commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout({
        uid: auth.uid,
        email: typeof auth.token.email === "string" ? auth.token.email : "",
        productCode,
        requestId,
        ...(caseId ? { caseId } : {}),
      });
      return { transactionId, status: "success" as const };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "CHECKOUT_CREATION_FAILED";
      if (
        message.includes("INVALID") ||
        message.includes("MISSING") ||
        message.includes("MISMATCH") ||
        message.includes("COLLISION") ||
        message.includes("IN_PROGRESS")
      ) {
        throw new HttpsError("failed-precondition", message);
      }
      throw new HttpsError("internal", "Checkout could not be created.");
    }
  }
);

export const unlockCbamUses = createCallable(
  { schema: z.object({ requestId: z.string().uuid() }) },
  async () => {
    throw new HttpsError(
      "failed-precondition",
      "LEGACY_CREDIT_UNLOCK_DISABLED: Preparation Packs are issued only by verified Paddle fulfillment."
    );
  }
);
