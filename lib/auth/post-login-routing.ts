import { User } from "firebase/auth";
import { isControlledWorkspaceAccount } from "@/lib/auth/controlled-workspace-account";

export async function resolvePostLoginRoute(user: User): Promise<string> {
  // 1. Wait for Firebase user and call getIdTokenResult(true)
  const tokenResult = await user.getIdTokenResult(true);
  const claims = tokenResult.claims;

  // 2. Validate internal next route
  const params = new URLSearchParams(window.location.search);
  let nextRoute = params.get("next");

  if (nextRoute) {
    // Reject absolute external URLs, protocol-relative URLs beginning //, javascript URLs
    if (
      nextRoute.includes("://") ||
      nextRoute.startsWith("//") ||
      nextRoute.toLowerCase().startsWith("javascript:")
    ) {
      nextRoute = null; // invalid, fallback
    }
  }

  // The exact controlled production account must enter the customer Cases workspace,
  // even though its server-side token retains super-admin claims for audit operations.
  if (isControlledWorkspaceAccount(user)) {
    return "/cases";
  }

  // 3. Route logic
  if (claims.ownerAdmin === true || claims.admin === true) {
    return "/admin";
  }

  // Normal user
  return nextRoute || "/cbam";
}
