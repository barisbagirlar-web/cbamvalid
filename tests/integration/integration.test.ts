/* eslint-disable */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock server-only in Vitest environment
vi.mock("server-only", () => ({}));

// Mock env parameters
process.env.ADMIN_USE_ADC = "true";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "cbam-project";

// Setup single stable mock cookie store
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// Setup mocks BEFORE importing the targets
const verifySessionCookie = vi.fn();

const sharedAuth = {
  verifySessionCookie,
};

const docGet = vi.fn();
const docCreate = vi.fn();
const docUpdate = vi.fn();
const docSet = vi.fn();
const docRef = {
  get: docGet,
  create: docCreate,
  update: docUpdate,
  set: docSet,
};
const collectionMock = vi.fn(() => ({
  doc: vi.fn(() => docRef),
}));
const runTransaction = vi.fn(async (cb) => {
  const transactionMock = {
    get: async (ref: any) => {
      const snap = await docGet();
      return snap;
    },
    create: async (ref: any, data: any) => {
      return await docCreate(data);
    },
    update: async (ref: any, data: any) => {
      return await docUpdate(data);
    },
    set: async (ref: any, data: any) => {
      return await docSet(data);
    },
  };
  return await cb(transactionMock);
});

const sharedFirestore = {
  collection: collectionMock,
  runTransaction,
};

vi.mock("firebase-admin", () => {
  const mockApp = { name: "[DEFAULT]" };
  return {
    default: {
      apps: [mockApp],
      app: vi.fn(() => mockApp),
      initializeApp: vi.fn(() => mockApp),
      auth: vi.fn(() => sharedAuth),
      firestore: Object.assign(vi.fn(() => sharedFirestore), {
        FieldValue: {
          serverTimestamp: () => "server-timestamp-val",
        },
      }),
    },
    apps: [mockApp],
    app: vi.fn(() => mockApp),
    initializeApp: vi.fn(() => mockApp),
    auth: vi.fn(() => sharedAuth),
    firestore: Object.assign(vi.fn(() => sharedFirestore), {
      FieldValue: {
        serverTimestamp: () => "server-timestamp-val",
      },
    }),
  };
});

vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: "[DEFAULT]" }]),
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  cert: vi.fn(),
  applicationDefault: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => {
  return {
    getAuth: vi.fn(() => sharedAuth),
  };
});

vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(() => sharedFirestore),
    FieldValue: {
      serverTimestamp: () => "server-timestamp-val",
    },
  };
});

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { provisionUserProfile } from "@/lib/auth/provision-user";
import { requireAdmin, requireSession } from "@/lib/auth/require-session";
import { POST as adminTokensRoute } from "@/app/api/admin/tokens/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-config";

const authInstance = getAuth();
const firestoreInstance = getFirestore();

// Helper to access nested mock references from mocked getFirestore()
const mockDocRef = firestoreInstance.collection("users").doc("dummy");

describe("Authentication Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("New user profile created exactly once", async () => {
    vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);
    vi.mocked(mockDocRef.create).mockResolvedValue(null as any);

    const decodedToken = {
      uid: "user-999",
      email: "new@cbamvalid.com",
      name: "New Exporter",
    } as any;

    await provisionUserProfile(decodedToken);

    expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    expect(mockDocRef.create).toHaveBeenCalledTimes(1);
    expect(mockDocRef.create).toHaveBeenCalledWith({
      uid: "user-999",
      email: "new@cbamvalid.com",
      name: "New Exporter",
      role: "user",
      accountStatus: "active",
      createdAt: "server-timestamp-val",
      updatedAt: "server-timestamp-val",
    });
  });

  it("Existing user profile not overwritten and tokens not modified", async () => {
    vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true, data: () => ({ tokens: 42, role: "user" }) } as any);

    const decodedToken = {
      uid: "user-999",
      email: "new@cbamvalid.com",
      name: "New Exporter",
    } as any;

    await provisionUserProfile(decodedToken);

    expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    expect(mockDocRef.create).not.toHaveBeenCalled();
    expect(mockDocRef.set).not.toHaveBeenCalled();
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("Normal user cannot become admin (checks role restriction in requireAdmin helper)", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-standard",
      email: "user@cbamvalid.com",
      name: "Standard Exporter",
      admin: false,
    } as any);

    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "std-cookie-value" });

    const session = await requireSession();
    expect(session.uid).toBe("user-standard");
    expect(session.admin).toBe(false);

    await expect(requireAdmin()).rejects.toThrow();
  });

  it("Custom-claim admin can access admin dashboard", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-admin",
      email: "baris@cbamvalid.com",
      name: "Admin Officer",
      admin: true,
    } as any);

    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "admin-cookie-value" });

    const session = await requireAdmin();
    expect(session.uid).toBe("user-admin");
    expect(session.admin).toBe(true);
  });

  it("Protected APIs reject no cookie (e.g. admin tokens route returns 401)", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/admin/tokens", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "user-1", tokensToSet: 10 }),
    });

    const res = await adminTokensRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("Protected APIs reject corrupt cookie", async () => {
    const err = new Error("Invalid session");
    (err as any).code = "auth/invalid-session-cookie";
    vi.mocked(authInstance.verifySessionCookie).mockRejectedValue(err);
    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "corrupted-cookie-value" });

    const req = new NextRequest("http://localhost:3000/api/admin/tokens", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "user-1", tokensToSet: 10 }),
    });

    const res = await adminTokensRoute(req);
    expect(res.status).toBe(401);
  });

  it("Protected APIs reject normal user where admin custom claim is required (returns 403)", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-standard",
      email: "user@cbamvalid.com",
      admin: false,
    } as any);
    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "std-cookie-value" });

    const req = new NextRequest("http://localhost:3000/api/admin/tokens", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "user-1", tokensToSet: 10 }),
    });

    const res = await adminTokensRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("getSession verification uses offline mode (checkRevoked=false)", async () => {
    const { getSession } = await import("@/lib/auth/session-cookie");
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-offline",
      email: "offline@cbamvalid.com",
      admin: false,
    } as any);
    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "offline-cookie" });

    const session = await getSession();
    expect(session?.uid).toBe("user-offline");
    expect(authInstance.verifySessionCookie).toHaveBeenCalledWith("offline-cookie", false);
  });

  it("getSessionRevocationSensitive verification uses online mode (checkRevoked=true)", async () => {
    const { getSessionRevocationSensitive } = await import("@/lib/auth/session-cookie");
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-online",
      email: "online@cbamvalid.com",
      admin: true,
    } as any);
    mockCookieStore.get.mockReturnValue({ name: SESSION_COOKIE_NAME, value: "online-cookie" });

    const session = await getSessionRevocationSensitive();
    expect(session?.uid).toBe("user-online");
    expect(authInstance.verifySessionCookie).toHaveBeenCalledWith("online-cookie", true);
  });
});
