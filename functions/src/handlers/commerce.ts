import crypto from "node:crypto";
import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { isTestAdmin, ensureTestAdminEntitlement } from "../commerce/test-admin-access";
import { verifyCaseOwner } from "../cbam/storage/case-repository";

const MAX_RELEASES_PER_PACK = 5;

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  // Owner-approved test administrators get an idempotent synthetic entitlement
  // so the full pay-at-lock flow can be exercised without a real payment or
  // credit balance. Provisioned inside the read path so the client always sees
  // a usable pack; sealing still runs through the normal reserve/consume gates.
  if (isTestAdmin(auth.token)) {
    await adminDb.runTransaction((transaction) =>
      ensureTestAdminEntitlement(transaction, auth.uid, String(auth.token.email || ""))
    );
  }

  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .where("status", "==", "AVAILABLE")
    .get();

  const grouped = new Map<string, Record<string, unknown>>();
  for (const document of snapshot.docs) {
    const data: Record<string, unknown> = { entitlementId: document.id, ...document.data() };
    const releasesCount = Number(data.releasesCount || 0);
    const maxReleases = Number(data.maxReleases || MAX_RELEASES_PER_PACK);
    const releasesRemaining = Math.max(0, maxReleases - releasesCount);
    if (releasesRemaining === 0) continue;
    const orderId = typeof data.orderId === "string" ? data.orderId : document.id;
    const productCode = typeof data.productCode === "string" ? data.productCode : "UNKNOWN";
    const scopeCaseId = typeof data.scopeCaseId === "string" ? data.scopeCaseId : "";
    const groupKey = scopeCaseId
      ? `case:${scopeCaseId}:${productCode}`
      : `${orderId}:${productCode}`;
    const candidate: Record<string, unknown> = {
      ...data,
      releasesCount,
      releasesRemaining,
      maxReleases,
    };
    const existing = grouped.get(groupKey);
    const candidateId = typeof candidate.entitlementId === "string" ? candidate.entitlementId : "";
    const existingId = typeof existing?.entitlementId === "string" ? existing.entitlementId : "";
    if (!existing || candidateId.localeCompare(existingId) < 0) grouped.set(groupKey, candidate);
  }

  return { entitlements: [...grouped.values()], status: "success" };
});

export const createCheckoutSession = createCallable(
  {
    secrets: ["PADDLE_API_KEY"],
    schema: z.object({
      productCode: z.string(),
      caseId: z.string(),
    }),
  },
  async ({ productCode, caseId }, { auth }) => {
    // 0. IMMEDIATE COMMERCIAL CONTAINMENT: Check publicPaidLaunchEnabled flag
    const configDoc = await adminDb.collection("system").doc("config").get();
    const publicPaidLaunchEnabled = configDoc.exists ? configDoc.data()?.publicPaidLaunchEnabled === true : false;
    const isPrivileged =
      auth.token.role === "admin" ||
      auth.token.admin === true ||
      auth.token.role === "pilot" ||
      auth.token.pilot === true ||
      auth.token.role === "Owner" ||
      isTestAdmin(auth.token);
    if (!publicPaidLaunchEnabled && !isPrivileged) {
      throw new HttpsError("failed-precondition", "Purchasing is temporarily unavailable while final launch checks are completed.");
    }

    // Case ownership is a server-side authorization boundary: a buyer may only
    // bind a payment to a case they own. Verify before creating any order.
    try {
      await verifyCaseOwner(caseId, auth.uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Case ownership verification failed.";
      const notFound = message.includes("was not found");
      throw new HttpsError(notFound ? "not-found" : "permission-denied", "You may only purchase a pack for a case you own.");
    }

    const { createCheckout } = await import("../commerce/paddle/checkout-service");
    try {
      const checkout = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
      return { ...checkout, status: "success" };
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
          const prior = idempotencyDoc.data() || {};
          return {
            status: "success",
            message: "The legacy pack balance was already activated.",
            entitlementId: typeof prior.entitlementId === "string" ? prior.entitlementId : undefined,
            releasesGranted: Number(prior.releasesGranted || MAX_RELEASES_PER_PACK),
          };
        }

        const creditRef = adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
        const creditDoc = await transaction.get(creditRef);
        const availableCredits = Number(creditDoc.data()?.availableCredits || 0);
        if (!Number.isFinite(availableCredits) || availableCredits < 100) {
          throw new HttpsError(
            "failed-precondition",
            "A purchased Preparation Pack balance is required to activate leftover legacy sealing capacity."
          );
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
          message: "Pack balance activated (included balance — no new card charge).",
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
