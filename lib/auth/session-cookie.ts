import "server-only";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";

import { SESSION_COOKIE_NAME } from "./session-config";

export { SESSION_COOKIE_NAME };

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

    const uid = claims.uid || claims.sub;
    if (!uid || typeof uid !== "string") {
      return null;
    }

    return {
      uid,
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
