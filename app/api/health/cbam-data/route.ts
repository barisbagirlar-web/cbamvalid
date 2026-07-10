import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    regulatoryRuleset: "EU_CBAM_Ruleset_2026",
    legalVersion: "EU_2023_956",
    isPricingValid: true,
    isDefaultValuesValid: true,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    }
  });
}
