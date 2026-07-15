import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { CaseIdSchema } from "../cbam/case-id";
import { COMMERCIAL_CONTRACT } from "../commerce/commercial-contract";
import { unlockPreparationPack } from "../commerce/credit-service";
import { adminDb } from "../firebase-admin";
import { createCallable } from "../wrapper";

type PreparationPackEntitlementView = {
  entitlementId: string;
  uid: string;
  orderId: string;
  productCode: typeof COMMERCIAL_CONTRACT.productCode;
  status: "AVAILABLE" | "RESERVED";
  quantity: number;
  maxReleases: typeof COMMERCIAL_CONTRACT.releasesPerPack;
  releasesCount: number;
  releasesRemaining: number;
  scopeCaseId?: string;
  reservedReportId?: string;
  reservationExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

function stringField(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  return typeof value === "string" ? value : "";
}

function entitlementView(documentId: string, value: unknown): PreparationPackEntitlementView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const status = stringField(source, "status");
  const releasesCount = Number(source.releasesCount ?? 0);
  const maxReleases = Number(source.maxReleases ?? COMMERCIAL_CONTRACT.releasesPerPack);
  if (
    source.productCode !== COMMERCIAL_CONTRACT.productCode ||
    !["AVAILABLE", "RESERVED"].includes(status) ||
    !Number.isSafeInteger(releasesCount) ||
    releasesCount < 0 ||
    maxReleases !== COMMERCIAL_CONTRACT.releasesPerPack ||
    releasesCount >= maxReleases
  ) return null;

  return {
    entitlementId: documentId,
    uid: stringField(source, "uid"),
    orderId: stringField(source, "orderId"),
    productCode: COMMERCIAL_CONTRACT.productCode,
    status: status as "AVAILABLE" | "RESERVED",
    quantity: Number.isSafeInteger(Number(source.quantity)) && Number(source.quantity) > 0
      ? Number(source.quantity)
      : 1,
    maxReleases: COMMERCIAL_CONTRACT.releasesPerPack,
    releasesCount,
    releasesRemaining: COMMERCIAL_CONTRACT.releasesPerPack - releasesCount,
    ...(stringField(source, "scopeCaseId") ? { scopeCaseId: stringField(source, "scopeCaseId") } : {}),
    ...(stringField(source, "reservedReportId") ? { reservedReportId: stringField(source, "reservedReportId") } : {}),
    ...(stringField(source, "reservationExpiresAt") ? { reservationExpiresAt: stringField(source, "reservationExpiresAt") } : {}),
    createdAt: stringField(source, "createdAt"),
    updatedAt: stringField(source, "updatedAt"),
  };
}

function commerceError(error: unknown, fallback: string): HttpsError {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : fallback;
  if (message === "CHECKOUT_REQUEST_IN_PROGRESS") return new HttpsError("aborted", message);
  if (
    message.includes("REQUIRED") ||
    message.includes("MISSING") ||
    message.includes("INVALID") ||
    message.includes("MISMATCH") ||
    message.includes("RECOVERY_REQUIRED") ||
    message.includes("COMMERCE_HOLD") ||
    message.includes("PARTIAL_STATE")
  ) return new HttpsError("failed-precondition", message);
  if (message.includes("COLLISION")) return new HttpsError("already-exists", message);
  return new HttpsError("internal", message);
}

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .get();

  const entitlements = snapshot.docs
    .map((document) => entitlementView(document.id, document.data()))
    .filter((item): item is PreparationPackEntitlementView => item !== null)
    .sort((left, right) => left.entitlementId.localeCompare(right.entitlementId));

  return { entitlements, status: "success" as const };
});

export const createCheckoutSession = createCallable(
  {
    schema: z.object({
      productCode: z.literal(COMMERCIAL_CONTRACT.productCode),
      requestId: z.string().uuid(),
    }).strict(),
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
      throw commerceError(error, "CHECKOUT_CREATION_FAILED");
    }
  }
);

export const unlockCbamUses = createCallable(
  {
    schema: z.object({
      requestId: z.string().uuid(),
      caseId: CaseIdSchema,
    }).strict(),
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
          : `One Preparation Pack with ${COMMERCIAL_CONTRACT.releasesPerPack} sealed versions was unlocked for this case.`,
      };
    } catch (error: unknown) {
      throw commerceError(error, "CBAM_UNLOCK_FAILED");
    }
  }
);
