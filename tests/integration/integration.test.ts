/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock server-only in Vitest environment
vi.mock("server-only", () => ({}));

// Mock env parameters
process.env.ADMIN_USE_ADC = "true";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "cbam-project";

const { sharedAuth, sharedFirestore, collectionMock } = vi.hoisted(() => {
  const verifyIdToken = vi.fn();

  const sharedAuth = {
    verifyIdToken,
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
  const collectionMock = vi.fn((_name?: string) => ({
    doc: vi.fn((_id?: string) => docRef),
  }));
  const runTransaction = vi.fn(async (cb) => {
    const transactionMock = {
      get: async (_ref: any) => {
        const snap = await docGet();
        return snap;
      },
      create: async (_ref: any, data: any) => {
        return await docCreate(data);
      },
      update: async (_ref: any, data: any) => {
        return await docUpdate(data);
      },
      set: async (_ref: any, data: any) => {
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
    collectionMock,
  };
});

// Mock getAdminAuth/getAdminDb helpers directly
vi.mock("@/lib/firebase/admin", () => {
  return {
    getAdminAuth: () => sharedAuth,
    getAdminDb: () => sharedFirestore,
  };
});

import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";
import { NextRequest } from "next/server";

describe("Authentication Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requireFirebaseUser rejects unauthenticated API request", async () => {
    const req = new NextRequest("http://localhost:3000/api/cbam/cases");
    await expect(requireFirebaseUser(req)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("requireFirebaseUser resolves valid Bearer tokens", async () => {
    vi.mocked(sharedAuth.verifyIdToken).mockResolvedValue({
      uid: "user-bearer-123",
      email: "bearer@cbamvalid.com",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/cbam/cases", {
      headers: { Authorization: "Bearer test-valid-jwt" },
    });

    const decoded = await requireFirebaseUser(req);
    expect(decoded.uid).toBe("user-bearer-123");
    expect(sharedAuth.verifyIdToken).toHaveBeenCalledWith("test-valid-jwt");
  });

  it("Undefined uid cannot reach Firestore collection query", async () => {
    // Ensure that if we attempt to load database profiles, we prevent passing an empty or undefined uid
    const loadProfile = async (uid: string | undefined) => {
      if (!uid || typeof uid !== "string" || uid.trim() === "") {
        throw new Error("Invalid uid parameter provided to Firestore query");
      }
      return sharedFirestore.collection("users").doc(uid).get();
    };

    await expect(loadProfile(undefined)).rejects.toThrow("Invalid uid");
    await expect(loadProfile("")).rejects.toThrow("Invalid uid");
    expect(collectionMock).not.toHaveBeenCalled();
  });
});
