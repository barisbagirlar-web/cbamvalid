import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

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
    schema: z.object({
      productCode: z.string(),
      caseId: z.string()
    })
  },
  async ({ productCode, caseId }, { auth }) => {
    const { createCheckout } = await import("../commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
      return { transactionId, status: "success" };
    } catch (err: any) {
      throw new HttpsError("internal", err.message);
    }
  }
);

export const unlockCbamUses = createCallable(
  {
    schema: z.object({
      requestId: z.string(), // Idempotency key
    })
  },
  async ({ requestId }, { auth }) => {
    try {
      return await adminDb.runTransaction(async (dbTransaction) => {
        // 1. Check idempotency
        const idempotencyRef = adminDb.collection("idempotency").doc(`unlock_${requestId}`);
        const idempotencyDoc = await dbTransaction.get(idempotencyRef);
        if (idempotencyDoc.exists) {
          return { status: "success", message: "Already unlocked" };
        }

        // 2. Read user credit summary
        const creditRef = adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
        const creditDoc = await dbTransaction.get(creditRef);
        
        let availableCredits = 0;
        if (creditDoc.exists) {
          availableCredits = creditDoc.data()?.availableCredits || 0;
        }

        // 3. Ensure sufficient credits (100 credits = 5 uses)
        if (availableCredits < 100) {
          throw new HttpsError("failed-precondition", "Insufficient general account credits. 100 credits are required to unlock 5 CBAM report uses.");
        }

        // 4. Deduct 100 credits
        dbTransaction.set(creditRef, {
          availableCredits: availableCredits - 100,
          lifetimeConsumed: (creditDoc.data()?.lifetimeConsumed || 0) + 100,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        const now = new Date().toISOString();

        // 5. Write to credit ledger
        const ledgerRef = adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
        dbTransaction.set(ledgerRef, {
          uid: auth.uid,
          amount: -100,
          reason: "CBAM_UNLOCK",
          requestId,
          createdAt: now,
          balanceAfter: availableCredits - 100
        });

        // 6. Issue exactly 5 CBAM report entitlements
        for (let i = 0; i < 5; i++) {
          const entitlementRef = adminDb.collection("entitlements").doc();
          dbTransaction.set(entitlementRef, {
            entitlementId: entitlementRef.id,
            uid: auth.uid,
            orderId: `UNLOCK_${requestId}`,
            productCode: "CBAM_EXPORTER_FINAL_REPORT",
            status: "AVAILABLE",
            quantity: 1,
            createdAt: now,
            updatedAt: now,
          });
        }

        // 7. Record idempotency
        dbTransaction.set(idempotencyRef, {
          processedAt: now,
          uid: auth.uid
        });

        return { status: "success", message: "Successfully unlocked 5 CBAM report uses." };
      });
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  }
);
