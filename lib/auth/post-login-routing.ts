import type { User } from "firebase/auth";

const USER_ROUTE_PREFIXES = [
  "/cbam",
  "/cases",
  "/reports",
  "/account",
  "/credits",
  "/methodology",
  "/how-it-works",
  "/sample-dossier",
] as const;

function safeInternalRoute(candidate: string | null): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate, window.location.origin);
  } catch {
    return null;
  }
  if (parsed.origin !== window.location.origin) return null;
  const route = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return USER_ROUTE_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))
    ? route
    : null;
}

export async function resolvePostLoginRoute(user: User): Promise<string> {
  const tokenResult = await user.getIdTokenResult(true);
  const claims = tokenResult.claims;
  const ownerAdmin =
    claims.email_verified === true &&
    claims.admin === true &&
    claims.ownerAdmin === true;
  if (ownerAdmin) return "/admin";

  const nextRoute = safeInternalRoute(new URLSearchParams(window.location.search).get("next"));
  return nextRoute || "/cbam";
}
