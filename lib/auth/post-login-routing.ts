import type { User } from "firebase/auth";

const ALLOWED_NEXT_PREFIXES = [
  "/account",
  "/admin",
  "/cases",
  "/cbam",
  "/credits",
  "/reports",
] as const;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function sanitizeInternalNextPath(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  if (/[\u0000-\u001F\u007F\\]/.test(candidate)) {
    return null;
  }

  try {
    const base = new URL("https://cbamvalid.invalid");
    const parsed = new URL(candidate, base);

    if (parsed.origin !== base.origin) {
      return null;
    }

    if (!ALLOWED_NEXT_PREFIXES.some((prefix) => matchesPathPrefix(parsed.pathname, prefix))) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getPreservedAuthHref(
  destination: "/login" | "/register",
  search: string,
): string {
  const nextPath = sanitizeInternalNextPath(new URLSearchParams(search).get("next"));
  if (!nextPath) {
    return destination;
  }

  return `${destination}?${new URLSearchParams({ next: nextPath }).toString()}`;
}

function readRequestedNextPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("next");
}

export async function resolvePostLoginRoute(
  user: User,
  requestedNextPath: string | null = readRequestedNextPath(),
): Promise<string> {
  const tokenResult = await user.getIdTokenResult(true);
  const claims = tokenResult.claims;
  const nextPath = sanitizeInternalNextPath(requestedNextPath);
  const isAdmin =
    claims.role === "super_admin" &&
    claims.owner === true &&
    claims.ownerUid === user.uid;

  if (isAdmin) {
    return nextPath?.startsWith("/admin") ? nextPath : "/admin";
  }

  if (nextPath?.startsWith("/admin")) {
    return "/cbam";
  }

  return nextPath || "/cbam";
}
