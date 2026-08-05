import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication (Workspace)
const workspacePrefixes = ['/dashboard', '/cases', '/reports', '/cbam', '/admin'];

// Routes that are only for unauthenticated users
const authRoutes = ['/login', '/register'];

// Public routes that should redirect to dashboard if authenticated
const redirectIfAuthRoutes = ['/', ...authRoutes];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip proxy for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
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
    (
      pathname === "/qa/four-dossiers" ||
      pathname.startsWith("/qa/") ||
      pathname.startsWith("/api/qa/")
    )
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const session = request.cookies.get('__session');
  const isAuthenticated = !!session;

  // Workspace Protection: Unauthenticated user accessing workspace routes.
  // Use exact segment boundaries so public SEO hubs like /cbam-2026-* are not matched.
  const isWorkspaceRoute = workspacePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isWorkspaceRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Auth Protection: Authenticated user accessing auth or root routes
  const isRedirectIfAuthRoute = redirectIfAuthRoutes.includes(pathname);
  if (isRedirectIfAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const response = NextResponse.next();
  if (isWorkspaceRoute || pathname.startsWith("/account") || pathname.startsWith("/api")) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  }
  
  return response;
}
