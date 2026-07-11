import "server-only";
import { getAdminAuth } from "../firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Validates the Authorization Bearer token header against Firebase Admin.
 * Returns the decoded token payload or throws an error with HTTP status codes (401/500).
 */
export async function requireFirebaseUser(request: Request): Promise<DecodedIdToken> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthError("Missing or invalid authorization header.", 401);
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 1 || parts[0].toLowerCase() !== "bearer") {
    throw new AuthError("Missing or invalid authorization header.", 401);
  }

  const token = parts.slice(1).join(" ").trim();
  if (!token) {
    throw new AuthError("Bearer token is empty.", 401);
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    
    if (!decoded || !decoded.uid || decoded.uid.trim() === "") {
      throw new AuthError("Invalid authorization token: empty uid.", 401);
    }

    return decoded;
  } catch (error: any) {
    const errCode = error?.code || "";
    if (
      errCode.startsWith("auth/") || 
      error.message?.includes("decoding") || 
      error.message?.includes("expired") || 
      error.message?.includes("signature")
    ) {
      throw new AuthError(`Unauthorized: ${error.message || "Invalid token"}`, 401);
    }

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(`Internal authentication failure: ${error.message || error}`, 500);
  }
}
