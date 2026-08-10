import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertKillQueueDecisionDeadline, evaluateSre, type SreConfig, type SreInputs } from "../../scripts/seo/seo-slo-check";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as SreConfig;

function inputs(decision: "HOLD" | null): SreInputs {
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
    killCandidates: [{
      assetId: "fixture-asset",
      ageDays: config.thresholds.killEvaluationDays,
      conversions: 0,
      tasPartial: true,
      failedRefreshAttempts: config.thresholds.killRefreshAttempts,
      triggerAgeDays: config.thresholds.killDecisionMaxDays + 1,
      portfolioDecision: decision,
    }],
  };
}

describe("INV-12.5 kill-triggered portfolio decision deadline", () => {
  it("blocks an overdue triggered asset without a portfolio decision", () => {
    const result = evaluateSre(config, inputs(null), new Date("2026-08-10T10:00:00Z"));
    expect(result.killQueueBlockCount).toBe(1);
    expect(() => assertKillQueueDecisionDeadline(result)).toThrow(/INV-12\.5/);
  });

  it("accepts a non-INVEST portfolio decision for the triggered asset", () => {
    const result = evaluateSre(config, inputs("HOLD"), new Date("2026-08-10T10:00:00Z"));
    expect(result.killQueueBlockCount).toBe(0);
    expect(() => assertKillQueueDecisionDeadline(result)).not.toThrow();
  });
});