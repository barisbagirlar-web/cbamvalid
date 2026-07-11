import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ documentHash: string }> }) {
  try {
    const params = await props.params;
    const documentHash = params.documentHash;

    if (!documentHash) {
      return NextResponse.json({ error: "Missing document hash parameter" }, { status: 400 });
    }

    const doc = await getAdminDb().collection("document_seals").doc(documentHash).get();

    if (!doc.exists) {
      return NextResponse.json({
        valid: false,
        message: "No registered sealed document was found matching the provided cryptographic signature.",
      }, { status: 404 });
    }

    const sealData = doc.data() as any;

    // Return only safe metadata without leaking customer identity, EORI, volume, or emission values
    return NextResponse.json({
      valid: sealData.valid || true,
      documentHash: sealData.documentHash,
      reportId: sealData.reportId,
      version: sealData.version || 1,
      issuedAt: sealData.issuedAt,
      commercialStatus: sealData.commercialStatus || "ACTIVE",
      methodologyVersion: sealData.methodologyVersion || "EU_CBAM_METHODOLOGY_2026_V1",
      regulatorySnapshotId: sealData.regulatorySnapshotId || "SNAPSHOT_2026_V1",
    }, {
      headers: {
        "Cache-Control": "public, max-age=86400, must-revalidate", // Cacheable public signature metadata
      }
    });
  } catch (error: any) {
    console.error("[PUBLIC VERIFY ENDPOINT ERROR]:", error.message || error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
