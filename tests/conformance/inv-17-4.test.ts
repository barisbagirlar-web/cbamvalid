import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertPortfolioDecisionChain, type Phase17Config } from "../../scripts/seo/portfolio-governance";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase17Config;

describe("INV-17.4", () => {
  it("blocks decision when required P&L history is missing", () => {
    expect(() => assertPortfolioDecisionChain({
      decision: "INVEST",
      pnlHistoryMonths: 0,
      minHistoryMonths: config.thresholds.portfolioMinHistoryMonths,
      kacRecommendation: "INVEST",
      killQueueEvaluated: true,
      approvalRecordId: "A3-fixture",
    })).toThrow(/INV-17\.4/);
  });

  it("blocks decision without A3 approval even when evidence exists", () => {
    expect(() => assertPortfolioDecisionChain({
      decision: "HOLD",
      pnlHistoryMonths: config.thresholds.portfolioMinHistoryMonths,
      minHistoryMonths: config.thresholds.portfolioMinHistoryMonths,
      kacRecommendation: "HOLD",
      killQueueEvaluated: true,
      approvalRecordId: null,
    })).toThrow(/INV-17\.4/);
  });
});
