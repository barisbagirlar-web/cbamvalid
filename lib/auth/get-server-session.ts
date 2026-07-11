import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "../firebase/admin";
import { SESSION_COOKIE_NAME } from "./session-constants";

export type ServerSession = {
  uid: string;
  email: string;
  admin: boolean;
};

/**
 * Retrieves and verifies the server session from the HTTP-only cookie.
 * Returns null if the session is missing or invalid. Never throws.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return null;
    }

    // Verify session cookie offline (fast, checkRevoked=false)
    const claims = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const uid = claims.uid || claims.sub;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      return null;
    }

    return {
      uid,
      email: typeof claims.email === "string" ? claims.email : "",
      admin: claims.admin === true,
    };
  } catch (error) {
    // Return null for invalid or expired cookies, never throw
    return null;
  }
}

/**
 * High-security session verification that also checks token revocation online.
 */
export async function getServerSessionRevocationSensitive(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return null;
    }

    // Verify session cookie online (checkRevoked=true)
    const claims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = claims.uid || claims.sub;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      return null;
    }

    return {
      uid,
      email: typeof claims.email === "string" ? claims.email : "",
      admin: claims.admin === true,
    };
  } catch (error) {
    return null;
  }
}
