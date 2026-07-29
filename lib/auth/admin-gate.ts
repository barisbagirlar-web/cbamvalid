import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, DecodedIdToken } from "@/lib/firebase/admin";
import { requireCanonicalOwnerClaims } from "@/lib/auth/owner-contract";

export async function requireSuperAdmin(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (!sessionCookie) {
    redirect("/login?next=/admin");
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

    try {
      requireCanonicalOwnerClaims(decodedClaims);
    } catch {
      redirect("/dashboard");
    }

    return decodedClaims;
  } catch {
    // If the session cookie is invalid or expired
    redirect("/login?next=/admin");
  }
}

