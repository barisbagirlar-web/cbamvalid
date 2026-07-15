import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { CaseIdSchema } from "../cbam/case-id";
import { COMMERCIAL_CONTRACT } from "../commerce/commercial-contract";
import { unlockPreparationPack } from "../commerce/credit-service";

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .get();

  const entitlements = snapshot.docs
    .map((document) => ({ entitlementId: document.id, ...document.data() } as Record<string, unknown>))
    .filter((data) => {
      const status = String(data.status || "");
      const releasesCount = Number(data.releasesCount || 0);
      const maxReleases = Number(data.maxReleases || COMMERCIAL_CONTRACT.releasesPerPack);
      return (
        data.productCode === COMMERCIAL_CONTRACT.productCode &&
        ["AVAILABLE", "RESERVED"].includes(status) &&
        Number.isSafeInteger(releasesCount) &&
        Number.isSafeInteger(maxReleases) &&
        releasesCount >= 0 &&
        maxReleases === COMMERCIAL_CONTRACT.releasesPerPack &&
        releasesCount < maxReleases
      );
    })
    .map((data) => ({
      ...data,
      releasesCount: Number(data.releasesCount || 0),
      maxReleases: COMMERCIAL_CONTRACT.releasesPerPack,
      releasesRemaining: COMMERCIAL_CONTRACT.releasesPerPack - Number(data.releasesCount || 0),
    }))
    .sort((left, right) => String(left.entitlementId).localeCompare(String(right.entitlementId)));

  return { entitlements, status: "success" as const };
});

export const createCheckoutSession = createCallable(
  {
    schema: z.object({
      productCode: z.literal(COMMERCIAL_CONTRACT.productCode),
      requestId: z.string().uuid(),
    }),
  },
  async ({ productCode, requestId }, { auth }) => {
    try {
      const { createCheckout } = await import("../commerce/paddle/checkout-service");
      const transactionId = await createCheckout({
        uid: auth.uid,
        email: auth.token.email || "",
        productCode,
        requestId,
      });
      return { transactionId, status: "success" as const };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      const message = error instanceof Error ? error.message : "CHECKOUT_CREATION_FAILED";
      throw new HttpsError("internal", message);
    }
  }
);

export const unlockCbamUses = createCallable(
  {
    schema: z.object({
      requestId: z.string().uuid(),
      caseId: CaseIdSchema,
    }),
  },
  async ({ requestId, caseId }, { auth }) => {
    try {
      const result = await adminDb.runTransaction((transaction) =>
        unlockPreparationPack(transaction, {
          uid: auth.uid,
          caseId,
          requestId,
          now: new Date().toISOString(),
        })
      );
      return {
        ...result,
        status: "success" as const,
        message: result.idempotentReplay
          ? "The Preparation Pack was already unlocked for this case."
          : "One Preparation Pack with five sealed versions was unlocked for this case.",
      };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      const message = error instanceof Error ? error.message : "CBAM_UNLOCK_FAILED";
      throw new HttpsError("internal", message);
    }
  }
);
