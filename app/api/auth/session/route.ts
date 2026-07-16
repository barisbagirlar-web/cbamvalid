import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown session error";
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }

    const idToken = payload && typeof payload === "object" && "idToken" in payload
      ? (payload as { idToken?: unknown }).idToken
      : null;
    if (typeof idToken !== "string" || !idToken.trim()) {
      return apiFailure("MISSING_TOKEN", "ID token is required.", 400);
    }

    let decodedIdToken;
    try {
      decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (verifyError: unknown) {
      console.error("[SESSION VERIFY ERROR]", errorMessage(verifyError));
      return apiFailure("INVALID_TOKEN", "ID token verification failed.", 401);
    }

    if (decodedIdToken.email_verified !== true || typeof decodedIdToken.email !== "string") {
      return apiFailure("EMAIL_VERIFICATION_REQUIRED", "Verify your email before starting a server session.", 403);
    }

    const authTime = decodedIdToken.auth_time;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(authTime) || authTime <= 0 || nowSeconds - authTime > 10 * 60) {
      return apiFailure("AUTH_RECENT_REQUIRED", "Recent sign-in required.", 401);
    }

    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    let sessionCookie: string;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    } catch (cookieError: unknown) {
      console.error("[SESSION COOKIE CREATE ERROR]", errorMessage(cookieError));
      return apiFailure("COOKIE_CREATION_FAILED", "Failed to create session cookie.", 500);
    }

    const cookieStore = await cookies();
    cookieStore.set("__session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return apiSuccess({ status: "success" });
  } catch (error: unknown) {
    console.error("[SESSION UNEXPECTED ERROR]", errorMessage(error));
    return apiFailure("INTERNAL_SERVER_ERROR", "Session could not be established.", 500);
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("__session", "", {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return apiSuccess({ status: "success" });
  } catch (error: unknown) {
    console.error("[SESSION LOGOUT ERROR]", errorMessage(error));
    return apiFailure("INTERNAL_SERVER_ERROR", "Session logout failed.", 500);
  }
}
