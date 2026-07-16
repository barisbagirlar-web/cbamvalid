import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  verifySessionCookie,
  createSessionCookie,
  verifyIdToken,
  mockCookiesSet,
  mockCookiesGet,
} = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  createSessionCookie: vi.fn(),
  verifyIdToken: vi.fn(),
  mockCookiesSet: vi.fn(),
  mockCookiesGet: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifySessionCookie,
    createSessionCookie,
    verifyIdToken,
  },
  adminDb: {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
  }),
}));

import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";
import { POST as sessionPost } from "@/app/api/auth/session/route";
import { POST as retiredCheckoutPost } from "@/app/api/checkout/cbam/route";
import { POST as retiredWebhookPost } from "@/app/api/webhooks/paddle/route";
import {
  calculateEntryHash,
  deriveLedgerEntryId,
} from "../../functions/src/commerce/ledger-service";

const SESSION_COOKIE = "__session";

function verifiedIdTokenClaims() {
  return {
    uid: "user-123",
    email: "user@cbamvalid.com",
    email_verified: true,
    auth_time: Math.floor(Date.now() / 1000) - 10,
  };
}

describe("Production Security and Foundation Audits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a Firebase ID token used directly as a session cookie", async () => {
    mockCookiesGet.mockReturnValue({ value: "firebase-id-token" });
    verifySessionCookie.mockRejectedValueOnce(new Error("issuer mismatch"));
    await expect(requireFirebaseSession()).rejects.toThrow("Session expired or invalid cookie.");
  });

  it("creates a revocation-checkable HttpOnly cookie only for a verified email", async () => {
    verifyIdToken.mockResolvedValueOnce(verifiedIdTokenClaims());
    createSessionCookie.mockResolvedValueOnce("firebase-session-cookie");

    const response = await sessionPost(new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: "valid-id-token" }),
    }));

    expect(response.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith("valid-id-token", true);
    expect(mockCookiesSet).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "firebase-session-cookie",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  it("refuses a server session for an unverified email token", async () => {
    verifyIdToken.mockResolvedValueOnce({
      ...verifiedIdTokenClaims(),
      email_verified: false,
    });

    const response = await sessionPost(new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: "unverified-id-token" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "EMAIL_VERIFICATION_REQUIRED" },
    });
    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it("returns structured unauthorized errors for missing and invalid sessions", async () => {
    mockCookiesGet.mockReturnValueOnce(null);
    await expect(requireFirebaseSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing session cookie.",
    });

    mockCookiesGet.mockReturnValueOnce({ value: "expired-cookie" });
    verifySessionCookie.mockRejectedValueOnce(new Error("expired"));
    await expect(requireFirebaseSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Session expired or invalid cookie.",
    });
  });

  it("accepts a valid server session", async () => {
    const claims = { uid: "user-123", email: "user@cbamvalid.com", email_verified: true };
    mockCookiesGet.mockReturnValue({ value: "valid-session" });
    verifySessionCookie.mockResolvedValueOnce(claims);
    await expect(requireFirebaseSession()).resolves.toEqual(claims);
  });

  it("keeps the duplicate Next checkout route permanently retired", async () => {
    const response = await retiredCheckoutPost();
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "CHECKOUT_ROUTE_RETIRED" },
    });
  });

  it("keeps the false-acknowledgement Next webhook route permanently retired", async () => {
    const response = await retiredWebhookPost();
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "WEBHOOK_ROUTE_RETIRED" },
    });
  });

  it("derives deterministic ledger identities without mutable chain-head queries", () => {
    expect(deriveLedgerEntryId("payment:txn_123")).toBe(deriveLedgerEntryId("payment:txn_123"));
    expect(deriveLedgerEntryId("payment:txn_123")).not.toBe(deriveLedgerEntryId("payment:txn_124"));

    const baseEntry = {
      entryId: deriveLedgerEntryId("payment:txn_123"),
      uid: "user-123",
      orderId: "ord_123",
      transactionId: "txn_123",
      eventId: "evt_123",
      type: "PAYMENT_CAPTURED" as const,
      quantity: 1,
      currency: "USD",
      amountMinor: 14900,
      createdAt: "2026-07-16T00:00:00.000Z",
      idempotencyKey: "payment:txn_123",
    };
    const first = calculateEntryHash(baseEntry);
    const second = calculateEntryHash({ ...baseEntry });
    const tampered = calculateEntryHash({ ...baseEntry, amountMinor: 1 });
    expect(first).toBe(second);
    expect(tampered).not.toBe(first);
  });

  it("imports firebase-admin in the production Node environment", async () => {
    const admin = await import("firebase-admin");
    expect(admin.initializeApp).toBeDefined();
  });
});
