import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { verifyCaseOwner } from "../cbam/storage/case-repository";

const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5" as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .where("status", "==", "AVAILABLE")
    .get();
  const entitlements = snapshot.docs.map((doc) => doc.data());
  return { entitlements, status: "success" };
});

export const createCheckoutSession = createCallable(
  {
    secrets: ["PADDLE_API_KEY"],
    schema: z.object({
      productCode: z.literal(PREPARATION_PACK_PRODUCT),
      caseId: z.string().min(1)
    })
  },
  async ({ productCode, caseId }, { auth }) => {
    const { createCheckout } = await import("../commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout(
        auth.uid,
        auth.token.email || "",
        productCode,
        { caseId }
      );
      return { transactionId, status: "success" };
    } catch (error: unknown) {
      const message = errorMessage(error, "Checkout could not be started.");
      console.error("[CHECKOUT] Server-side checkout creation failed:", message);
      throw new HttpsError("failed-precondition", message);
    }
  }
);

/**
 * Backward-compatible conversion of historical account credits. The resulting
 * five versions are bound to one owned draft dossier, matching new purchases.
 */
export const unlockCbamUses = createCallable(
  {
    schema: z.object({
      requestId: z.string().min(1),
      caseId: z.string().min(1),
    })
  },
  async ({ requestId, caseId }, { auth }) => {
    try {
      const cbamCase = await verifyCaseOwner(caseId, auth.uid);
      if (cbamCase.status !== "DRAFT") {
        throw new HttpsError("failed-precondition", "Historical credits can only unlock an active draft dossier.");
      }

      return await adminDb.runTransaction(async (dbTransaction) => {
        const idempotencyRef = adminDb.collection("idempotency").doc(`unlock_${auth.uid}_${caseId}_${requestId}`);
        const idempotencyDoc = await dbTransaction.get(idempotencyRef);
        if (idempotencyDoc.exists) {
          return { status: "success", message: "Already unlocked" };
        }

        const creditRef = adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
        const creditDoc = await dbTransaction.get(creditRef);
        const availableCredits = creditDoc.exists ? Number(creditDoc.data()?.availableCredits || 0) : 0;

        if (availableCredits < 100) {
          throw new HttpsError(
            "failed-precondition",
            "Insufficient historical account balance. 100 credits are required to unlock five report versions."
          );
        }

        const now = new Date().toISOString();
        dbTransaction.set(creditRef, {
          availableCredits: availableCredits - 100,
          lifetimeConsumed: Number(creditDoc.data()?.lifetimeConsumed || 0) + 100,
          updatedAt: now
        }, { merge: true });

        const ledgerRef = adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
        dbTransaction.set(ledgerRef, {
          uid: auth.uid,
          caseId,
          amount: -100,
          reason: "CBAM_PREPARATION_PACK_UNLOCK",
          requestId,
          createdAt: now,
          balanceAfter: availableCredits - 100
        });

        for (let sequence = 1; sequence <= 5; sequence += 1) {
          const entitlementId = `ent_unlock_${requestId}_${sequence}`;
          const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);
          dbTransaction.set(entitlementRef, {
            entitlementId,
            uid: auth.uid,
            orderId: `UNLOCK_${requestId}`,
            caseId,
            productCode: PREPARATION_PACK_PRODUCT,
            status: "AVAILABLE",
            quantity: 1,
            versionSequence: sequence,
            createdAt: now,
            updatedAt: now,
          });
        }

        dbTransaction.set(idempotencyRef, {
          processedAt: now,
          uid: auth.uid,
          caseId,
          requestId,
        });

        return { status: "success", message: "Successfully unlocked five case-bound report versions." };
      });
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", errorMessage(error, "Historical credit unlock failed."));
    }
  }
);
