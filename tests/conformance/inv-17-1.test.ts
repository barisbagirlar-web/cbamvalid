import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertConcentrationPlan, type Phase17Config } from "../../scripts/seo/portfolio-governance";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase17Config;

describe("INV-17.1", () => {
  it("blocks concentration breach without diversification plan", () => {
    expect(() => assertConcentrationPlan({ concentrationPct: config.thresholds.concentrationWarnPct + 1, thresholdPct: config.thresholds.concentrationWarnPct, diversificationPlan: null })).toThrow(/INV-17\.1/);
  });
});
