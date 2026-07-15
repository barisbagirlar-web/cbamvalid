import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, type DecodedIdToken } from "@/lib/firebase/admin";

function isExactOwnerSuperAdmin(claims: DecodedIdToken): boolean {
  const expectedUid = process.env.OWNER_ADMIN_UID?.trim() || "";
  const expectedEmail = process.env.OWNER_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  return Boolean(
    expectedUid &&
    expectedEmail &&
    claims.uid === expectedUid &&
    email === expectedEmail &&
    claims.email_verified === true &&
    claims.role === "super_admin" &&
    claims.owner === true
  );
}

export async function requireSuperAdmin(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) redirect("/login?next=/admin");

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!isExactOwnerSuperAdmin(decodedClaims)) redirect("/cbam");
    return decodedClaims;
  } catch {
    redirect("/login?next=/admin");
  }
}
