import { NextRequest } from "next/server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { adminDb } from "@/lib/firebase/admin";
import { buildPublicVerificationPayload } from "@/lib/verify/public-verification";

export const dynamic = "force-dynamic";

/**
 * WP-11 public verification endpoint:
 * GET /api/verify/package/{packageId}
 *
 * The public URL carries either the report ID (as published in the sealed
 * dossier) or the package code. Lookup order:
 *   1. cbam_reports document keyed by the given id
 *   2. cbam_reports document whose packageCode matches
 *   3. document_seals document keyed by the given id
 *
 * FAZ 10 — returns only integrity and release metadata; no customer, case,
 * entitlement, or calculation data leaves the public boundary.
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

    let sealRow: Record<string, unknown> | null = null;
    let reportRow: Record<string, unknown> | null = null;

    const reportDoc = await adminDb.collection("cbam_reports").doc(id).get();
    if (reportDoc.exists) {
      reportRow = reportDoc.data() as Record<string, unknown>;
    } else {
      const byCode = await adminDb
        .collection("cbam_reports")
        .where("packageCode", "==", id)
        .limit(1)
        .get();
      if (!byCode.empty) reportRow = byCode.docs[0]?.data() as Record<string, unknown>;
    }

    const sealDoc = await adminDb.collection("document_seals").doc(id).get();
    if (sealDoc.exists) sealRow = sealDoc.data() as Record<string, unknown>;

    if (!reportRow && !sealRow) {
      return apiFailure("NOT_FOUND", "No sealed package found for packageId", 404);
    }

    const payload = buildPublicVerificationPayload({ packageId: id, sealRow, reportRow });
    return apiSuccess(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY PACKAGE ERROR]:", message);
    return apiFailure("INTERNAL_SERVER_ERROR", "Server error", 500);
  }
}
