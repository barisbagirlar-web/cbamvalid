/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock server-only in Vitest environment
vi.mock("server-only", () => ({}));

const { sharedAuth, verifyIdToken, mockUser } = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const sharedAuth = {
    verifyIdToken,
  };
  const mockUser = {
    getIdToken: vi.fn(),
  };
  return {
    sharedAuth,
    verifyIdToken,
    mockUser,
  };
});

// Mock getAdminAuth/getAdminDb helpers directly
vi.mock("@/lib/firebase/admin", () => {
  return {
    getAdminAuth: () => sharedAuth,
    getAdminDb: () => ({}),
  };
});

// Mock Firebase Client Auth
vi.mock("@/lib/firebase/client", () => {
  return {
    firebaseAuth: {
      currentUser: mockUser,
    },
  };
});

import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";
import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";
import { NextRequest } from "next/server";

describe("Cleanroom Authentication Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireFirebaseUser", () => {
    it("throws 401 if Authorization header is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/some-endpoint");
      await expect(requireFirebaseUser(req)).rejects.toMatchObject({
        status: 401,
        message: "Missing or invalid authorization header.",
      });
    });

    it("throws 401 if Authorization header does not start with Bearer", async () => {
      const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
        headers: { Authorization: "Basic dGVzdDp0ZXN0" },
      });
      await expect(requireFirebaseUser(req)).rejects.toMatchObject({
        status: 401,
        message: "Missing or invalid authorization header.",
      });
    });

    it("throws 401 if Bearer token is empty", async () => {
      const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
        headers: { Authorization: "Bearer " },
      });
      await expect(requireFirebaseUser(req)).rejects.toMatchObject({
        status: 401,
        message: "Bearer token is empty.",
      });
    });

    it("returns decoded token payload if token is valid", async () => {
      const mockPayload = { uid: "user-123", email: "test@cbamvalid.com" };
      verifyIdToken.mockResolvedValueOnce(mockPayload);

      const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
        headers: { Authorization: "Bearer valid-token" },
      });

      const user = await requireFirebaseUser(req);
      expect(user).toEqual(mockPayload);
      expect(verifyIdToken).toHaveBeenCalledWith("valid-token");
    });

    it("throws 401 if verifyIdToken fails with Firebase auth error", async () => {
      const firebaseError = new Error("Token expired");
      (firebaseError as any).code = "auth/id-token-expired";
      verifyIdToken.mockRejectedValueOnce(firebaseError);

      const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
        headers: { Authorization: "Bearer expired-token" },
      });

      await expect(requireFirebaseUser(req)).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining("Unauthorized"),
      });
    });

    it("throws 500 if verifyIdToken fails with unexpected database error", async () => {
      const sysError = new Error("Database connection timed out");
      verifyIdToken.mockRejectedValueOnce(sysError);

      const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
        headers: { Authorization: "Bearer connection-fail-token" },
      });

      await expect(requireFirebaseUser(req)).rejects.toMatchObject({
        status: 500,
        message: expect.stringContaining("Internal authentication failure"),
      });
    });
  });

  describe("authenticatedFetch", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("attaches Authorization header with ID token", async () => {
      mockUser.getIdToken.mockResolvedValueOnce("cached-token");
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("success", { status: 200 }));

      await authenticatedFetch("/api/test");

      expect(mockUser.getIdToken).toHaveBeenCalledWith();
      expect(global.fetch).toHaveBeenCalledWith("/api/test", {
        headers: expect.any(Headers),
      });

      const headersCall = vi.mocked(global.fetch).mock.calls[0][1]?.headers as Headers;
      expect(headersCall.get("Authorization")).toBe("Bearer cached-token");
    });

    it("retries once with force refreshed token if fetch returns 401", async () => {
      mockUser.getIdToken.mockResolvedValueOnce("cached-token");
      mockUser.getIdToken.mockResolvedValueOnce("fresh-token");

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
        .mockResolvedValueOnce(new Response("success", { status: 200 }));

      await authenticatedFetch("/api/test");

      expect(mockUser.getIdToken).toHaveBeenCalledTimes(2);
      expect(mockUser.getIdToken).toHaveBeenNthCalledWith(1);
      expect(mockUser.getIdToken).toHaveBeenNthCalledWith(2, true);

      expect(global.fetch).toHaveBeenCalledTimes(2);

      const firstHeaders = vi.mocked(global.fetch).mock.calls[0][1]?.headers as Headers;
      const secondHeaders = vi.mocked(global.fetch).mock.calls[1][1]?.headers as Headers;

      expect(firstHeaders.get("Authorization")).toBe("Bearer cached-token");
      expect(secondHeaders.get("Authorization")).toBe("Bearer fresh-token");
    });
  });
});
