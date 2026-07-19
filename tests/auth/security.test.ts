import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { verifySessionCookie, cookiesGet } = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  cookiesGet: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifySessionCookie },
  adminDb: {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));

import { POST as legacyCheckoutPost } from "@/app/api/checkout/cbam/route";
import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";
import { assertOrderTransition } from "../../functions/src/commerce/order-service";
import { calculateEntryHash } from "../../functions/src/commerce/ledger-service";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("production security and commercial authority boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects Firebase ID tokens when presented as session cookies", async () => {
    cookiesGet.mockReturnValueOnce({ value: "firebase-id-token" });
    verifySessionCookie.mockRejectedValueOnce(new Error("issuer mismatch"));
    await expect(requireFirebaseSession()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(verifySessionCookie).toHaveBeenCalledWith("firebase-id-token", true);
  });

  it("retires the duplicate Next.js checkout transaction endpoint", async () => {
    const response = await legacyCheckoutPost();
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "CHECKOUT_ROUTE_RETIRED" },
    });
  });

  it("keeps price, order identity and Paddle custom data off the browser checkout page", () => {
    const buyPage = source("app/(workspace)/credits/buy/page.tsx");
    expect(buyPage).toContain("createCommercialCheckout");
    expect(buyPage).toContain("transactionId: checkout.transactionId");
    expect(buyPage).not.toContain("priceId:");
    expect(buyPage).not.toContain("customData:");
    expect(buyPage).not.toContain("ord_${Date.now()}");
  });

  it("requires exact canonical product economics", () => {
    expect(COMMERCIAL_CONTRACT).toMatchObject({
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      currency: "USD",
      priceMinor: 14900,
      creditsGranted: 100,
      creditsRequiredToUnlock: 100,
      releasesPerPack: 5,
      subscription: false,
    });
  });

  it("fails closed on invalid order state transitions", () => {
    expect(() => assertOrderTransition("PAYMENT_PENDING", "CREDITS_GRANTED")).toThrow(
      "ORDER_STATE_TRANSITION_INVALID:PAYMENT_PENDING:CREDITS_GRANTED"
    );
    expect(() => assertOrderTransition("CREDITS_GRANTED", "PAYMENT_PENDING")).toThrow();
    expect(() => assertOrderTransition("PAYMENT_PENDING", "PAID")).not.toThrow();
    expect(() => assertOrderTransition("PAID", "CREDITS_GRANTED")).not.toThrow();
  });

  it("produces deterministic tamper-evident ledger hashes", () => {
    const base = {
      entryId: "led_123",
      uid: "user-123",
      orderId: "order-123",
      transactionId: "txn-123",
      eventId: "evt-123",
      type: "PAYMENT_CAPTURED" as const,
      quantity: 1,
      currency: "USD",
      amountMinor: 14900,
      createdAt: "2026-07-15T00:00:00.000Z",
      idempotencyKey: "payment:txn-123",
      previousEntryHash: "",
    };
    const first = calculateEntryHash(base);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(calculateEntryHash(base)).toBe(first);
    expect(calculateEntryHash({ ...base, amountMinor: 14901 })).not.toBe(first);
  });

  it("denies direct client writes to financial, entitlement and audit state", () => {
    const rules = source("firestore.rules");
    expect(rules).toContain("request.auth.token.email_verified == true");
    expect(rules).toContain("request.auth.token.admin == true");
    expect(rules).toContain("request.auth.token.ownerAdmin == true");
    for (const collection of [
      "commerce_orders",
      "entitlements",
      "commerce_ledger",
      "commerce_ledger_state",
      "paddle_events",
      "admin_audit",
    ]) {
      expect(rules).toContain(`match /${collection}/`);
    }
    expect(rules).toContain("match /{document=**}");
    expect(rules).toContain("allow read, write: if false;");
  });

  it("limits evidence deletion to a short rollback window and denies report writes", () => {
    const rules = source("storage.rules");
    expect(rules).toContain("request.time < resource.timeCreated + duration.value(15, 'm')");
    expect(rules).toContain("allow update: if false;");
    expect(rules).toContain("match /reports/{userId}/{reportId}/{allPaths=**}");
    expect(rules).toContain("allow write: if false;");
  });

  it("never acknowledges a production webhook without upstream processing", () => {
    const route = source("app/api/webhooks/paddle/route.ts");
    expect(route).toContain("PADDLE_WEBHOOK_FUNCTION_URL");
    expect(route).toContain("Paddle-Signature");
    expect(route).toContain("PADDLE_WEBHOOK_PROXY_UNAVAILABLE");
    expect(route).toContain("status: 503");
    expect(route).not.toContain('status: "success"');
  });

  it("requires a revocation-checked server session before workspace rendering", () => {
    const gate = source("lib/auth/session-gate.ts");
    const layout = source("app/(workspace)/layout.tsx");
    expect(gate).toContain("verifySessionCookie(sessionCookie, true)");
    expect(layout).toContain("await requireAuthenticatedSession()");
  });

  it("requires all canonical owner-admin claims across server and rules", () => {
    const serverGate = source("lib/auth/admin-gate.ts");
    const callableGate = source("functions/src/handlers/admin.ts");
    expect(serverGate).toContain("decodedClaims.email_verified === true");
    expect(serverGate).toContain("decodedClaims.admin === true");
    expect(serverGate).toContain("decodedClaims.ownerAdmin === true");
    expect(callableGate).toContain("auth.token.email_verified !== true");
    expect(callableGate).toContain("auth.token.admin !== true");
    expect(callableGate).toContain("auth.token.ownerAdmin !== true");
  });
});
