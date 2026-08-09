import { NextResponse } from "next/server";
import {
  AuthError,
  requireFirebaseSession,
} from "@/lib/auth/require-firebase-session";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { reconcileTeb232LiveCases } from "@/lib/cbam/qa/reconcile-teb232-live";
import {
  prepareAllTeb232DraftCasesForSeal,
  prepareTeb232DraftCaseForSeal,
} from "@/lib/cbam/qa/prepare-teb232-drafts-for-seal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReconcileRequestBody = {
  targetCaseId?: string;
  prepareAllDrafts?: boolean;
};

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { status: "error", code: error.code, message: error.message },
      { status: error.status }
    );
  }

  const code = error instanceof Error ? error.message : "TEB232_RECONCILE_FAILED";
  const status =
    code === "TEB232_RECONCILE_IN_PROGRESS" ||
    code === "TEB232_TARGET_CASE_ALREADY_RELEASED" ||
    code === "TEB232_TARGET_CASE_SEAL_IN_PROGRESS" ||
    code === "TEB232_DRAFT_CASE_SEAL_IN_PROGRESS"
      ? 409
      : code === "TEB232_TARGET_CASE_NOT_FOUND" ||
          code === "TEB232_DRAFT_CASE_NOT_FOUND"
        ? 404
        : code === "TEB232_RECONCILE_IDENTITY_REFUSED" ||
            code === "TEB232_TARGET_PREPARE_IDENTITY_REFUSED" ||
            code === "TEB232_TARGET_CASE_REFUSED" ||
            code === "TEB232_TARGET_CASE_OWNER_MISMATCH" ||
            code === "TEB232_TARGET_CASE_CONTROL_MARKERS_MISMATCH" ||
            code === "TEB232_TARGET_CARBON_RECORD_MISSING" ||
            code === "TEB232_TARGET_CARBON_RECORD_UNEXPECTED" ||
            code === "TEB232_DRAFT_PREPARE_IDENTITY_REFUSED" ||
            code === "TEB232_DRAFT_CASE_OWNER_MISMATCH" ||
            code === "TEB232_DRAFT_CASE_NOT_EDITABLE" ||
            code === "TEB232_DRAFT_CASE_ID_INVALID"
          ? 403
          : 500;

  console.error("[TEB232_RECONCILE_ERROR]", code);
  return NextResponse.json(
    {
      status: "error",
      code,
      message:
        status === 409
          ? "This controlled test working file is currently being sealed or prepared. Retry shortly."
          : status === 403
            ? "This endpoint is restricted to the verified Teb232 test identity and controlled test working files."
            : status === 404
              ? "The controlled test working file could not be found."
              : "The controlled test data could not be prepared safely.",
    },
    { status }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const token = await requireFirebaseSession(request);
    const body = (await request.json().catch(() => ({}))) as ReconcileRequestBody;
    const identity = {
      authenticatedUid: token.uid,
      authenticatedEmail: String(token.email || ""),
      emailVerified: token.email_verified === true,
    };

    const result = body.prepareAllDrafts === true
      ? await prepareAllTeb232DraftCasesForSeal(identity)
      : body.targetCaseId
        ? await prepareTeb232DraftCaseForSeal({
            ...identity,
            targetCaseId: body.targetCaseId,
          })
        : await reconcileTeb232LiveCases({
            db: adminDb,
            bucket: getAdminStorageBucket(),
            ...identity,
          });

    return NextResponse.json(
      {
        status: "success",
        mode:
          body.prepareAllDrafts === true
            ? "all-drafts"
            : body.targetCaseId
              ? "target-case"
              : "canonical-cases",
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
