import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const url = request.nextUrl.pathname;
  if (url.startsWith("/cbam") || url.startsWith("/admin") || url.startsWith("/account") || url.startsWith("/api")) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  }
  return response;
}
