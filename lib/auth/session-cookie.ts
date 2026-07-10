import "server-only";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-cbam_session"
    : "cbam_session_dev";

export type AuthSession = {
  uid: string;
  email: string;
  name: string;
  admin: boolean;
};

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const claims = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true
    );

    return {
      uid: claims.uid,
      email:
        typeof claims.email === "string"
          ? claims.email
          : "",
      name:
        typeof claims.name === "string"
          ? claims.name
          : "",
      admin: claims.admin === true,
    };
  } catch {
    return null;
  }
}
