import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }

    const idToken =
      typeof payload === "object" &&
      payload !== null &&
      "idToken" in payload &&
      typeof payload.idToken === "string"
        ? payload.idToken
        : "";
    if (!idToken) {
      return apiFailure("MISSING_TOKEN", "ID Token is required.", 400);
    }

    // 1. Verify the ID token
    let decodedIdToken;
    try {
      decodedIdToken = await adminAuth.verifyIdToken(idToken);
    } catch (verifyError: unknown) {
      console.error("[SESSION VERIFY ERROR]:", errorMessage(verifyError));
      return apiFailure("INVALID_TOKEN", "ID token verification failed.", 401);
    }

    // 2. Enforce recent authentication (within last 10 minutes)
    const authTime = decodedIdToken.auth_time;
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authTime > 10 * 60) {
      return apiFailure("AUTH_RECENT_REQUIRED", "Recent sign-in required.", 401);
    }

    // 3. Create session cookie (5 days)
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    let sessionCookie;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    } catch (cookieError: unknown) {
      console.error("[SESSION COOKIE CREATE ERROR]:", errorMessage(cookieError));
      return apiFailure("COOKIE_CREATION_FAILED", "Failed to create session cookie.", 500);
    }

    // 4. Set HttpOnly session cookie
    const isProduction = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PADDLE_ENV === "production";
    const cookieStore = await cookies();
    cookieStore.set("__session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });

    return apiSuccess({ status: "success" });

  } catch (err: unknown) {
    console.error("[SESSION UNEXPECTED ERROR]:", errorMessage(err));
    return apiFailure("INTERNAL_SERVER_ERROR", "Session could not be established.", 500);
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("__session", "", {
      maxAge: 0,
      path: "/",
    });
    return apiSuccess({ status: "success" });
  } catch (err: unknown) {
    console.error("[SESSION LOGOUT ERROR]:", errorMessage(err));
    return apiFailure("INTERNAL_SERVER_ERROR", "Session logout failed.", 500);
  }
}
