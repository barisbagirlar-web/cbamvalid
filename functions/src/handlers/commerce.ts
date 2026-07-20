import crypto from "node:crypto";
import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

const MAX_RELEASES_PER_PACK = 5;

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .where("status", "==", "AVAILABLE")
    .get();

  const grouped = new Map<string, Record<string, unknown>>();
  for (const document of snapshot.docs) {
    const data: Record<string, unknown> = { entitlementId: document.id, ...document.data() };
    const releasesCount = Number(data.releasesCount || 0);
    const releasesRemaining = Math.max(0, MAX_RELEASES_PER_PACK - releasesCount);
    if (releasesRemaining === 0) continue;
    const orderId = typeof data.orderId === "string" ? data.orderId : document.id;
    const productCode = typeof data.productCode === "string" ? data.productCode : "UNKNOWN";
    const groupKey = `${orderId}:${productCode}`;
    const candidate: Record<string, unknown> = { ...data, releasesCount, releasesRemaining };
    const existing = grouped.get(groupKey);
    const candidateId = typeof candidate.entitlementId === "string" ? candidate.entitlementId : "";
    const existingId = typeof existing?.entitlementId === "string" ? existing.entitlementId : "";
    if (!existing || candidateId.localeCompare(existingId) < 0) grouped.set(groupKey, candidate);
  }

  return { entitlements: [...grouped.values()], status: "success" };
});

export const createCheckoutSession = createCallable(
  {
    schema: z.object({
      productCode: z.string(),
      caseId: z.string(),
    }),
  },
  async ({ productCode, caseId }, { auth }) => {
    // 0. IMMEDIATE COMMERCIAL CONTAINMENT: Check publicPaidLaunchEnabled flag
    const configDoc = await adminDb.collection("system").doc("config").get();
    const publicPaidLaunchEnabled = configDoc.exists ? configDoc.data()?.publicPaidLaunchEnabled === true : false;
    const isPrivileged = auth.token.role === "admin" || auth.token.admin === true || auth.token.role === "pilot" || auth.token.pilot === true || auth.token.role === "Owner";
    if (!publicPaidLaunchEnabled && !isPrivileged) {
      throw new HttpsError("failed-precondition", "Purchasing is temporarily unavailable while final launch checks are completed.");
    }

    const { createCheckout } = await import("../commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
      return { transactionId, status: "success" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "CHECKOUT_CREATION_FAILED";
      throw new HttpsError("internal", message);
    }
  }
);

export const unlockCbamUses = createCallable(
  { schema: z.object({ requestId: z.string().uuid() }) },
  async ({ requestId }, { auth }) => {
    try {
      return await adminDb.runTransaction(async (transaction) => {
        const digest = crypto.createHash("sha256").update(`${auth.uid}\u0000${requestId}`).digest("hex");
        const idempotencyRef = adminDb.collection("idempotency").doc(`unlock_${digest}`);
        const idempotencyDoc = await transaction.get(idempotencyRef);
        if (idempotencyDoc.exists) {
          return { status: "success", message: "The five-release pack was already unlocked." };
        }

        const creditRef = adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
        const creditDoc = await transaction.get(creditRef);
        const availableCredits = Number(creditDoc.data()?.availableCredits || 0);
        if (!Number.isFinite(availableCredits) || availableCredits < 100) {
          throw new HttpsError("failed-precondition", "100 account credits are required to unlock one five-release CBAM pack.");
        }

        const now = new Date().toISOString();
        transaction.set(creditRef, {
          availableCredits: availableCredits - 100,
          lifetimeConsumed: Number(creditDoc.data()?.lifetimeConsumed || 0) + 100,
          updatedAt: now,
        }, { merge: true });

        const ledgerRef = adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
        transaction.set(ledgerRef, {
          uid: auth.uid,
          amount: -100,
          reason: "CBAM_UNLOCK",
          requestId,
          createdAt: now,
          balanceAfter: availableCredits - 100,
        });

        const entitlementId = `ent_${digest.slice(0, 48)}`;
        const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);
        transaction.create(entitlementRef, {
          entitlementId,
          uid: auth.uid,
          orderId: `UNLOCK_${requestId}`,
          productCode: "pack_premium_dossier_v5",
          status: "AVAILABLE",
          quantity: 1,
          maxReleases: MAX_RELEASES_PER_PACK,
          releasesCount: 0,
          releasesList: [],
          createdAt: now,
          updatedAt: now,
        });

        transaction.create(idempotencyRef, {
          processedAt: now,
          uid: auth.uid,
          requestId,
          entitlementId,
          creditsConsumed: 100,
          releasesGranted: MAX_RELEASES_PER_PACK,
        });

        return {
          status: "success",
          message: "One CBAM pack with five successful releases was unlocked.",
          entitlementId,
          releasesGranted: MAX_RELEASES_PER_PACK,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      const message = error instanceof Error ? error.message : "CBAM_UNLOCK_FAILED";
      throw new HttpsError("internal", message);
    }
  }
);
