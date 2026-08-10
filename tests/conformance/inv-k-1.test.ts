import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCalibration, type CalibrationConfig } from "../../scripts/seo/calibration";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as CalibrationConfig;

describe("INV-K.1 calibration freshness", () => {
  it("rejects calibration older than the configured maximum age", () => {
    expect(() => validateCalibration({ calibratedAt:"2025-01-01T00:00:00Z", sampleSize:config.thresholds.calibrationMinSample, rho:config.thresholds.calibrationMinRho }, config, new Date("2026-08-10T00:00:00Z"))).toThrow(/INV-K\.1/);
  });
});
