import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertProgrammaticEligibility, type Phase18Config } from "../../scripts/seo/programmatic-factory";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase18Config;

describe("INV-18.2 programmatic eligibility gate", () => {
  it("rejects publication without Phase-17 INVEST evidence", () => {
    expect(() => assertProgrammaticEligibility({
      templateId:"cn-code-detail-v1", portfolioDecision:null, growthLoop:"programmatic_longtail",
      structuredDataSource:"registry", dataFreshnessEvidence:"fresh", uniqueQuestionPerPage:true,
      uniquenessScorable:true, pilotPageCount:config.thresholds.programmaticPilotMinPages,
      pilotObservedDays:config.thresholds.programmaticEvalDays, pilotIndexedCount:config.thresholds.programmaticPilotMinPages,
      pilotImpressions:1,
    }, config)).toThrow(/INV-18\.2/);
  });
});
