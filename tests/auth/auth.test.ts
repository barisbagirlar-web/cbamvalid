/* eslint-disable */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock server-only in Vitest environment
vi.mock("server-only", () => ({}));

// Set mock environment variables
process.env.FIREBASE_ADMIN_USE_ADC = "true";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "cbam-project";
process.env.AUTH_ALLOWED_ORIGINS = "https://cbamvalid.com";

// Mock firebase-admin modules BEFORE importing routing layers
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: "[DEFAULT]" }]),
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  cert: vi.fn(),
  applicationDefault: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => {
  const verifySessionCookie = vi.fn();
  const verifyIdToken = vi.fn();
  const createSessionCookie = vi.fn();
  return {
    getAuth: vi.fn(() => ({
      verifySessionCookie,
      verifyIdToken,
      createSessionCookie,
    })),
  };
});

vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(() => ({})),
  };
});

const mockCookiesStore = {
  get: vi.fn(),
  set: vi.fn(),
};

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookiesStore),
}));

import { getAuth } from "firebase-admin/auth";
import { GET, POST, DELETE } from "@/app/api/auth/session/route";
import { NextRequest } from "next/server";

const authInstance = getAuth();

// Generate a valid 100+ character ID token string
const LONG_ID_TOKEN = "a".repeat(120);

describe("Authentication Session API Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("No cookie -> anonymous", async () => {
    vi.mocked(mockCookiesStore.get).mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.user).toBeNull();
  });

  it("Valid session cookie -> authenticated", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-123",
      email: "test@cbamvalid.com",
      name: "Test User",
    } as any);

    vi.mocked(mockCookiesStore.get).mockReturnValue({
      name: "__Host-cbam_session",
      value: "valid-cookie-value",
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.uid).toBe("user-123");
    expect(body.user.email).toBe("test@cbamvalid.com");
  });

  it("Expired cookie -> anonymous and clear", async () => {
    const expiredError = new Error("Token expired");
    (expiredError as any).code = "auth/session-cookie-expired";
    vi.mocked(authInstance.verifySessionCookie).mockRejectedValue(expiredError);

    vi.mocked(mockCookiesStore.get).mockReturnValue({
      name: "__Host-cbam_session",
      value: "expired-cookie-value",
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("Revoked cookie -> anonymous and clear", async () => {
    const revokedError = new Error("Token revoked");
    (revokedError as any).code = "auth/session-cookie-revoked";
    vi.mocked(authInstance.verifySessionCookie).mockRejectedValue(revokedError);

    vi.mocked(mockCookiesStore.get).mockReturnValue({
      name: "__Host-cbam_session",
      value: "revoked-cookie-value",
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("Invalid cookie -> anonymous and clear", async () => {
    const invalidError = new Error("Invalid token");
    (invalidError as any).code = "auth/invalid-session-cookie";
    vi.mocked(authInstance.verifySessionCookie).mockRejectedValue(invalidError);

    vi.mocked(mockCookiesStore.get).mockReturnValue({
      name: "__Host-cbam_session",
      value: "invalid-cookie-value",
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("Missing token -> 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("AUTH_REQUEST_INVALID");
  });

  it("Malformed JSON -> 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "application/json",
      },
      body: "{invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("AUTH_REQUEST_INVALID");
  });

  it("Wrong content type -> 415", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe("AUTH_CONTENT_TYPE_INVALID");
  });

  it("Wrong origin -> 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://attacker.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("AUTH_ORIGIN_REJECTED");
  });

  it("Invalid ID token -> 401", async () => {
    const tokenError = new Error("Invalid ID token");
    (tokenError as any).code = "auth/invalid-id-token";
    vi.mocked(authInstance.verifyIdToken).mockRejectedValue(tokenError);

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("AUTH_TOKEN_INVALID");
  });

  it("Old auth_time -> 401", async () => {
    vi.mocked(authInstance.verifyIdToken).mockResolvedValue({
      uid: "user-123",
      email: "test@cbamvalid.com",
      auth_time: Math.floor(Date.now() / 1000) - 1000,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("AUTH_RECENT_LOGIN_REQUIRED");
  });

  it("Valid fresh ID token -> session created", async () => {
    vi.mocked(authInstance.verifyIdToken).mockResolvedValue({
      uid: "user-123",
      email: "test@cbamvalid.com",
      name: "Test User",
      auth_time: Math.floor(Date.now() / 1000) - 10,
    } as any);
    vi.mocked(authInstance.createSessionCookie).mockResolvedValue("mocked-session-cookie-val");

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Origin": "https://cbamvalid.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.uid).toBe("user-123");
  });

  it("Logout -> 200", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "DELETE",
      headers: {
        "Origin": "https://cbamvalid.com",
      },
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});
