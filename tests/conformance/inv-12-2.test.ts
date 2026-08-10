import { describe, expect, it } from "vitest";
import { assertConfigThresholdRef } from "../../scripts/seo/seo-slo-check";

describe("INV-12.2 SLO thresholds from config", () => {
  it("accepts configured threshold references and the governed observational discovery SLO", () => {
    expect(() => assertConfigThresholdRef("thresholds.organicValueDropWarnPct")).not.toThrow();
    expect(() => assertConfigThresholdRef("thresholds.lcpP75Ms|thresholds.inpP75Ms|thresholds.clsP75")).not.toThrow();
    expect(() => assertConfigThresholdRef("INV-8.2:observational")).not.toThrow();
  });

  it("rejects a synthetic literal/hard-coded business threshold source", () => {
    expect(() => assertConfigThresholdRef("literal:30")).toThrow(/INV-12\.2/);
    expect(() => assertConfigThresholdRef("thresholds.lcpP75Ms|200")).toThrow(/INV-12\.2/);
  });
});