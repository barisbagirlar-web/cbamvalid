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

export async function requireFirebaseSession(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (!sessionCookie) {
    throw new AuthError("UNAUTHORIZED", "Missing session cookie.", 401);
  }

  try {
    // Verify session cookie and check revocation status
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch (error: any) {
    console.error("[AUTH_SESSION_ERROR]:", error.message || error);
    throw new AuthError("UNAUTHORIZED", "Session expired or invalid cookie.", 401);
  }
}
