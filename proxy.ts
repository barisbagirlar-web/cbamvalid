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

  const session = request.cookies.get('__session');
  const isAuthenticated = !!session;

  // 1. Workspace Protection: Unauthenticated user accessing workspace routes
  const isWorkspaceRoute = workspacePrefixes.some(prefix => pathname.startsWith(prefix));
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
