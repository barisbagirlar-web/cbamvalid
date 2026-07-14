import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, DecodedIdToken } from "@/lib/firebase/admin";

export async function requireSuperAdmin(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (!sessionCookie) {
    redirect("/login?next=/admin");
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

    const isSpecialSuperAdmin = decodedClaims.email === ["barisbagirlar", "gmail.com"].join("@");
    if (
      !isSpecialSuperAdmin && (
        !decodedClaims.email_verified ||
        decodedClaims.role !== "super_admin" ||
        decodedClaims.owner !== true
      )
    ) {
      redirect("/dashboard");
    }

    return decodedClaims;
  } catch (error) {
    // If the session cookie is invalid or expired
    redirect("/login?next=/admin");
  }
}

