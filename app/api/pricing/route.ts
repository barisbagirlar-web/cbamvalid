import { NextResponse } from "next/server";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { CASE_COMMERCIAL } from "@/lib/billing/case-commercial-contract";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let publicPaidLaunchEnabled = false;
  try {
    const configDoc = await adminDb.collection("system").doc("config").get();
    if (configDoc.exists) {
      publicPaidLaunchEnabled = configDoc.data()?.publicPaidLaunchEnabled === true;
    }
  } catch (e) {
    console.error("Failed to read system/config:", e);
  }

  return NextResponse.json({
    displayPrice: CANONICAL_PRICING.displayPrice,
    priceFormatted: CANONICAL_PRICING.priceFormatted,
    currency: CANONICAL_PRICING.currency,
    packName: CANONICAL_PRICING.packName,
    billingModel: CASE_COMMERCIAL.billingModel,
    includedOperators: CANONICAL_PRICING.includedOperators,
    includedInstallations: CANONICAL_PRICING.includedInstallations,
    includedReportingYears: CANONICAL_PRICING.includedReportingYears,
    /** Practical ceiling only — customer message is correctionPolicy. */
    includedSealedReleases: CASE_COMMERCIAL.maxReleasesPerPaidCase,
    draftPolicy: CANONICAL_PRICING.draftPolicy,
    correctionPolicy: CANONICAL_PRICING.correctionPolicy,
    valueSummary: CANONICAL_PRICING.valueSummary,
    paymentFlowSummary: CANONICAL_PRICING.paymentFlowSummary,
    publicPaidLaunchEnabled,
  });
}
