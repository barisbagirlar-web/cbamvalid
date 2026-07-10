import "server-only";

import { redirect } from "next/navigation";

import {
  getSession,
  type AuthSession,
} from "@/lib/auth/session-cookie";

export async function requireSession(
  redirectTo = "/login"
): Promise<AuthSession> {
  const session = await getSession();

  if (!session) {
    redirect(redirectTo);
  }

  return session;
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireSession("/login");

  if (!session.admin) {
    redirect("/dashboard?error=forbidden");
  }

  return session;
}
