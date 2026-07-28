import { describe, expect, it } from "vitest";
import { computeHonestScores } from "./score";

/**
 * gate:dimension-backing — a dimension may only score > 0 if chapterNonEmpty.
 */
describe("gate:dimension-backing", () => {
  it("empty chapter forces effective score contribution 0", () => {
    const scores = computeHonestScores({
      originInScope: true,
      dimensionScores: [
        {
          id: "SCOPE",
          weight: 15,
          score01: 1,
          chapterNonEmpty: false,
          operatorControllable: true,
        },
      ],
      signOffsComplete: true,
      verifierReservedComplete: 0,
      verifierReservedTotal: 0,
      hardBlockers: [],
    });
    expect(scores.operatorReadiness).toBe(0);
    expect(scores.findings).toContain("DIMENSION_CHAPTER_EMPTY:SCOPE");
  });
});
