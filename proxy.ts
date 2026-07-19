import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cases",
  "/reports",
  "/cbam",
  "/account",
  "/credits",
  "/admin",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|svg|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const hasSessionCookie = Boolean(request.cookies.get("__session")?.value);
  if (protectedRoute && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (protectedRoute || pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}
