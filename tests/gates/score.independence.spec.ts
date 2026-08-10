/**
 * G-01 — two-axis scoring. D-01.
 *
 * dataEvidenceReadiness (0-100) covers only operator-controlled elements and
 * never consults the calendar. periodClosure ((elapsed days / total days) x 100)
 * is calendar-owned. A combined preparation score is forbidden.
 *
 * Evidence: JSON of the three runs under artifacts/gates/G-01/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeTwoAxisScores } from "../../functions/src/cbam/report/v6/two-axis-score";
import { createFourDossierCase } from "../fixtures/four-dossiers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-01");

describe("G-01 score.independence", () => {
  it("keeps dataEvidenceReadiness byte-identical across three calendar positions and varies periodClosure", () => {
    const caseData = createFourDossierCase("FERTILISER_TR");
    const timestamps = [
      { label: "period_10_pct", at: "2026-02-10T00:00:00.000Z" },
      { label: "period_60_pct", at: "2026-07-19T00:00:00.000Z" },
      { label: "period_100_pct", at: "2027-01-31T00:00:00.000Z" },
    ];
    const runs = timestamps.map(({ label, at }) => ({
      label,
      timestamp: at,
      ...computeTwoAxisScores({ caseData, assessmentTimestamp: at }),
    }));

    const readinessValues = new Set(runs.map((run) => run.dataEvidenceReadiness));
    expect(readinessValues.size).toBe(1);
    const readinessValue = runs[0]!.dataEvidenceReadiness;
    expect(readinessValue).toBeGreaterThanOrEqual(0);
    expect(readinessValue).toBeLessThanOrEqual(100);

    const closureValues = new Set(runs.map((run) => run.periodClosure));
    expect(closureValues.size).toBe(3);
    const [low, mid, high] = runs.map((run) => run.periodClosure);
    expect(typeof low).toBe("number");
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    expect(runs[0]!.periodEnded).toBe(false);
    expect(runs[2]!.periodEnded).toBe(true);

    for (const run of runs) {
      expect(run).not.toHaveProperty("preparationScore");
      expect(run).not.toHaveProperty("combinedScore");
    }

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "three-runs.json"),
      JSON.stringify({ caseId: caseData.caseId, runs }, null, 2)
    );
  });
});
