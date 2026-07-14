import { NextRequest } from "next/server";
import { firebaseDb } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ documentHash: string }> }) {
  try {
    const params = await props.params;
    const documentHash = params.documentHash;

    if (!documentHash || !/^[a-fA-F0-9]{64}$/.test(documentHash)) {
      return apiFailure(
        "INVALID_FORMAT",
        "The document hash must be a 64-character hexadecimal string.",
        400
      );
    }

    const docRef = doc(firebaseDb, "document_seals", documentHash);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return apiFailure(
        "NOT_FOUND",
        "No registered sealed document was found matching the provided cryptographic signature.",
        404
      );
    }

    const sealData = docSnap.data();

    return apiSuccess({
      valid: sealData.valid !== false,
      documentHash: sealData.documentHash,
      reportId: sealData.reportId,
      version: sealData.version || 1,
      issuedAt: sealData.issuedAt,
      commercialStatus: sealData.commercialStatus || "ACTIVE",
      methodologyVersion: sealData.methodologyVersion || "EU_CBAM_METHODOLOGY_2026_V1",
      regulatorySnapshotId: sealData.regulatorySnapshotId || "SNAPSHOT_2026_V1",
    }, 200, {
      "Cache-Control": "public, max-age=86400, must-revalidate",
    });
  } catch (error: any) {
    console.error("[PUBLIC VERIFY ENDPOINT ERROR]:", error.message || error);
    return apiFailure("INTERNAL_SERVER_ERROR", "Server error", 500);
  }
}
