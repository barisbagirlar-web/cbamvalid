import { describe, expect, it } from "vitest";
import { assertDisavowAllowed } from "../../scripts/seo/audit-offpage";

describe("INV-13.1 conditional disavow", () => {
  it("rejects disavow without all required evidence/approval records", () => {
    expect(() => assertDisavowAllowed({ manualAction: false, provenNegativeSeo: false, a3ApprovalId: null, decisionRecordId: null })).toThrow(/INV-13\.1/);
    expect(() => assertDisavowAllowed({ manualAction: true, provenNegativeSeo: false, a3ApprovalId: null, decisionRecordId: "DECISION" })).toThrow(/INV-13\.1/);
    expect(() => assertDisavowAllowed({ manualAction: false, provenNegativeSeo: true, a3ApprovalId: "A3", decisionRecordId: null })).toThrow(/INV-13\.1/);
  });

  it("accepts only a qualified evidence condition plus A3 and decision record", () => {
    expect(() => assertDisavowAllowed({ manualAction: true, provenNegativeSeo: false, a3ApprovalId: "A3-FIXTURE", decisionRecordId: "DECISION-FIXTURE" })).not.toThrow();
  });
});