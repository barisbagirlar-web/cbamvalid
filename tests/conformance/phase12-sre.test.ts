import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateSre, type SreConfig, type SreInputs } from "../../scripts/seo/seo-slo-check";

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as SreConfig;

function baseInputs(): SreInputs {
  return {
    cwv: null,
    cohortIndexPct: null,
    discoveryLagHours: null,
    organicValueDropPct: null,
    latestConformanceAt: "2026-08-10T09:40:00Z",
    latestPnlAt: "2026-08-10T06:50:00Z",
    consecutiveBreachCount: 0,
    freezeProposalAgeDays: null,
    freezeDecisionRecorded: false,
    alarmReopenCount: 0,
    killCandidates: [],
  };
}

describe("SEO V6 Phase 12 SRE", () => {
  it("records five governed SLO rows without fabricating unavailable private metrics", () => {
    const result = evaluateSre(config, baseInputs(), new Date("2026-08-10T10:00:00Z"));
    expect(result.slos).toHaveLength(5);
    expect(result.slos.filter((item) => item.status === "SKIP_NO_DATA")).toHaveLength(4);
    expect(result.slos.find((item) => item.slo === "evidence-freshness")?.status).toBe("PASS");
    expect(result.issueRequired).toBe(false);
    expect(result.killQueue).toEqual([]);
  });

  it("proposes a freeze only after the configured consecutive-breach count", () => {
    const inputs = baseInputs();
    inputs.organicValueDropPct = config.thresholds.organicValueDropWarnPct + 1;
    inputs.consecutiveBreachCount = config.thresholds.deployFreezeConsecutiveBreaches - 1;
    const result = evaluateSre(config, inputs, new Date("2026-08-10T10:00:00Z"));
    expect(result.issueRequired).toBe(true);
    expect(result.freezeProposalRequired).toBe(true);
    expect(result.issueBody).toContain("Deploy-freeze proposal required");
  });

  it("requests alarm calibration at the configured reopen count", () => {
    const inputs = baseInputs();
    inputs.alarmReopenCount = config.thresholds.alarmReopenCalibrationCount;
    const result = evaluateSre(config, inputs, new Date("2026-08-10T10:00:00Z"));
    expect(result.alarmFatigue.calibrationRequired).toBe(true);
  });
});