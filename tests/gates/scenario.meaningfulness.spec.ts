/**
 * G-10 — scenario meaningfulness. D-09.
 *
 * A mathematically inevitable outcome is never presented as a finding.
 * Production-volume scenarios change only intensity, never total emissions,
 * and never carry ABOVE_PLANNING_THRESHOLD. Every scenario carries an
 * interpretationNote.
 *
 * Evidence: before/after scenario table under artifacts/gates/G-10/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildScenarioInterpretations,
  validateScenarioMeaningfulness,
  VOLUME_SCENARIO_NOTE,
} from "../../functions/src/cbam/report/v6/scenario-interpretation";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-10");

describe("G-10 scenario.meaningfulness", () => {
  it("keeps volume scenarios at zero total-emissions delta without a threshold label", async () => {
    const built = await buildV6Package("STEEL_IN");
    const scenarios = buildScenarioInterpretations({
      calculation: built.calculation,
      baseIntensity: built.model.totals.aggregateSpecificEmbeddedEmissions,
    });
    const volume = scenarios.filter((scenario) => scenario.scenarioId.startsWith("PRODUCTION_VOLUME"));
    expect(volume.length).toBe(2);
    for (const scenario of volume) {
      expect(scenario.totalEmissionsDelta).toBe("0");
      expect(scenario.labels).not.toContain("ABOVE_PLANNING_THRESHOLD");
      expect(scenario.interpretationNote).toContain("not a finding");
      expect(scenario.interpretationNote).toBe(VOLUME_SCENARIO_NOTE);
    }
    expect(validateScenarioMeaningfulness(scenarios)).toEqual([]);

    const operatorControlled = scenarios.filter((scenario) => scenario.labels.includes("ABOVE_PLANNING_THRESHOLD"));
    expect(operatorControlled.length).toBeGreaterThan(0);
    for (const scenario of operatorControlled) {
      expect(scenario.labels).toContain("OPERATOR_CONTROLLED_PARAMETER");
    }
  });

  it("records a table of every scenario with its interpretation for the Master Record", async () => {
    const built = await buildV6Package("FERTILISER_TR");
    const scenarios = built.masterRecordModel.scenarios;
    expect(scenarios.length).toBeGreaterThanOrEqual(5);
    expect(built.masterRecordModel.hashInconsistencies).toEqual([]);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "scenario-table.json"),
      JSON.stringify({ baseIntensity: built.model.totals.aggregateSpecificEmbeddedEmissions, scenarios }, null, 2)
    );
  });
});
