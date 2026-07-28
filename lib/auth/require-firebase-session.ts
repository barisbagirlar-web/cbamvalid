import { cookies } from "next/headers";
import { adminAuth, DecodedIdToken } from "@/lib/firebase/admin";

export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Require an authenticated Firebase user for App Router API routes.
 * Primary: HttpOnly `__session` cookie (server session).
 * Fallback: `Authorization: Bearer <Firebase ID token>` for same-origin API calls
 * that already hold a fresh client ID token (never stored as `__session`).
 */
export async function requireFirebaseSession(request?: Request): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (sessionCookie) {
    try {
      return await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[AUTH_SESSION_ERROR]:", message);
      // Fall through to Bearer if present; otherwise fail closed.
    }
  }

  const authHeader = request?.headers.get("authorization") || request?.headers.get("Authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) {
    try {
      return await adminAuth.verifyIdToken(bearerMatch[1], true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[AUTH_BEARER_ERROR]:", message);
      throw new AuthError("UNAUTHORIZED", "Session expired or invalid token.", 401);
    }
  }

  if (!sessionCookie) {
    throw new AuthError("UNAUTHORIZED", "Missing session cookie.", 401);
  }
  throw new AuthError("UNAUTHORIZED", "Session expired or invalid cookie.", 401);
}
