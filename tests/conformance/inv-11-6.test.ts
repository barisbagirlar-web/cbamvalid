import { describe, expect, it } from "vitest";
import { assertRecommendationAllowed, scorePriority } from "../../scripts/seo/kac-prioritize";

describe("INV-11.6 partial cluster cannot INVEST", () => {
  it("marks a cluster partial when a required score input is missing", () => {
    const result = scorePriority({
      expectedExtraClicks: null,
      cvr: null,
      conversionValueMinor: null,
      confidenceMultiplier: null,
      effort: null,
    });
    expect(result).toEqual({ partial: true, score: null });
    expect(() => assertRecommendationAllowed("INVEST", result.partial)).toThrow(/INV-11\.6/);
  });

  it("does not prohibit non-INVEST handling of a partial cluster", () => {
    expect(() => assertRecommendationAllowed("HOLD", true)).not.toThrow();
    expect(() => assertRecommendationAllowed(null, true)).not.toThrow();
  });
});