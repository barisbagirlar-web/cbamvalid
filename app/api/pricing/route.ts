import { NextResponse } from "next/server";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
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
    currency: CANONICAL_PRICING.currency,
    packName: CANONICAL_PRICING.packName,
    includedInstallations: CANONICAL_PRICING.includedInstallations,
    includedReportingYears: CANONICAL_PRICING.includedReportingYears,
    includedSealedReleases: CANONICAL_PRICING.includedSealedReleases,
    draftPolicy: CANONICAL_PRICING.draftPolicy,
    publicPaidLaunchEnabled,
  });
}
