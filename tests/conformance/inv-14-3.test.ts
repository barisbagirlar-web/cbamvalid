import { describe, expect, it } from "vitest";
import { assertNoPeeking, type CroExperiment } from "../../scripts/seo/cro-governance";

const fixture: CroExperiment = {
  id: "fixture",
  route: "/product",
  status: "running",
  primaryMetric: "conversion",
  guardrailMetrics: ["error-rate"],
  requiredSampleSize: 1000,
  mdePct: 10,
  decisionRule: "locked",
  plannedDurationWeeks: 14,
  a3ApprovalId: "A3-FIXTURE",
  lockedAt: "2026-01-01T00:00:00Z",
  startedAt: "2026-01-02T00:00:00Z",
  endedAt: null,
  interimAnalysisAt: ["2026-01-20T00:00:00Z"],
  variants: [],
};

describe("INV-14.3 peeking ban", () => {
  it("invalidates interim analysis while an experiment is running", () => {
    expect(() => assertNoPeeking(fixture)).toThrow(/INV-14\.3/);
  });
});