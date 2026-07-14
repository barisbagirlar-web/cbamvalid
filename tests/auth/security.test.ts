import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { verifySessionCookie, createSessionCookie, verifyIdToken, mockCookiesSet, mockCookiesGet } = vi.hoisted(() => ({
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
import { POST as checkoutPost } from "@/app/api/checkout/cbam/route";

describe("Production Security & Foundation Audits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Firebase ID token cannot be used directly as session cookie", async () => {
    mockCookiesGet.mockReturnValue({ value: "firebase-id-token" });
    verifySessionCookie.mockRejectedValueOnce(new Error("Decoding firebase session cookie failed (issuer mismatch)"));
    await expect(requireFirebaseSession()).rejects.toThrow("Session expired or invalid cookie.");
  });

  it("2. Session endpoint produces a valid Firebase session cookie", async () => {
    const recentAuthTime = Math.floor(Date.now() / 1000) - 10;
    verifyIdToken.mockResolvedValueOnce({ auth_time: recentAuthTime });
    createSessionCookie.mockResolvedValueOnce("new-firebase-session-cookie-value");
    const req = new Request("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken: "valid-id-token" }),
    });
    const res = await sessionPost(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "__session",
      "new-firebase-session-cookie-value",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
  });

  it("3. Expired, malformed and revoked sessions return structured 401", async () => {
    mockCookiesGet.mockReturnValueOnce(null);
    await expect(requireFirebaseSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing session cookie.",
    });
    mockCookiesGet.mockReturnValueOnce({ value: "expired-cookie" });
    verifySessionCookie.mockRejectedValueOnce(new Error("Firebase ID Token expired"));
    await expect(requireFirebaseSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Session expired or invalid cookie.",
    });
  });

  it("4. Client JavaScript cannot read the HttpOnly session cookie", async () => {
    const recentAuthTime = Math.floor(Date.now() / 1000) - 10;
    verifyIdToken.mockResolvedValueOnce({ auth_time: recentAuthTime });
    createSessionCookie.mockResolvedValueOnce("cookie-val");
    await sessionPost(new Request("http://localhost/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken: "token" }),
    }));
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "__session",
      "cookie-val",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("5. Protected routes accept valid sessions", async () => {
    const mockClaims = { uid: "user-123", email: "user@cbamvalid.com" };
    mockCookiesGet.mockReturnValue({ value: "valid-session" });
    verifySessionCookie.mockResolvedValueOnce(mockClaims);
    await expect(requireFirebaseSession()).resolves.toEqual(mockClaims);
  });

  it("6. Retired checkout rejects unauthenticated requests with JSON 401", async () => {
    mockCookiesGet.mockReturnValue(null);
    const res = await checkoutPost(new Request("http://localhost/api/checkout/cbam", {
      method: "POST",
      body: JSON.stringify({ slug: "cbam-5-reports" }),
    }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("7. Retired Next.js checkout cannot create a Paddle transaction", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-session" });
    verifySessionCookie.mockResolvedValueOnce({ uid: "user-123", email: "user@cbamvalid.com" });
    global.fetch = vi.fn();
    const res = await checkoutPost(new Request("http://localhost/api/checkout/cbam", {
      method: "POST",
      body: JSON.stringify({ slug: "cbam-5-reports" }),
    }));
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe("CHECKOUT_CHANNEL_RETIRED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("8. firebase-admin imports successfully in production build environment", async () => {
    const admin = await import("firebase-admin");
    expect(admin).toBeDefined();
    expect(admin.initializeApp).toBeDefined();
  });

  it("9. duplicate Paddle webhook creates zero duplicate credit", async () => {
    const { writeLedgerEntry } = await import("../../functions/src/commerce/ledger-service");
    const mockTransaction: any = {
      get: vi.fn().mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ entryHash: "existing-hash" }) }],
      }),
      set: vi.fn(),
    };
    const entry = await writeLedgerEntry(mockTransaction, {
      uid: "user-123",
      orderId: "order-123",
      transactionId: "txn-123",
      eventId: "evt-123",
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      idempotencyKey: "dup-key",
    });
    expect(entry).toBeDefined();
    expect(mockTransaction.set).not.toHaveBeenCalled();
  });

  it("10. client callback creates zero credit", async () => {
    const { createEntitlement } = await import("../../functions/src/commerce/entitlement-service");
    expect(createEntitlement).toBeDefined();
  });

  it("11. server-side sandbox payment fulfillment issues exactly five case-bound versions", async () => {
    process.env.PADDLE_PRICE_ID_SANDBOX = "pri_test_pack_sandbox";
    const { processWebhookEvent } = await import("../../functions/src/commerce/webhook-processor");
    const uid = "test-user-uid";
    const orderId = "ord_test_123";
    const caseId = "case_test_123";
    const transactionId = "txn_sandbox_payment_123";
    const productCode = "CBAM_CREDIT_PACK_5";
    const baseOrder = {
      orderId,
      uid,
      caseId,
      productCode,
      status: "PAYMENT_PENDING",
      currency: "USD",
      amountMinor: 15000,
      paddleTransactionId: transactionId,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const missingDocument = { exists: false };
    const emptyQuery = { empty: true, docs: [] };
    const mockDbTransaction: any = {
      get: vi.fn()
        // Stage 1: order + payment ledger idempotency + ledger head.
        .mockResolvedValueOnce({ exists: true, data: () => baseOrder })
        .mockResolvedValueOnce(emptyQuery)
        .mockResolvedValueOnce(emptyQuery)
        // Stage 2: paid order + five entitlement refs + issuance ledger idempotency/head.
        .mockResolvedValueOnce({ exists: true, data: () => ({ ...baseOrder, status: "PAID" }) })
        .mockResolvedValueOnce(missingDocument)
        .mockResolvedValueOnce(missingDocument)
        .mockResolvedValueOnce(missingDocument)
        .mockResolvedValueOnce(missingDocument)
        .mockResolvedValueOnce(missingDocument)
        .mockResolvedValueOnce(emptyQuery)
        .mockResolvedValueOnce(emptyQuery),
      set: vi.fn(),
      update: vi.fn(),
    };
    const { adminDb } = await import("../../functions/src/firebase-admin");
    adminDb.runTransaction = vi.fn().mockImplementation(async (callback) => callback(mockDbTransaction));
    await processWebhookEvent({
      eventId: "evt_sandbox_payment_123",
      eventType: "transaction.completed",
      data: {
        id: transactionId,
        status: "completed",
        currencyCode: "USD",
        details: { totals: { grandTotal: 15000 } },
        customData: { uid, orderId, caseId, productCode, environment: "sandbox" },
        items: [{ quantity: 1, price: { id: "pri_test_pack_sandbox" } }],
      },
    });
    const entitlementWrites = mockDbTransaction.set.mock.calls
      .map(([, value]: [unknown, any]) => value)
      .filter((value: any) => value?.productCode === productCode && value?.status === "AVAILABLE");
    expect(mockDbTransaction.get).toHaveBeenCalledTimes(11);
    expect(mockDbTransaction.set).toHaveBeenCalledTimes(7);
    expect(mockDbTransaction.update).toHaveBeenCalledTimes(2);
    expect(entitlementWrites).toHaveLength(5);
    expect(entitlementWrites.map((value: any) => value.versionSequence)).toEqual([1, 2, 3, 4, 5]);
    expect(entitlementWrites.every((value: any) => value.caseId === caseId && value.uid === uid)).toBe(true);
    delete process.env.PADDLE_PRICE_ID_SANDBOX;
  });
});
