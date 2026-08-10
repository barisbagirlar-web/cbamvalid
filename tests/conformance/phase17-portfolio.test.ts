import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurrentPortfolioState, paybackCalibration, assertNoHarvestInvestment, type Phase17Config } from "../../scripts/seo/portfolio-governance";

type PnlArtifact = Parameters<typeof buildCurrentPortfolioState>[1];
type KacState = Parameters<typeof buildCurrentPortfolioState>[2];
type SloHistory = Parameters<typeof buildCurrentPortfolioState>[3];
const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase17Config;
const pnl = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/pnl.json"), "utf8")) as PnlArtifact;
const kac = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/kac/state.json"), "utf8")) as KacState;
const slo = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/slo_history.json"), "utf8")) as SloHistory;

describe("Phase 17 portfolio economics", () => {
  it("emits no portfolio decision without two months of real P&L and KAC recommendations", () => {
    const state = buildCurrentPortfolioState(config, pnl, kac, slo);
    expect(state.pnlHistoryMonths).toBe(0);
    expect(state.decisionGate).toBe("SKIP_NO_DATA");
    expect(state.decisions).toEqual([]);
    expect(state.budgetExecution).toBeNull();
    expect(state.concentrationPct).toBeNull();
  });

  it("does not fabricate payback calibration", () => {
    expect(paybackCalibration({ projectedMonths: null, actualMonths: null, observedDays: 0, requiredDays: config.thresholds.paybackCalibrationDays })).toEqual({ status: "SKIP_NO_DATA", deviationPct: null });
  });

  it("rejects new investment on HARVEST", () => {
    expect(() => assertNoHarvestInvestment({ decision: "HARVEST", newInvestmentRequested: true })).toThrow(/maintenance-only/);
  });
});
