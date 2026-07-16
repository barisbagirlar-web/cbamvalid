import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const WORKSPACE_PREFIXES = [
  "/dashboard",
  "/cases",
  "/reports",
  "/cbam",
  "/account",
  "/credits",
  "/admin",
] as const;

const AUTH_ONLY_ROUTES = ["/login", "/register", "/verify-email"] as const;
const REDIRECT_IF_AUTHENTICATED = ["/", ...AUTH_ONLY_ROUTES] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|svg|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$/i.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isStaticAsset(pathname)) return NextResponse.next();

  const hasSessionCookie = Boolean(request.cookies.get("__session")?.value);
  const workspaceRoute = WORKSPACE_PREFIXES.some((prefix) => matchesRoute(pathname, prefix));

  if (workspaceRoute && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && REDIRECT_IF_AUTHENTICATED.some((route) => pathname === route)) {
    return NextResponse.redirect(new URL("/cbam", request.url));
  }

  const response = NextResponse.next();
  if (workspaceRoute || pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}
