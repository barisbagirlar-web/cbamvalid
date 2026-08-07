import { NextResponse } from "next/server";
import {
  AuthError,
  requireFirebaseSession,
} from "@/lib/auth/require-firebase-session";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { reconcileTeb232LiveCases } from "@/lib/cbam/qa/reconcile-teb232-live";
import { prepareTeb232TargetCase } from "@/lib/cbam/qa/prepare-teb232-target-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReconcileRequestBody = {
  targetCaseId?: string;
};

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { status: "error", code: error.code, message: error.message },
      { status: error.status }
    );
  }

  const code = error instanceof Error ? error.message : "TEB232_RECONCILE_FAILED";
  const status = code === "TEB232_RECONCILE_IN_PROGRESS"
    ? 409
    : code === "TEB232_TARGET_CASE_ALREADY_RELEASED"
      ? 409
      : code === "TEB232_TARGET_CASE_NOT_FOUND"
        ? 404
        : code === "TEB232_RECONCILE_IDENTITY_REFUSED" ||
            code === "TEB232_TARGET_PREPARE_IDENTITY_REFUSED" ||
            code === "TEB232_TARGET_CASE_REFUSED" ||
            code === "TEB232_TARGET_CASE_OWNER_MISMATCH"
          ? 403
          : 500;
  console.error("[TEB232_RECONCILE_ERROR]", code);
  return NextResponse.json(
    {
      status: "error",
      code,
      message:
        status === 409
          ? code === "TEB232_TARGET_CASE_ALREADY_RELEASED"
            ? "This controlled test working file already has a locked release and will not be overwritten."
            : "The controlled test cases are already being prepared. Retry shortly."
          : status === 403
            ? "This endpoint is restricted to the verified Teb232 test identity and approved target working file."
            : status === 404
              ? "The approved controlled test working file could not be found."
              : "The controlled test data could not be prepared safely.",
    },
    { status }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const token = await requireFirebaseSession(request);
    const body = await request.json().catch(() => ({})) as ReconcileRequestBody;
    const common = {
      db: adminDb,
      bucket: getAdminStorageBucket(),
      authenticatedUid: token.uid,
      authenticatedEmail: String(token.email || ""),
      emailVerified: token.email_verified === true,
    };

    const result = body.targetCaseId
      ? await prepareTeb232TargetCase({
          ...common,
          targetCaseId: body.targetCaseId,
        })
      : await reconcileTeb232LiveCases(common);

    return NextResponse.json(
      {
        status: "success",
        mode: body.targetCaseId ? "target-case" : "canonical-cases",
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
