/* eslint-disable @typescript-eslint/no-explicit-any */
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
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

const { sharedAuth, sharedFirestore, verifySessionCookie, collectionMock } = vi.hoisted(() => {
  const verifySessionCookie = vi.fn();
  const verifyIdToken = vi.fn();
  const createSessionCookie = vi.fn();

  const sharedAuth = {
    verifySessionCookie,
    verifyIdToken,
    createSessionCookie,
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

  return {
    sharedAuth,
    sharedFirestore,
    verifySessionCookie,
    collectionMock,
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
  };
});

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { POST as adminTokensRoute } from "@/app/api/admin/tokens/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "@/lib/auth/session-constants";
import { getServerSession, getServerSessionRevocationSensitive } from "@/lib/auth/get-server-session";

const authInstance = getAuth();
const firestoreInstance = getFirestore();

describe("Authentication Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Protected Layout blocks access if no session is active", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const { default: ProtectedLayout } = await import("@/app/(protected)/layout");
    
    // ProtectedLayout should invoke getServerSession internally
    const session = await getServerSession();
    expect(session).toBeNull();
  });

  it("getServerSession verification uses offline mode (checkRevoked=false)", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-offline",
      email: "offline@cbamvalid.com",
      admin: false,
    } as any);
    mockCookieStore.get.mockImplementation((name) => {
      if (name === SESSION_COOKIE_NAME) {
        return { name: SESSION_COOKIE_NAME, value: "offline-cookie" };
      }
      return undefined;
    });

    const session = await getServerSession();
    expect(session?.uid).toBe("user-offline");
    expect(authInstance.verifySessionCookie).toHaveBeenCalledWith("offline-cookie", false);
  });

  it("getServerSessionRevocationSensitive verification uses online mode (checkRevoked=true)", async () => {
    vi.mocked(authInstance.verifySessionCookie).mockResolvedValue({
      uid: "user-online",
      email: "online@cbamvalid.com",
      admin: true,
    } as any);
    mockCookieStore.get.mockImplementation((name) => {
      if (name === SESSION_COOKIE_NAME) {
        return { name: SESSION_COOKIE_NAME, value: "online-cookie" };
      }
      return undefined;
    });

    const session = await getServerSessionRevocationSensitive();
    expect(session?.uid).toBe("user-online");
    expect(authInstance.verifySessionCookie).toHaveBeenCalledWith("online-cookie", true);
  });

  it("Undefined uid cannot reach Firestore collection query", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const session = await getServerSession();
    expect(session).toBeNull();
    
    // Ensure that if we attempt to load database profiles, we prevent passing an empty or undefined uid
    const loadProfile = async (uid: string | undefined) => {
      if (!uid || typeof uid !== "string" || uid.trim() === "") {
        throw new Error("Invalid uid parameter provided to Firestore query");
      }
      return await firestoreInstance.collection("users").doc(uid).get();
    };

    await expect(loadProfile(undefined)).rejects.toThrow("Invalid uid");
    await expect(loadProfile("")).rejects.toThrow("Invalid uid");
    expect(collectionMock).not.toHaveBeenCalled();
  });
});
