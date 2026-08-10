/**
 * G-11 — sampling plan completeness. D-10.
 *
 * No population may remain NOT_ASSESSED. A deliberately un-sampled population
 * is recorded as ASSESSED_NOT_SAMPLED_WITH_BASIS with a non-empty rationale.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeSamplingAssessment,
  validateSamplingCompleteness,
  NOT_ASSESSED_STATE,
  NOT_SAMPLED_STATE,
} from "../../functions/src/cbam/report/v6/sampling";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-11");

describe("G-11 sampling.completeness", () => {
  it("never leaves a population NOT_ASSESSED and always attaches a rationale", () => {
    const assessments = normalizeSamplingAssessment([
      { populationDomain: "CALCULATION_TRACE", populationSize: 0, sampleSize: 0, state: NOT_ASSESSED_STATE },
      { populationDomain: "SOURCE_STREAMS", populationSize: 12, sampleSize: 4, selectionMethod: "Judgmental on largest flows" },
      { populationDomain: "EVIDENCE", populationSize: 3, sampleSize: 1 },
    ]);
    expect(assessments.filter((entry) => entry.state === NOT_ASSESSED_STATE).length).toBe(0);
    const notSampled = assessments.find((entry) => entry.populationDomain === "CALCULATION_TRACE");
    expect(notSampled?.state).toBe(NOT_SAMPLED_STATE);
    expect((notSampled?.rationale ?? "").trim().length).toBeGreaterThan(0);
    const validationErrors = validateSamplingCompleteness(assessments);
    expect(validationErrors).toEqual([]);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "sampling-plan.json"),
      JSON.stringify({ assessments, validationErrors, notAssessedCount: 0 }, null, 2)
    );
  });

  it("rejects a NOT_ASSESSED population and a basis-less un-sampled row", () => {
    const errors = validateSamplingCompleteness([
      { populationDomain: "CALCULATION_TRACE", state: NOT_ASSESSED_STATE, rationale: "" },
      { populationDomain: "SOURCE_STREAMS", state: NOT_SAMPLED_STATE, rationale: "   " },
    ]);
    expect(errors.some((error) => error.includes(NOT_ASSESSED_STATE))).toBe(true);
    expect(errors.some((error) => error.includes("without a rationale"))).toBe(true);
  });
});
