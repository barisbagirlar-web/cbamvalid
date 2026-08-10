import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertAdsCwvBudget, type Phase16Config } from "../../scripts/seo/tam-growth";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase16Config;

describe("INV-16.4", () => {
  it("blocks ads growth when CWV evidence is missing", () => {
    expect(() => assertAdsCwvBudget({ revenueModel: "ads", lcpP75Ms: null, inpP75Ms: null, clsP75: null, thresholds: config.thresholds })).toThrow(/INV-16\.4/);
  });
  it("blocks ads growth on config threshold breach", () => {
    expect(() => assertAdsCwvBudget({ revenueModel: "ads", lcpP75Ms: config.thresholds.lcpP75Ms + 1, inpP75Ms: config.thresholds.inpP75Ms, clsP75: config.thresholds.clsP75, thresholds: config.thresholds })).toThrow(/INV-16\.4/);
  });
  it("does not impose ads budget on the current ecommerce revenue model", () => {
    expect(() => assertAdsCwvBudget({ revenueModel: config.business.revenueModel, lcpP75Ms: null, inpP75Ms: null, clsP75: null, thresholds: config.thresholds })).not.toThrow();
  });
});
