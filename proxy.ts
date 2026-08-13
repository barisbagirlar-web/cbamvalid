import { NextRequest, NextResponse } from "next/server";
import {
  buildContentSecurityPolicy,
  createRequestCspNonce,
  isPaddleSandboxEnvironment,
} from "@/lib/security/csp";

// Routes that require authentication (Workspace)
const workspacePrefixes = ["/dashboard", "/cases", "/reports", "/cbam", "/admin"];

// Routes that are only for unauthenticated users
const authRoutes = ["/login", "/register"];

// Public routes that should redirect to dashboard if authenticated
const redirectIfAuthRoutes = ["/", ...authRoutes];

const NOINDEX_PREFIXES = [
  "/dashboard",
  "/cases",
  "/reports",
  "/cbam",
  "/admin",
  "/account",
  "/credits",
  "/api",
  "/login",
  "/register",
] as const;

function shouldNoindex(pathname: string): boolean {
  return NOINDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withCsp(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
): NextResponse {
  const isDevelopment = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy({
    nonce,
    isDevelopment,
    allowFirebaseEmulator: isDevelopment,
    paddleSandbox: isPaddleSandboxEnvironment(),
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  response.headers.delete("x-powered-by");
  response.headers.delete("X-Powered-By");

  const { pathname } = request.nextUrl;
  if (shouldNoindex(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createRequestCspNonce();

  // Skip proxy for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.match(/\.(png|svg|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Sandbox-only surfaces: return a hard 404 outside the sandbox project so
  // synthetic QA routes can never render, download or be soft-404 cached in
  // production. notFound() alone returns HTTP 200 for streamed responses, so
  // the edge must short-circuit before rendering.
  // Exception: /api/qa/reconcile-teb232 is a production TEB232 test-flow
  // route; it is session- and identity-guarded server-side
  // (TEB232_RECONCILE_IDENTITY_REFUSED), so it must not be edge-blocked.
  const isProductionTeb232Reconcile = pathname === "/api/qa/reconcile-teb232";
  if (
    process.env.NEXT_PUBLIC_APP_ENV !== "sandbox" &&
    !isProductionTeb232Reconcile &&
    (pathname === "/qa/four-dossiers" ||
      pathname.startsWith("/qa/") ||
      pathname.startsWith("/api/qa/"))
  ) {
    return withCsp(request, new NextResponse(null, { status: 404 }), nonce);
  }

  const session = request.cookies.get("__session");
  const isAuthenticated = !!session;

  // Workspace Protection: Unauthenticated user accessing workspace routes.
  // Use exact segment boundaries so public SEO hubs like /cbam-2026-* are not matched.
  const isWorkspaceRoute = workspacePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isWorkspaceRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withCsp(request, NextResponse.redirect(loginUrl), nonce);
  }

  // 2. Auth Protection: Authenticated user accessing auth or root routes
  const isRedirectIfAuthRoute = redirectIfAuthRoutes.includes(pathname);
  if (isRedirectIfAuthRoute && isAuthenticated) {
    return withCsp(
      request,
      NextResponse.redirect(new URL("/dashboard", request.url)),
      nonce,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({
      nonce,
      isDevelopment: process.env.NODE_ENV === "development",
      allowFirebaseEmulator: process.env.NODE_ENV === "development",
      paddleSandbox: isPaddleSandboxEnvironment(),
    }),
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isWorkspaceRoute || pathname.startsWith("/account") || pathname.startsWith("/api")) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  }

  return withCsp(request, response, nonce);
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
