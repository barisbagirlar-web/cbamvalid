import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  },
}));

import {
  CHECKOUT_LOCK_TTL_MS,
  checkoutLockDocId,
  isCheckoutLockStale,
} from "../../lib/billing/checkout-lock";

describe("checkout lock SSOT", () => {
  it("derives a stable per-(uid, caseId) document id", () => {
    const a = checkoutLockDocId("uid-1", "case_abc");
    const b = checkoutLockDocId("uid-1", "case_abc");
    const c = checkoutLockDocId("uid-2", "case_abc");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks locks stale after the TTL window", () => {
    const now = Date.parse("2026-08-13T12:00:00.000Z");
    const fresh = {
      createdAt: "2026-08-13T11:00:00.000Z",
      updatedAt: "2026-08-13T11:00:00.000Z",
    };
    const stale = {
      createdAt: "2026-08-13T09:00:00.000Z",
      updatedAt: "2026-08-13T09:00:00.000Z",
    };
    expect(isCheckoutLockStale(fresh, now)).toBe(false);
    expect(isCheckoutLockStale(stale, now)).toBe(true);
    expect(CHECKOUT_LOCK_TTL_MS).toBe(2 * 60 * 60 * 1000);
  });
});
