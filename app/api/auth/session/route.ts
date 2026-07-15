import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}

export async function POST(request: Request) {
  if (!trustedOrigin(request)) {
    return apiFailure("ORIGIN_REJECTED", "Session requests must originate from this site.", 403);
  }

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }
    const idToken = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).idToken
      : undefined;
    if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 20_000) {
      return apiFailure("MISSING_TOKEN", "A valid ID token is required.", 400);
    }

    let decodedIdToken;
    try {
      decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (verificationError: unknown) {
      console.error(`[SESSION] ID token verification failed: ${errorText(verificationError)}`);
      return apiFailure("INVALID_TOKEN", "ID token verification failed.", 401);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(decodedIdToken.auth_time) || nowSeconds - decodedIdToken.auth_time > 10 * 60) {
      return apiFailure("AUTH_RECENT_REQUIRED", "Recent sign-in is required.", 401);
    }

    const now = new Date().toISOString();
    const userRef = adminDb.collection("users").doc(decodedIdToken.uid);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const existing = snapshot.exists ? snapshot.data() as Record<string, unknown> : {};
      transaction.set(userRef, {
        uid: decodedIdToken.uid,
        email: decodedIdToken.email || "",
        displayName: typeof existing.displayName === "string" ? existing.displayName : decodedIdToken.name || "",
        company: typeof existing.company === "string" ? existing.company : "",
        country: typeof existing.country === "string" ? existing.country : "",
        role: typeof existing.role === "string" ? existing.role : "user",
        createdAt: typeof existing.createdAt === "string" ? existing.createdAt : now,
        lastSessionAt: now,
        updatedAt: now,
      }, { merge: true });
    });

    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    let sessionCookie: string;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    } catch (cookieError: unknown) {
      console.error(`[SESSION] Cookie creation failed: ${errorText(cookieError)}`);
      return apiFailure("COOKIE_CREATION_FAILED", "Failed to create session cookie.", 500);
    }

    (await cookies()).set("__session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return apiSuccess({ status: "success" }, 200, { "Cache-Control": "no-store" });
  } catch (error: unknown) {
    console.error(`[SESSION] Unexpected failure: ${errorText(error)}`);
    return apiFailure("INTERNAL_SERVER_ERROR", "Session could not be established.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!trustedOrigin(request)) {
    return apiFailure("ORIGIN_REJECTED", "Session requests must originate from this site.", 403);
  }
  try {
    (await cookies()).set("__session", "", {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return apiSuccess({ status: "success" }, 200, { "Cache-Control": "no-store" });
  } catch (error: unknown) {
    console.error(`[SESSION] Logout failure: ${errorText(error)}`);
    return apiFailure("INTERNAL_SERVER_ERROR", "Session logout failed.", 500);
  }
}
