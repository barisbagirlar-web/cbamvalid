import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateFieldCwv, type FieldCwvInput } from "../../scripts/seo/cwv-field-gate";

type Config = { thresholds: { lcpP75Ms: number; inpP75Ms: number; clsP75: number } };
const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as Config;

describe("INV-7.2 CWV remediation gate", () => {
  it("BLOCKs field threshold breaches when no remediation PR exists", () => {
    const field: FieldCwvInput = {
      sourceType: "field",
      source: "CrUX fixture",
      measuredAt: "2026-08-10T00:00:00Z",
      lcpP75Ms: config.thresholds.lcpP75Ms + 1,
      inpP75Ms: config.thresholds.inpP75Ms,
      clsP75: config.thresholds.clsP75,
      softNavigationInpIncluded: true,
      remediationPr: null,
    };
    const result = evaluateFieldCwv(config.thresholds, field);
    expect(result.status).toBe("BLOCK");
    expect(result.breaches).toContain("LCP");
    expect(result.reason).toMatch(/without a remediation PR/i);
  });

  it("keeps the same breach visible but non-BLOCK when remediation is tracked", () => {
    const field: FieldCwvInput = {
      sourceType: "field",
      source: "CrUX fixture",
      measuredAt: "2026-08-10T00:00:00Z",
      lcpP75Ms: config.thresholds.lcpP75Ms,
      inpP75Ms: config.thresholds.inpP75Ms + 1,
      clsP75: config.thresholds.clsP75,
      softNavigationInpIncluded: true,
      remediationPr: "PR-fixture",
    };
    expect(evaluateFieldCwv(config.thresholds, field).status).toBe("WARN");
  });

  it("refuses to relabel lab metrics as field truth", () => {
    const field: FieldCwvInput = {
      sourceType: "lab",
      source: "Lighthouse fixture",
      measuredAt: "2026-08-10T00:00:00Z",
      lcpP75Ms: 0,
      inpP75Ms: 0,
      clsP75: 0,
    };
    const result = evaluateFieldCwv(config.thresholds, field);
    expect(result.status).toBe("SKIP_NO_DATA");
    expect(result.partial).toBe(true);
  });
});
