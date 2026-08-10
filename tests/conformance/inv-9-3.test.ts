import { describe, expect, it } from "vitest";
import { validateIncrementalityEvidence } from "../../scripts/seo/warehouse-contract";

describe("INV-9.3 incrementality confidence interval", () => {
  it("rejects incrementality without a confidence interval", () => {
    const errors = validateIncrementalityEvidence({
      method: "holdout",
      treatment: 100,
      control: 90,
      lift: 10,
    });
    expect(errors).toContain("INV-9.3 confidence interval missing");
  });

  it("accepts a bounded confidence interval", () => {
    expect(
      validateIncrementalityEvidence({
        method: "holdout",
        treatment: 100,
        control: 90,
        lift: 10,
        confidenceInterval: { lower: 2, upper: 18, level: 0.95 },
      }),
    ).toEqual([]);
  });
});
