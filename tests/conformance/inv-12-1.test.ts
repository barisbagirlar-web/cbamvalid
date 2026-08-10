import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertBreachHasIssue, evaluateSre, type SreConfig, type SreInputs } from "../../scripts/seo/seo-slo-check";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as SreConfig;

describe("INV-12.1 SLO breach must create issue", () => {
  it("fails closed when a governed breach has no issue link", () => {
    const inputs: SreInputs = {
      cwv: null,
      cohortIndexPct: null,
      discoveryLagHours: null,
      organicValueDropPct: config.thresholds.organicValueDropWarnPct + 1,
      latestConformanceAt: "2026-08-10T09:40:00Z",
      latestPnlAt: "2026-08-10T06:50:00Z",
      consecutiveBreachCount: 0,
      freezeProposalAgeDays: null,
      freezeDecisionRecorded: false,
      alarmReopenCount: 0,
      killCandidates: [],
    };
    const result = evaluateSre(config, inputs, new Date("2026-08-10T10:00:00Z"));
    expect(result.issueRequired).toBe(true);
    expect(() => assertBreachHasIssue(result, null)).toThrow(/INV-12\.1/);
    expect(() => assertBreachHasIssue(result, "https://github.com/example/repo/issues/1")).not.toThrow();
  });
});