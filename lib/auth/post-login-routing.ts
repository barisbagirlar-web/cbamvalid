import type { User } from "firebase/auth";
import { resolveSafeNextRoute } from "@/lib/auth/safe-next-route";

export async function resolvePostLoginRoute(user: User): Promise<string> {
  const tokenResult = await user.getIdTokenResult(true);
  const claims = tokenResult.claims;
  const requestedRoute = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("next");

  if (
    user.emailVerified &&
    claims.email_verified === true &&
    claims.role === "super_admin" &&
    claims.owner === true
  ) {
    return "/admin";
  }

  return resolveSafeNextRoute(requestedRoute, "/cbam");
}
