import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/auth/session-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const csrfToken = randomUUID();
  const response = NextResponse.json(
    { csrfToken },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  return response;
}
