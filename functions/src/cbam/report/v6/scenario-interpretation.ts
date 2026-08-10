/**
 * G-10 — scenario meaningfulness.
 *
 * A mathematically inevitable outcome is never presented as a finding or a
 * threshold breach. Production-volume changes alter only intensity, never
 * total emissions, and a +/-10% volume change exceeds the 5% intensity
 * planning threshold by definition — that is arithmetic, not a finding.
 * ABOVE_PLANNING_THRESHOLD is reserved for parameters under the operator's
 * control (grid factor, measurement uncertainty, allocation share).
 */
import { Decimal } from "decimal.js";
import type { DossierCalculationResult } from "../../calculator";
import type { ScenarioInterpretation } from "./types";

export const VOLUME_SCENARIO_NOTE =
  "Production-volume changes do not change total embedded emissions; they change only the specific intensity. A +/-10% volume change exceeds the 5% intensity planning threshold by definition and is not a finding. Intensity is a planning diagnostic for independent-verifier materiality work, not an operator-controllable gap.";

export function buildScenarioInterpretations(params: {
  calculation: DossierCalculationResult;
  baseIntensity: string;
}): ScenarioInterpretation[] {
  const { calculation } = params;
  const electricity = new Decimal(calculation.totalIndirectEmissions);
  const format = (value: Decimal) => value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString();

  const gridDelta = electricity.times("0.1");

  const operatorControlled = (label: string, delta: string, note: string): ScenarioInterpretation => ({
    scenarioId: label,
    totalEmissionsDelta: delta,
    interpretationNote: note,
    labels: ["ABOVE_PLANNING_THRESHOLD", "OPERATOR_CONTROLLED_PARAMETER"],
  });

  return [
    {
      scenarioId: "GRID_FACTOR_MINUS_10",
      totalEmissionsDelta: format(gridDelta.negated()),
      interpretationNote:
        "Grid emission factor is operator-selectable. A -10% factor change lowers total embedded emissions and may approach or cross the 5% intensity planning threshold; the threshold label is a planning flag for the verifier, not a finding.",
      labels: ["ABOVE_PLANNING_THRESHOLD", "OPERATOR_CONTROLLED_PARAMETER"],
    },
    {
      scenarioId: "BASE_CASE",
      totalEmissionsDelta: "0",
      interpretationNote: "Sealed base case; no scenario deviation.",
      labels: [],
    },
    operatorControlled(
      "GRID_FACTOR_PLUS_10",
      format(gridDelta),
      "Grid emission factor is operator-selectable. A +10% factor change raises total embedded emissions and exceeds the 5% intensity planning threshold; the threshold label is a planning flag for the verifier, not a finding."
    ),
    {
      scenarioId: "PRODUCTION_VOLUME_MINUS_10",
      totalEmissionsDelta: "0",
      interpretationNote: VOLUME_SCENARIO_NOTE,
      labels: ["INTENSITY_ONLY", "NOT_A_FINDING"],
    },
    {
      scenarioId: "PRODUCTION_VOLUME_PLUS_10",
      totalEmissionsDelta: "0",
      interpretationNote: VOLUME_SCENARIO_NOTE,
      labels: ["INTENSITY_ONLY", "NOT_A_FINDING"],
    },
  ];
}

export function validateScenarioMeaningfulness(
  scenarios: readonly ScenarioInterpretation[]
): string[] {
  const errors: string[] = [];
  for (const scenario of scenarios) {
    if (!scenario.interpretationNote || scenario.interpretationNote.trim().length === 0) {
      errors.push(`${scenario.scenarioId} is missing an interpretationNote`);
    }
    if (scenario.scenarioId.startsWith("PRODUCTION_VOLUME")) {
      if (scenario.totalEmissionsDelta !== "0") {
        errors.push(`${scenario.scenarioId} must report a zero total-emissions delta`);
      }
      if (scenario.labels.includes("ABOVE_PLANNING_THRESHOLD")) {
        errors.push(`${scenario.scenarioId} must not carry ABOVE_PLANNING_THRESHOLD`);
      }
    }
  }
  return errors;
}
