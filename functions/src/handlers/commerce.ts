import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "@/firebase-admin";

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
    const { createCheckout } = await import("@/commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
      return { transactionId, status: "success" };
    } catch (err: any) {
      throw new HttpsError("internal", err.message);
    }
  }
);

