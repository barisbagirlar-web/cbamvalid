import { NextRequest } from "next/server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { verifyPublicPackageSignature } from "@/lib/verify/package-signature";

export const dynamic = "force-dynamic";

/**
 * WP-11 public verification endpoint:
 * GET /api/verify/package/{packageId}
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await props.params;
    const id = String(packageId || "").trim();
    if (!id || id.length < 8) {
      return apiFailure("INVALID_FORMAT", "packageId required", 400);
    }

    let reportDocument = await adminDb.collection("cbam_reports").doc(id).get();
    if (!reportDocument.exists) {
      const byPackageCode = await adminDb.collection("cbam_reports")
        .where("packageCode", "==", id)
        .limit(2)
        .get();
      if (byPackageCode.empty) {
        return apiFailure("NOT_FOUND", "No sealed package found for packageId", 404);
      }
      if (byPackageCode.docs.length !== 1) {
        return apiFailure("PACKAGE_ID_COLLISION", "Package identifier is not unique", 409);
      }
      reportDocument = byPackageCode.docs[0];
    }

    const row = reportDocument.data() as Record<string, unknown>;
    const reportId = String(row.reportId || reportDocument.id);
    const storage = row.storage && typeof row.storage === "object"
      ? row.storage as Record<string, { path?: unknown; sha256?: unknown; sizeBytes?: unknown }>
      : {};
    const manifestEntry = storage["manifest.json"];
    const signatureEntry = storage["manifest.sig"];
    let signatureValid = false;
    if (manifestEntry && signatureEntry) {
      const manifestPath = String(manifestEntry.path || "");
      const signaturePath = String(signatureEntry.path || "");
      const expectedPrefix = `reports/${String(row.uid || "")}/${reportId}/`;
      if (manifestPath.startsWith(expectedPrefix) && signaturePath.startsWith(expectedPrefix)) {
        const [[manifestBytes], [signatureBytes]] = await Promise.all([
          getAdminStorageBucket().file(manifestPath).download(),
          getAdminStorageBucket().file(signaturePath).download(),
        ]);
        signatureValid = verifyPublicPackageSignature({
          reportId,
          reportManifestHash: String(row.manifestHash || ""),
          manifestBytes,
          manifestIndex: {
            sha256: String(manifestEntry.sha256 || ""),
            sizeBytes: Number(manifestEntry.sizeBytes),
          },
          signatureBytes,
          signatureIndex: {
            sha256: String(signatureEntry.sha256 || ""),
            sizeBytes: Number(signatureEntry.sizeBytes),
          },
        });
      }
    }
    const publicState = row.publicVerificationState === "REVOKED" || row.revoked === true || row.status === "REVOKED"
      ? "REVOKED"
      : row.publicVerificationState === "SUPERSEDED" || row.isCurrentRelease === false
        ? "SUPERSEDED"
        : "ACTIVE";
    return apiSuccess({
      packageId: String(row.packageCode || id),
      reportId,
      releaseVersion: Number(row.releaseVersion || 0),
      signatureValid,
      signingKeyFingerprint: (row.kmsKeyVersion as string) || null,
      sealTimestamp: (row.createdAt as string) || (row.updatedAt as string) || null,
      tsaTokenStatus: (row.tsaStatus as string) || "ABSENT",
      revocationState: publicState,
      publicVerificationState: publicState,
      publicVerificationUrl: `https://cbamvalid.com/verify/package/${id}`,
      disclaimer:
        "Integrity and seal metadata only. Not an accredited verification opinion.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY PACKAGE ERROR]:", message);
    return apiFailure("INTERNAL_SERVER_ERROR", "Server error", 500);
  }
}
