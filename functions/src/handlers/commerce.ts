import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5" as const;

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("entitlements")
    .where("uid", "==", auth.uid)
    .where("status", "==", "AVAILABLE")
    .get();
  const entitlements = snapshot.docs.map(doc => doc.data());
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
    } catch (err: any) {
      console.error("[CHECKOUT] Server-side checkout creation failed:", err?.message || err);
      throw new HttpsError("failed-precondition", err?.message || "Checkout could not be started.");
    }
  }
);

/**
 * Legacy account-credit conversion endpoint.
 * Kept for backward compatibility with historical balances, but it remains
 * server-authenticated, atomic and idempotent. New purchases use the single
 * Exporter Verification Preparation Pack checkout above.
 */
export const unlockCbamUses = createCallable(
  {
    schema: z.object({
      requestId: z.string().min(1),
    })
  },
  async ({ requestId }, { auth }) => {
    try {
      return await adminDb.runTransaction(async (dbTransaction) => {
        const idempotencyRef = adminDb.collection("idempotency").doc(`unlock_${requestId}`);
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
            "Insufficient account balance. 100 historical account credits are required to unlock five report versions."
          );
        }

        dbTransaction.set(creditRef, {
          availableCredits: availableCredits - 100,
          lifetimeConsumed: Number(creditDoc.data()?.lifetimeConsumed || 0) + 100,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        const now = new Date().toISOString();
        const ledgerRef = adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
        dbTransaction.set(ledgerRef, {
          uid: auth.uid,
          amount: -100,
          reason: "CBAM_UNLOCK",
          requestId,
          createdAt: now,
          balanceAfter: availableCredits - 100
        });

        for (let i = 0; i < 5; i++) {
          const entitlementRef = adminDb.collection("entitlements").doc();
          dbTransaction.set(entitlementRef, {
            entitlementId: entitlementRef.id,
            uid: auth.uid,
            orderId: `UNLOCK_${requestId}`,
            productCode: PREPARATION_PACK_PRODUCT,
            status: "AVAILABLE",
            quantity: 1,
            versionSequence: i + 1,
            createdAt: now,
            updatedAt: now,
          });
        }

        dbTransaction.set(idempotencyRef, {
          processedAt: now,
          uid: auth.uid
        });

        return { status: "success", message: "Successfully unlocked five report versions." };
      });
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  }
);
