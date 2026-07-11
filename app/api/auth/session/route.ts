import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_TTL_MIN = 300;
const SESSION_TTL_MAX = 1_209_600;

const ALLOWED_ORIGINS = new Set([
  "https://cbamvalid.com",
  "https://www.cbamvalid.com",
]);

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function sessionTtlSeconds(): number {
  const value = Number(
    process.env.AUTH_SESSION_TTL_SECONDS ?? "432000"
  );

  if (
    !Number.isInteger(value) ||
    value < SESSION_TTL_MIN ||
    value > SESSION_TTL_MAX
  ) {
    throw new Error("AUTH_SESSION_TTL_INVALID");
  }

  return value;
}

function originAllowed(request: Request): boolean {
  let origin = request.headers.get("origin");
  if (!origin) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refUrl = new URL(referer);
        origin = refUrl.origin;
      } catch {
        return false;
      }
    }
  }
  if (!origin) return false;
  
  // Allow localhost origins during non-production runs / tests
  if (process.env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
  }

  // Allow hardcoded production domains
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  // Allow dynamically configured env origins
  if (process.env.AUTH_ALLOWED_ORIGINS) {
    const envOrigins = process.env.AUTH_ALLOWED_ORIGINS.split(",").map(o => o.trim());
    if (envOrigins.includes(origin)) {
      return true;
    }
  }

  // Allow Firebase App Hosting subdomains for this project
  if (origin.endsWith(".hosted.app") && origin.includes("cbam-desk")) {
    return true;
  }

  return false;
}

function errorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (error as { code?: unknown }).code ?? ""
    );
  }

  return "";
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export async function GET() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  }

  try {
    const claims = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      false
    );

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          uid: claims.uid,
          email:
            typeof claims.email === "string"
              ? claims.email
              : "",
          name:
            typeof claims.name === "string"
              ? claims.name
              : "",
          admin: claims.admin === true,
        },
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch {
    const response = NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );

    clearSessionCookie(response);
    return response;
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  if (!originAllowed(request)) {
    return NextResponse.json(
      {
        error: "AUTH_ORIGIN_REJECTED",
        requestId,
      },
      {
        status: 403,
        headers: RESPONSE_HEADERS,
      }
    );
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.startsWith("application/json")) {
    return NextResponse.json(
      {
        error: "AUTH_CONTENT_TYPE_INVALID",
        requestId,
      },
      {
        status: 415,
        headers: RESPONSE_HEADERS,
      }
    );
  }

  let idToken: string;

  try {
    const body = (await request.json()) as {
      idToken?: unknown;
    };

    if (
      typeof body.idToken !== "string" ||
      body.idToken.length < 100
    ) {
      throw new Error("INVALID_ID_TOKEN_BODY");
    }

    idToken = body.idToken;
  } catch {
    return NextResponse.json(
      {
        error: "AUTH_REQUEST_INVALID",
        requestId,
      },
      {
        status: 400,
        headers: RESPONSE_HEADERS,
      }
    );
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(
      idToken,
      false
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const authAgeSeconds =
      nowSeconds - Number(decoded.auth_time ?? 0);

    if (
      !Number.isFinite(authAgeSeconds) ||
      authAgeSeconds < 0 ||
      authAgeSeconds > 300
    ) {
      return NextResponse.json(
        {
          error: "AUTH_RECENT_LOGIN_REQUIRED",
          requestId,
        },
        {
          status: 401,
          headers: RESPONSE_HEADERS,
        }
      );
    }

    const ttlSeconds = sessionTtlSeconds();

    const sessionCookie =
      await getAdminAuth().createSessionCookie(idToken, {
        expiresIn: ttlSeconds * 1000,
      });

    const response = NextResponse.json(
      {
        authenticated: true,
        user: {
          uid: decoded.uid,
          email:
            typeof decoded.email === "string"
              ? decoded.email
              : "",
        },
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ttlSeconds,
        priority: "high",
      }
    );

    return response;
  } catch (error) {
    const code = errorCode(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;

    console.error("[AUTH_SESSION_CREATE_FAILED]", {
      requestId,
      code,
      message: err?.message,
      stack: err?.stack,
    });

    const invalidTokenCodes = new Set([
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/argument-error",
      "auth/user-disabled",
      "auth/user-not-found",
    ]);

    if (invalidTokenCodes.has(code)) {
      return NextResponse.json(
        {
          error: "AUTH_TOKEN_INVALID",
          requestId,
        },
        {
          status: 401,
          headers: RESPONSE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        error: "AUTH_SERVICE_UNAVAILABLE",
        requestId,
      },
      {
        status: 503,
        headers: RESPONSE_HEADERS,
      }
    );
  }
}

export async function DELETE(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json(
      {
        error: "AUTH_ORIGIN_REJECTED",
      },
      {
        status: 403,
        headers: RESPONSE_HEADERS,
      }
    );
  }

  const response = NextResponse.json(
    {
      authenticated: false,
    },
    {
      status: 200,
      headers: RESPONSE_HEADERS,
    }
  );

  clearSessionCookie(response);
  return response;
}
