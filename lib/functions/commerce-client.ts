import { httpsCallable } from "firebase/functions";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";
import { firebaseFunctions } from "@/lib/firebase/client";
import {
  PreparationPackEntitlementSchema,
  type CheckoutResponse,
  type PackUnlockResponse,
  type PreparationPackEntitlement,
} from "@/lib/functions/commerce-types";

const createCheckoutSessionCallable = httpsCallable<{
  productCode: typeof COMMERCIAL_CONTRACT.productCode;
  requestId: string;
}, CheckoutResponse>(firebaseFunctions, "createCheckoutSession");

const unlockPreparationPackCallable = httpsCallable<{
  requestId: string;
  caseId: string;
}, PackUnlockResponse>(firebaseFunctions, "unlockCbamUses");

const getEntitlementsCallable = httpsCallable<void, { entitlements: unknown[] }>(
  firebaseFunctions,
  "getEntitlements"
);

export async function createCommercialCheckout(requestId: string): Promise<CheckoutResponse> {
  return (await createCheckoutSessionCallable({
    productCode: COMMERCIAL_CONTRACT.productCode,
    requestId,
  })).data;
}

export async function unlockPreparationPack(
  requestId: string,
  caseId: string
): Promise<PackUnlockResponse> {
  return (await unlockPreparationPackCallable({ requestId, caseId })).data;
}

export async function getPreparationPacks(): Promise<PreparationPackEntitlement[]> {
  return (await getEntitlementsCallable()).data.entitlements.map((value) =>
    PreparationPackEntitlementSchema.parse(value)
  );
}
