import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, type DecodedIdToken } from "@/lib/firebase/admin";

export async function requireAuthenticatedSession(nextPath = "/cbam"): Promise<DecodedIdToken> {
  const sessionCookie = (await cookies()).get("__session")?.value;
  if (!sessionCookie) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}
