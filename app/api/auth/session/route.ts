import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth/session-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

/**
 * Constant-time comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates the CSRF token from headers against the cookie.
 */
async function validateCsrf(request: Request): Promise<boolean> {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) {
    return false;
  }

  return timingSafeEqual(headerToken, cookieToken);
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200, headers: RESPONSE_HEADERS }
    );
  }

  try {
    const claims = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const uid = claims.uid || claims.sub;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 200, headers: RESPONSE_HEADERS }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          uid,
          email: typeof claims.email === "string" ? claims.email : "",
        },
      },
      { status: 200, headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    const response = NextResponse.json(
      { authenticated: false, user: null },
      { status: 200, headers: RESPONSE_HEADERS }
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export async function POST(request: Request) {
  // 1. Validate CSRF
  const isCsrfValid = await validateCsrf(request);
  if (!isCsrfValid) {
    return NextResponse.json(
      { error: "Forbidden: CSRF validation failed" },
      { status: 403, headers: RESPONSE_HEADERS }
    );
  }

  // 2. Parse body
  let idToken: string;
  try {
    const body = await request.json();
    if (!body || typeof body.idToken !== "string" || body.idToken.trim() === "") {
      return NextResponse.json(
        { error: "Bad Request: idToken must be provided" },
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json(
      { error: "Bad Request: Invalid JSON body" },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  try {
    // 3. Verify ID Token
    const decodedToken = await getAdminAuth().verifyIdToken(idToken, false);
    const uid = decodedToken.uid || decodedToken.sub;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      return NextResponse.json(
        { error: "Unauthorized: Invalid uid" },
        { status: 401, headers: RESPONSE_HEADERS }
      );
    }

    // 4. Validate auth_time age (recent login required within 5 mins)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authAgeSeconds = nowSeconds - Number(decodedToken.auth_time ?? 0);
    if (!Number.isFinite(authAgeSeconds) || authAgeSeconds < 0 || authAgeSeconds > 300) {
      return NextResponse.json(
        { error: "AUTH_RECENT_LOGIN_REQUIRED" },
        { status: 401, headers: RESPONSE_HEADERS }
      );
    }

    // 5. Create Session Cookie
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_SECONDS * 1000,
    });

    // 6. Upsert user in Firestore securely
    const db = getAdminDb();
    const userDocRef = db.collection("users").doc(uid);
    const userSnap = await userDocRef.get();
    
    if (!userSnap.exists) {
      await userDocRef.set({
        uid,
        email: decodedToken.email || "",
        role: "user",
        tokens: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await userDocRef.update({
        email: decodedToken.email || "",
        updatedAt: new Date().toISOString(),
      });
    }

    const response = NextResponse.json(
      {
        authenticated: true,
        user: {
          uid,
          email: decodedToken.email || "",
        },
      },
      { status: 200, headers: RESPONSE_HEADERS }
    );

    // 7. Set Session Cookie on response
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "AUTH_TOKEN_INVALID" },
      { status: 401, headers: RESPONSE_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  // 1. Validate CSRF
  const isCsrfValid = await validateCsrf(request);
  if (!isCsrfValid) {
    return NextResponse.json(
      { error: "Forbidden: CSRF validation failed" },
      { status: 403, headers: RESPONSE_HEADERS }
    );
  }

  const response = NextResponse.json(
    { success: true },
    { status: 200, headers: RESPONSE_HEADERS }
  );

  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
