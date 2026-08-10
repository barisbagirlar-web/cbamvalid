import { describe, expect, it } from "vitest";
import { assertFourStepDivest } from "../../scripts/seo/portfolio-governance";

describe("INV-17.2", () => {
  it("blocks partial DIVEST execution", () => {
    expect(() => assertFourStepDivest({ successorOr410Recorded: true, internalLinkCleanupPr: true, executionApproved: false, monitoringAndPnlClosureRecorded: false })).toThrow(/INV-17\.2/);
  });
  it("accepts the full four-step chain", () => {
    expect(() => assertFourStepDivest({ successorOr410Recorded: true, internalLinkCleanupPr: true, executionApproved: true, monitoringAndPnlClosureRecorded: true })).not.toThrow();
  });
});
