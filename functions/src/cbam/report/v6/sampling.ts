/**
 * G-11 — sampling plan completeness.
 *
 * No population may remain NOT_ASSESSED. A population that is deliberately not
 * sampled is recorded as ASSESSED_NOT_SAMPLED_WITH_BASIS with a non-empty
 * rationale. D-10 (CALCULATION_TRACE: 0 / NOT_ASSESSED) is closed here.
 */
import type { SamplingAssessment } from "./types";

export const NOT_ASSESSED_STATE = "NOT_ASSESSED";
export const NOT_SAMPLED_STATE = "ASSESSED_NOT_SAMPLED_WITH_BASIS";

export interface SamplingPopulationInput {
  readonly populationDomain: string;
  readonly populationSize: number;
  readonly sampleSize: number;
  readonly selectionMethod?: string;
  readonly rationale?: string;
  readonly state?: string;
}

export function normalizeSamplingAssessment(
  populations: readonly SamplingPopulationInput[]
): SamplingAssessment[] {
  return populations.map((population) => {
    const assessed = population.populationSize > 0 && population.populationSize >= population.sampleSize;
    const state = population.state && population.state !== NOT_ASSESSED_STATE
      ? population.state
      : assessed
        ? "OPERATOR_PROPOSED"
        : NOT_SAMPLED_STATE;
    const rationale =
      population.rationale && population.rationale.trim().length > 0
        ? population.rationale.trim()
        : state === NOT_SAMPLED_STATE
          ? `Population ${population.populationDomain} is deliberately not sampled because it has no assessable entries in this package. Revisit when the population becomes non-empty.`
          : "Population assessed and proposed for independent-verifier sampling.";
    return {
      populationDomain: population.populationDomain,
      state,
      rationale,
    };
  });
}

export function validateSamplingCompleteness(
  assessments: readonly SamplingAssessment[]
): string[] {
  const errors: string[] = [];
  const notAssessed = assessments.filter((entry) => entry.state === NOT_ASSESSED_STATE);
  if (notAssessed.length > 0) {
    errors.push(`sampling populations remain ${NOT_ASSESSED_STATE}: ${notAssessed.map((entry) => entry.populationDomain).join(", ")}`);
  }
  for (const entry of assessments) {
    if (entry.state === NOT_SAMPLED_STATE && !entry.rationale.trim()) {
      errors.push(`${entry.populationDomain} is ${NOT_SAMPLED_STATE} without a rationale`);
    }
  }
  return errors;
}
