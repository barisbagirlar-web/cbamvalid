import { NextResponse } from "next/server";
import {
  AuthError,
  requireFirebaseSession,
} from "@/lib/auth/require-firebase-session";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { reconcileTeb232LiveCases } from "@/lib/cbam/qa/reconcile-teb232-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    : code === "TEB232_RECONCILE_IDENTITY_REFUSED"
      ? 403
      : 500;
  console.error("[TEB232_RECONCILE_ERROR]", code);
  return NextResponse.json(
    {
      status: "error",
      code,
      message:
        status === 409
          ? "The controlled test cases are already being prepared. Retry shortly."
          : status === 403
            ? "This endpoint is restricted to the verified Teb232 test identity."
            : "The controlled test cases could not be prepared safely.",
    },
    { status }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const token = await requireFirebaseSession(request);
    const result = await reconcileTeb232LiveCases({
      db: adminDb,
      bucket: getAdminStorageBucket(),
      authenticatedUid: token.uid,
      authenticatedEmail: String(token.email || ""),
      emailVerified: token.email_verified === true,
    });

    return NextResponse.json(
      {
        status: "success",
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
