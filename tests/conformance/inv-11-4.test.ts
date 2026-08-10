import { describe, expect, it } from "vitest";
import { assertPortfolioWriteAllowed } from "../../scripts/seo/kac-prioritize";

describe("INV-11.4 portfolio decision approval and single writer", () => {
  it("rejects a decision without KARAR_DEFTERI evidence", () => {
    expect(() =>
      assertPortfolioWriteAllowed({ decision: "HOLD", decisionRecordId: null, writerPhase: "faz-01" }),
    ).toThrow(/INV-11\.4/);
  });

  it("rejects a registry decision write outside Phase 01", () => {
    expect(() =>
      assertPortfolioWriteAllowed({ decision: "HOLD", decisionRecordId: "DECISION-FIXTURE", writerPhase: "faz-11" }),
    ).toThrow(/Phase-01/);
  });

  it("accepts an approved decision only through the Phase 01 writer", () => {
    expect(() =>
      assertPortfolioWriteAllowed({ decision: "HOLD", decisionRecordId: "DECISION-FIXTURE", writerPhase: "faz-01" }),
    ).not.toThrow();
  });
});