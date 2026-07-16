import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { verifySessionCookie, createSessionCookie, verifyIdToken, mockCookiesSet } = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  createSessionCookie: vi.fn(),
  verifyIdToken: vi.fn(),
  mockCookiesSet: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifySessionCookie,
    createSessionCookie,
    verifyIdToken,
  },
  adminDb: {},
}));

const mockGetCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockGetCookie,
    set: mockCookiesSet,
  }),
}));

import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";
import { POST, DELETE } from "@/app/api/auth/session/route";

describe("Firebase Auth Session Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireFirebaseSession helper", () => {
    it("throws 401 if session cookie is missing", async () => {
      mockGetCookie.mockReturnValueOnce(null);
      await expect(requireFirebaseSession()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Missing session cookie.",
      });
    });

    it("verifies and returns decoded session cookie if valid", async () => {
      const mockClaims = { uid: "user-123", email: "test@cbamvalid.com" };
      mockGetCookie.mockReturnValueOnce({ value: "valid-cookie-token" });
      verifySessionCookie.mockResolvedValueOnce(mockClaims);
      const decoded = await requireFirebaseSession();
      expect(decoded).toEqual(mockClaims);
      expect(verifySessionCookie).toHaveBeenCalledWith("valid-cookie-token", true);
    });

    it("throws 401 if verification fails", async () => {
      mockGetCookie.mockReturnValueOnce({ value: "invalid-cookie-token" });
      verifySessionCookie.mockRejectedValueOnce(new Error("Token revoked"));
      await expect(requireFirebaseSession()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Session expired or invalid cookie.",
      });
    });

    it("guarantees ID Token is rejected by verifySessionCookie", async () => {
      mockGetCookie.mockReturnValueOnce({ value: "firebase-id-token" });
      verifySessionCookie.mockRejectedValueOnce(new Error("Decoding firebase session cookie failed"));
      await expect(requireFirebaseSession()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("Session Route POST (exchange ID token)", () => {
    it("returns 400 for malformed json request", async () => {
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        body: "not-json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("BAD_REQUEST");
    });

    it("returns 400 if token is missing", async () => {
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("MISSING_TOKEN");
    });

    it("returns recent-authentication-required if a verified token auth_time is stale", async () => {
      const staleAuthTime = Math.floor(Date.now() / 1000) - 20 * 60;
      verifyIdToken.mockResolvedValueOnce({
        uid: "user-123",
        email: "user@example.com",
        email_verified: true,
        auth_time: staleAuthTime,
      });
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "stale-token" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("AUTH_RECENT_REQUIRED");
    });

    it("returns success and sets cookie for a recent verified ID token", async () => {
      const recentAuthTime = Math.floor(Date.now() / 1000) - 60;
      verifyIdToken.mockResolvedValueOnce({
        uid: "user-123",
        email: "user@example.com",
        email_verified: true,
        auth_time: recentAuthTime,
      });
      createSessionCookie.mockResolvedValueOnce("new-session-cookie-value");
      const req = new Request("http://localhost/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-id-token" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
      expect(verifyIdToken).toHaveBeenCalledWith("valid-id-token", true);
      expect(createSessionCookie).toHaveBeenCalledWith("valid-id-token", {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
      expect(mockCookiesSet).toHaveBeenCalledWith(
        "__session",
        "new-session-cookie-value",
        expect.objectContaining({
          maxAge: 5 * 24 * 60 * 60,
          httpOnly: true,
        })
      );
    });
  });

  describe("Session Route DELETE (signout)", () => {
    it("sets __session max-age to 0 and returns ok", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
      expect(mockCookiesSet).toHaveBeenCalledWith(
        "__session",
        "",
        expect.objectContaining({ maxAge: 0 })
      );
    });
  });
});
