import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, type DecodedIdToken } from "@/lib/firebase/admin";

export async function requireSuperAdmin(): Promise<DecodedIdToken> {
  const sessionCookie = (await cookies()).get("__session")?.value;
  if (!sessionCookie) redirect("/login?next=/admin");

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const authorized =
      decodedClaims.email_verified === true &&
      decodedClaims.admin === true &&
      decodedClaims.ownerAdmin === true;
    if (!authorized) redirect("/cbam");
    return decodedClaims;
  } catch {
    redirect("/login?next=/admin");
  }
}
