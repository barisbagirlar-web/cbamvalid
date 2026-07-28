import { NextRequest } from "next/server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { adminDb } from "@/lib/firebase/admin";

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

    let data: Record<string, unknown> | undefined;
    const sealed = await adminDb.collection("sealed_reports").doc(id).get();
    if (sealed.exists) data = sealed.data() as Record<string, unknown>;
    else {
      const report = await adminDb.collection("reports").doc(id).get();
      if (!report.exists) {
        return apiFailure("NOT_FOUND", "No sealed package found for packageId", 404);
      }
      data = report.data() as Record<string, unknown>;
    }

    const row = data || {};
    return apiSuccess({
      packageId: id,
      signatureValid: Boolean(row.manifestHash && row.signatureBase64),
      signingKeyFingerprint: (row.kmsKeyVersion as string) || null,
      sealTimestamp: (row.createdAt as string) || (row.updatedAt as string) || null,
      tsaTokenStatus: (row.tsaStatus as string) || "ABSENT",
      revocationState: row.revoked === true ? "REVOKED" : "ACTIVE",
      publicVerificationState: "ACTIVE",
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
