import { describe, expect, it } from "vitest";
import { CASE_COMMERCIAL, isCasePaidForSealing } from "@/lib/billing/case-commercial-contract";

describe("CASE_COMMERCIAL pay-at-lock contract", () => {
  it("keeps $449 amount and case-scoped billing model", () => {
    expect(CASE_COMMERCIAL.billingModel).toBe("CASE_PAY_AT_LOCK");
    expect(CASE_COMMERCIAL.amountMinor).toBe(44900);
    expect(CASE_COMMERCIAL.maxReleasesPerPaidCase).toBeGreaterThanOrEqual(50);
  });

  it("treats case-scoped available entitlement as paid for sealing", () => {
    expect(
      isCasePaidForSealing({
        caseId: "case_abc",
        scopedEntitlement: {
          scopeCaseId: "case_abc",
          status: "AVAILABLE",
          releasesRemaining: 99,
        },
      })
    ).toBe(true);
  });

  it("rejects entitlement scoped to another case", () => {
    expect(
      isCasePaidForSealing({
        caseId: "case_abc",
        scopedEntitlement: {
          scopeCaseId: "case_other",
          status: "AVAILABLE",
          releasesRemaining: 99,
        },
      })
    ).toBe(false);
  });
});
