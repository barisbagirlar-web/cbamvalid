import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const userRef = { path: "users/user-123" };
  return {
    verifySessionCookie: vi.fn(),
    createSessionCookie: vi.fn(),
    verifyIdToken: vi.fn(),
    cookiesGet: vi.fn(),
    cookiesSet: vi.fn(),
    transactionGet: vi.fn(),
    transactionSet: vi.fn(),
    userRef,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifySessionCookie: mocks.verifySessionCookie,
    createSessionCookie: mocks.createSessionCookie,
    verifyIdToken: mocks.verifyIdToken,
  },
  adminDb: {
    collection: vi.fn(() => ({ doc: vi.fn(() => mocks.userRef) })),
    runTransaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback({
      get: mocks.transactionGet,
      set: mocks.transactionSet,
    })),
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.cookiesGet,
    set: mocks.cookiesSet,
  }),
}));

import { DELETE, GET, POST } from "@/app/api/auth/session/route";
import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";

const validIdToken = `header.${"a".repeat(120)}.signature`;

function postRequest(body: string, origin = "http://localhost"): Request {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body,
  });
}

function deleteRequest(origin = "http://localhost"): Request {
  return new Request("http://localhost/api/auth/session", {
    method: "DELETE",
    headers: { origin },
  });
}

describe("Firebase authentication session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionGet.mockResolvedValue({ exists: false, data: () => undefined });
  });

  describe("requireFirebaseSession", () => {
    it("rejects a missing session cookie", async () => {
      mocks.cookiesGet.mockReturnValueOnce(undefined);
      await expect(requireFirebaseSession()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Missing session cookie.",
      });
    });

    it("verifies session cookies with revocation checks", async () => {
      const claims = { uid: "user-123", email: "test@cbamvalid.com" };
      mocks.cookiesGet.mockReturnValueOnce({ value: "valid-cookie" });
      mocks.verifySessionCookie.mockResolvedValueOnce(claims);
      await expect(requireFirebaseSession()).resolves.toEqual(claims);
      expect(mocks.verifySessionCookie).toHaveBeenCalledWith("valid-cookie", true);
    });

    it("rejects revoked or malformed session cookies", async () => {
      mocks.cookiesGet.mockReturnValueOnce({ value: "invalid-cookie" });
      mocks.verifySessionCookie.mockRejectedValueOnce(new Error("Token revoked"));
      await expect(requireFirebaseSession()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    });
  });

  describe("GET session status", () => {
    it("returns the authenticated UID only after revocation-checked verification", async () => {
      mocks.cookiesGet.mockReturnValueOnce({ value: "valid-cookie" });
      mocks.verifySessionCookie.mockResolvedValueOnce({ uid: "user-123" });
      const response = await GET();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        data: { authenticated: true, uid: "user-123" },
      });
    });

    it("clears and rejects an invalid cookie", async () => {
      mocks.cookiesGet.mockReturnValueOnce({ value: "invalid-cookie" });
      mocks.verifySessionCookie.mockRejectedValueOnce(new Error("expired"));
      const response = await GET();
      expect(response.status).toBe(401);
      expect(mocks.cookiesSet).toHaveBeenCalledWith("__session", "", expect.objectContaining({ maxAge: 0 }));
    });
  });

  describe("POST token exchange", () => {
    it("rejects cross-origin requests before token processing", async () => {
      const response = await POST(postRequest(JSON.stringify({ idToken: validIdToken }), "https://attacker.invalid"));
      expect(response.status).toBe(403);
      expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON and invalid token shapes", async () => {
      expect((await POST(postRequest("not-json"))).status).toBe(400);
      expect((await POST(postRequest(JSON.stringify({ idToken: "short" })))).status).toBe(400);
    });

    it("requires recent authentication", async () => {
      mocks.verifyIdToken.mockResolvedValueOnce({
        uid: "user-123",
        auth_time: Math.floor(Date.now() / 1000) - 20 * 60,
      });
      const response = await POST(postRequest(JSON.stringify({ idToken: validIdToken })));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_RECENT_REQUIRED" } });
    });

    it("upserts the server profile before issuing an HttpOnly cookie", async () => {
      mocks.verifyIdToken.mockResolvedValueOnce({
        uid: "user-123",
        email: "user@example.com",
        name: "Test User",
        auth_time: Math.floor(Date.now() / 1000) - 30,
      });
      mocks.createSessionCookie.mockResolvedValueOnce("new-session-cookie");

      const response = await POST(postRequest(JSON.stringify({ idToken: validIdToken })));
      expect(response.status).toBe(200);
      expect(mocks.verifyIdToken).toHaveBeenCalledWith(validIdToken, true);
      expect(mocks.transactionGet).toHaveBeenCalledWith(mocks.userRef);
      expect(mocks.transactionSet).toHaveBeenCalledWith(
        mocks.userRef,
        expect.objectContaining({ uid: "user-123", email: "user@example.com", role: "user" }),
        { merge: true }
      );
      expect(mocks.createSessionCookie).toHaveBeenCalledWith(validIdToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
      expect(mocks.cookiesSet).toHaveBeenCalledWith(
        "__session",
        "new-session-cookie",
        expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
      );
    });
  });

  describe("DELETE session", () => {
    it("requires same-origin and expires the server cookie", async () => {
      expect((await DELETE(deleteRequest("https://attacker.invalid"))).status).toBe(403);
      const response = await DELETE(deleteRequest());
      expect(response.status).toBe(200);
      expect(mocks.cookiesSet).toHaveBeenCalledWith(
        "__session",
        "",
        expect.objectContaining({ maxAge: 0, httpOnly: true, sameSite: "lax" })
      );
    });
  });
});
