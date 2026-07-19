import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicToken: string }> }
) {
  try {
    const params = await props.params;
    const publicToken = params.publicToken;

    if (!publicToken || !/^[a-fA-F0-9]{64}$/.test(publicToken)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const publicVerificationTokenHash = crypto
      .createHash("sha256")
      .update(publicToken)
      .digest("hex");

    const querySnap = await adminDb
      .collection("cbam_reports")
      .where("publicVerificationTokenHash", "==", publicVerificationTokenHash)
      .where("publicVerificationState", "==", "ACTIVE")
      .limit(1)
      .get();

    if (querySnap.empty) {
      return NextResponse.json({ error: "Active verification dossier not found" }, { status: 404 });
    }

    const reportDoc = querySnap.docs[0];
    const reportData = reportDoc.data();

    // Prepare privacy-safe metadata (no PII, no sensitive user fields)
    const metadata = {
      reportId: reportData.reportId,
      releaseVersion: reportData.releaseVersion,
      createdAt: reportData.createdAt,
      updatedAt: reportData.updatedAt,
      dossierSchemaVersion: reportData.dossierSchemaVersion || "CBAMVALID-DOSSIER-5.0",
      operatorReadinessStatus: reportData.operatorReadinessStatus,
      readinessScore: reportData.readinessScore,
      criticalBlockerCount: reportData.criticalBlockerCount,
      materialFindingCount: reportData.materialFindingCount,
      openFindingCount: reportData.openFindingCount,
      evidenceCoverage: reportData.evidenceCoverage,
      crosswalkCoverage: reportData.crosswalkCoverage || "100.00",
      installationName: reportData.calculation?.installationName || "Controlled Installation",
      country: reportData.calculation?.country || "",
      productionRoute: reportData.calculation?.productionRoute || "",
      reportingPeriod: reportData.calculation?.reportingPeriod || "",
      totalEmbeddedEmissions: reportData.calculation?.totals?.totalEmbeddedEmissions || "0.00",
      specificEmbeddedEmissions: reportData.calculation?.totals?.aggregateSpecificEmbeddedEmissions || "0.00",
      goodsCount: reportData.calculation?.goods ? Object.keys(reportData.calculation.goods).length : 0,
    };

    return NextResponse.json({ data: metadata }, { status: 200 });
  } catch (error: any) {
    console.error("[PUBLIC TOKEN VERIFY ERROR]:", error.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
