import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-constants";

export function middleware(
  request: NextRequest
) {
  const sessionCookie =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (sessionCookie) {
    return NextResponse.next();
  }

  const loginUrl =
    new URL("/login", request.url);

  const nextPath =
    `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set(
    "next",
    nextPath
  );

  return NextResponse.redirect(
    loginUrl
  );
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/cbam/:path*",
  ],
};
