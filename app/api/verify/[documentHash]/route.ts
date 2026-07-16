import { adminDb } from "@/lib/firebase/admin";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown verification error";
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ documentHash: string }> }
) {
  try {
    const { documentHash: rawHash } = await props.params;
    if (!/^[a-fA-F0-9]{64}$/.test(rawHash || "")) {
      return apiFailure(
        "INVALID_FORMAT",
        "The document hash must be a 64-character hexadecimal string.",
        400
      );
    }

    const documentHash = rawHash.toLowerCase();
    const sealSnapshot = await adminDb.collection("document_seals").doc(documentHash).get();
    if (!sealSnapshot.exists) {
      return apiFailure(
        "NOT_FOUND",
        "No registered sealed document was found for the supplied hash.",
        404
      );
    }

    const seal = sealSnapshot.data() as Record<string, unknown>;
    const reportId = typeof seal.reportId === "string" ? seal.reportId : "";
    if (!/^report_[a-f0-9]{64}$/.test(reportId)) {
      return apiFailure("SEAL_RECORD_INVALID", "The seal registry record is incomplete.", 500);
    }

    const reportSnapshot = await adminDb.collection("cbam_reports").doc(reportId).get();
    if (!reportSnapshot.exists) {
      return apiFailure("REPORT_RECORD_MISSING", "The sealed report registry record is missing.", 500);
    }
    const report = reportSnapshot.data() as Record<string, unknown>;
    if (
      report.status !== "SEALED" ||
      report.documentHash !== documentHash ||
      report.manifestHash !== seal.manifestHash ||
      report.packageHash !== seal.packageHash
    ) {
      return apiFailure("SEAL_RECONCILIATION_FAILED", "Seal and report registry records do not reconcile.", 500);
    }

    const commercialStatus = typeof seal.commercialStatus === "string"
      ? seal.commercialStatus
      : "UNKNOWN";
    return apiSuccess({
      cryptographicallyRegistered: seal.valid !== false,
      documentHash,
      reportId,
      releaseVersion: Number(seal.releaseVersion || report.releaseVersion || 0),
      issuedAt: typeof seal.issuedAt === "string" ? seal.issuedAt : null,
      commercialStatus,
      refunded: commercialStatus === "REFUNDED_AFTER_DELIVERY",
      rulesetVersion: typeof report.rulesetVersion === "string" ? report.rulesetVersion : null,
      sourceHash: typeof report.sourceHash === "string" ? report.sourceHash : null,
      manifestHash: typeof seal.manifestHash === "string" ? seal.manifestHash : null,
      packageHash: typeof seal.packageHash === "string" ? seal.packageHash : null,
      kmsKeyVersion: typeof seal.kmsKeyVersion === "string" ? seal.kmsKeyVersion : null,
      kmsAlgorithm: typeof seal.kmsAlgorithm === "string" ? seal.kmsAlgorithm : null,
    }, 200, {
      "Cache-Control": "no-store, max-age=0",
    });
  } catch (error: unknown) {
    console.error("[PUBLIC VERIFY ENDPOINT ERROR]", errorMessage(error));
    return apiFailure("INTERNAL_SERVER_ERROR", "Verification service error.", 500);
  }
}
