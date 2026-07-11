/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock server-only in Vitest environment
vi.mock("server-only", () => ({}));

const { sharedAuth, sharedDb, verifySessionCookie, verifyIdToken, createSessionCookie, mockDoc, mockCollection } = vi.hoisted(() => {
  const verifySessionCookie = vi.fn();
  const verifyIdToken = vi.fn();
  const createSessionCookie = vi.fn();

  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockGet = vi.fn(() => ({ exists: false }));
  const mockDoc = vi.fn(() => ({
    set: mockSet,
    update: mockUpdate,
    get: mockGet,
  }));
  const mockCollection = vi.fn(() => ({
    doc: mockDoc,
  }));

  const sharedAuth = {
    verifySessionCookie,
    verifyIdToken,
    createSessionCookie,
  };

  const sharedDb = {
    collection: mockCollection,
  };

  return {
    sharedAuth,
    sharedDb,
    verifySessionCookie,
    verifyIdToken,
    createSessionCookie,
    mockDoc,
    mockCollection,
  };
});

vi.mock("firebase-admin", () => {
  const mockApp = { name: "[DEFAULT]" };
  return {
    default: {
      apps: [mockApp],
      app: vi.fn(() => mockApp),
      initializeApp: vi.fn(() => mockApp),
      auth: vi.fn(() => sharedAuth),
      firestore: vi.fn(() => sharedDb),
    },
    apps: [mockApp],
    app: vi.fn(() => mockApp),
    initializeApp: vi.fn(() => mockApp),
    auth: vi.fn(() => sharedAuth),
    firestore: vi.fn(() => sharedDb),
  };
});

vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: "[DEFAULT]" }]),
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  cert: vi.fn(),
  applicationDefault: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => sharedAuth),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => sharedDb),
}));

const mockCookiesStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookiesStore),
}));

import { getAuth } from "firebase-admin/auth";
import { GET, POST, DELETE } from "@/app/api/auth/session/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/session-constants";
import fs from "fs";
import path from "path";

const authInstance = getAuth();
const LONG_ID_TOKEN = "a".repeat(120);
const VALID_CSRF = "csrf-token-12345";

describe("Cleanroom Authentication Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.get.mockImplementation((name) => {
      if (name === CSRF_COOKIE_NAME) {
        return { value: VALID_CSRF };
      }
      return undefined;
    });
  });

  it("session GET: no session cookie returns 200 with authenticated=false", async () => {
    mockCookiesStore.get.mockImplementation((name) => {
      if (name === SESSION_COOKIE_NAME) return undefined;
      return { value: VALID_CSRF };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.user).toBeNull();
  });

  it("session GET: valid session cookie returns authenticated user details", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-123",
      email: "test@cbamvalid.com",
    } as any);

    mockCookiesStore.get.mockImplementation((name) => {
      if (name === SESSION_COOKIE_NAME) {
        return { name: SESSION_COOKIE_NAME, value: "valid-session" };
      }
      return { value: VALID_CSRF };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.uid).toBe("user-123");
    expect(body.user.email).toBe("test@cbamvalid.com");
  });

  it("session POST: missing CSRF token returns 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("CSRF");
  });

  it("session POST: mismatched CSRF token returns 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: "attacker-csrf-token",
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("session POST: invalid ID token returns 401", async () => {
    const tokenError = new Error("Invalid ID token");
    vi.mocked(authInstance.verifyIdToken).mockRejectedValue(tokenError);

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: VALID_CSRF,
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("session POST: valid fresh token creates cookie and fires DB merges", async () => {
    vi.mocked(authInstance.verifyIdToken).mockResolvedValue({
      uid: "user-123",
      email: "test@cbamvalid.com",
      auth_time: Math.floor(Date.now() / 1000) - 10,
    } as any);

    vi.mocked(authInstance.createSessionCookie).mockResolvedValue("mocked-session-cookie-value");

    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: VALID_CSRF,
      },
      body: JSON.stringify({ idToken: LONG_ID_TOKEN }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.uid).toBe("user-123");

    // Verify correct cookie settings and doc sync
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("mocked-session-cookie-value");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockDoc).toHaveBeenCalledWith("user-123");
  });

  it("session DELETE: clears session cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "DELETE",
      headers: {
        [CSRF_HEADER_NAME]: VALID_CSRF,
      },
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("");
  });

  it("structural check: assert single client and admin initializers exist", () => {
    const clientPath = path.join(process.cwd(), "lib/firebase/client.ts");
    const adminPath = path.join(process.cwd(), "lib/firebase/admin.ts");
    expect(fs.existsSync(clientPath)).toBe(true);
    expect(fs.existsSync(adminPath)).toBe(true);
  });

  it("structural check: assert no redirect methods are referenced in client auth flows", () => {
    const loginPagePath = path.join(process.cwd(), "app/(auth)/login/page.tsx");
    const registerPagePath = path.join(process.cwd(), "app/(auth)/register/page.tsx");
    
    const loginContent = fs.readFileSync(loginPagePath, "utf8");
    const registerContent = fs.readFileSync(registerPagePath, "utf8");

    expect(loginContent.includes("signInWithRedirect")).toBe(false);
    expect(loginContent.includes("getRedirectResult")).toBe(false);
    expect(registerContent.includes("signInWithRedirect")).toBe(false);
    expect(registerContent.includes("getRedirectResult")).toBe(false);
  });
});
