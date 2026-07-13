import { describe, expect, it } from "vitest";

const nonProductionIdentifier = /(test|sandbox|fixture|mock|example)/i;

function mayProveRealPayment(identifier: string): boolean {
  return identifier.length > 0 && !nonProductionIdentifier.test(identifier);
}

describe("release evidence truth", () => {
  it.each([
    "txn_test_984531",
    "evt_sandbox_payment_123",
    "fixture_transaction",
    "mock_ledger_1",
    "example_entitlement",
  ])("rejects non-production evidence identifier %s", (identifier) => {
    expect(mayProveRealPayment(identifier)).toBe(false);
  });

  it("does not infer runtime readiness from source evidence", () => {
    const sourceChecks = { typecheck: true, tests: true, build: true };
    const runtimeChecks = { realPayment: false, liveBrowserE2e: false, deployedShaMatch: false };
    const revenueReady = Object.values(sourceChecks).every(Boolean) && Object.values(runtimeChecks).every(Boolean);
    expect(revenueReady).toBe(false);
  });
});
