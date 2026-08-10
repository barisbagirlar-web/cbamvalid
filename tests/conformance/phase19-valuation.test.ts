import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildValuation, type ValuationConfig } from "../../scripts/seo/valuation";
import { validateCalibration, type CalibrationConfig } from "../../scripts/seo/calibration";
import { assertDdPackageComplete, compareBoardReportToValuation } from "../../scripts/seo/board-report";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as ValuationConfig & CalibrationConfig;

describe("SEO V6 Phase 19 valuation / DD", () => {
  it("does not fabricate valuation before the configured history gate", () => {
    const value = buildValuation(config, { historyMonths:0, trailingRevenueMinor:null, trailingCashflowMinor:null });
    expect(value.status).toBe("SKIP_NO_DATA");
    expect(value.valueLowMinor).toBeNull();
    expect(value.valueHighMinor).toBeNull();
    expect(value.cashflowMethodEligible).toBe(false);
  });

  it("keeps calibration unavailable without observations", () => {
    expect(validateCalibration({ calibratedAt:null, sampleSize:0, rho:null }, config).status).toBe("SKIP_NO_DATA");
  });

  it("verifies the committed DD package and board/valuation parity", () => {
    expect(() => assertDdPackageComplete()).not.toThrow();
    expect(compareBoardReportToValuation({ valuationStatus:"SKIP_NO_DATA", boardValuationStatus:"SKIP_NO_DATA", valueLowMinor:null, boardValueLowMinor:null, valueHighMinor:null, boardValueHighMinor:null }).status).toBe("PASS");
  });
});
