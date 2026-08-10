import { describe, expect, it } from "vitest";
import { assertExperimentLocked, loadCroConfig, type CroExperiment } from "../../scripts/seo/cro-governance";

const config = loadCroConfig();

function fixture(): CroExperiment {
  return {
    id: "fixture",
    route: "/product",
    status: "running",
    primaryMetric: null,
    guardrailMetrics: [],
    requiredSampleSize: null,
    mdePct: null,
    decisionRule: null,
    plannedDurationWeeks: null,
    a3ApprovalId: null,
    lockedAt: null,
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: null,
    interimAnalysisAt: [],
    variants: [],
  };
}

describe("INV-14.2 experiment lock", () => {
  it("rejects a running experiment before its statistical contract is locked", () => {
    expect(() => assertExperimentLocked(fixture(), config)).toThrow(/INV-14\.2/);
  });

  it("still rejects a fully specified experiment without A3 start approval", () => {
    const exp = fixture();
    exp.primaryMetric = "paid working file conversion";
    exp.guardrailMetrics = ["checkout error rate"];
    exp.requiredSampleSize = 1000;
    exp.mdePct = 10;
    exp.decisionRule = "two-sided pre-registered decision";
    exp.plannedDurationWeeks = config.thresholds.croMinWeeks;
    exp.lockedAt = "2026-01-01T00:00:00Z";
    expect(() => assertExperimentLocked(exp, config)).toThrow(/A3/);
  });
});