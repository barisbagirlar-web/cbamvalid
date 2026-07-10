import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    legalVersion: "EU_2023_956_CBAM_REGULATION",
    pricingCadence: "QUARTERLY",
    lastSyncAt: new Date().toISOString(),
    officialSourcesOnly: true,
    snapshotId: "SNAPSHOT_2026_V1",
    sources: [
      { name: "EU CBAM Regulation 2023/956", status: "ACTIVE" },
      { name: "CBAM Default Values Dataset 2026", status: "ACTIVE" },
      { name: "CBAM Certificate Pricingcadence", status: "ACTIVE" },
    ],
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    }
  });
}
