import { describe, expect, it } from "vitest";
import crypto from "crypto";

function deterministicEntitlementId(transactionId: string, caseId: string, sequence: number): string {
  const digest = crypto.createHash("sha256").update(`${transactionId}:${caseId}:${sequence}`).digest("hex").slice(0, 32);
  return `ent_${digest}`;
}

describe("Preparation Pack entitlement identity", () => {
  it("creates exactly five stable case-bound entitlement IDs", () => {
    const ids = Array.from({ length: 5 }, (_, index) => deterministicEntitlementId("txn_real_001", "case_001", index + 1));
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(Array.from({ length: 5 }, (_, index) => deterministicEntitlementId("txn_real_001", "case_001", index + 1)));
  });

  it("changes IDs when the case changes", () => {
    expect(deterministicEntitlementId("txn_real_001", "case_001", 1)).not.toBe(
      deterministicEntitlementId("txn_real_001", "case_002", 1)
    );
  });
});
