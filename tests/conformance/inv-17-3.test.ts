import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertBudgetDeviationApproval, type Phase17Config } from "../../scripts/seo/portfolio-governance";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase17Config;

describe("INV-17.3", () => {
  it("blocks unapproved budget deviation", () => {
    const proposed = { ...config.economics.budgetSplit, investPct: config.economics.budgetSplit.investPct - 1, holdPct: config.economics.budgetSplit.holdPct + 1 };
    expect(() => assertBudgetDeviationApproval({ configured: config.economics.budgetSplit, proposed, approvalRecordId: null })).toThrow(/INV-17\.3/);
  });
  it("allows exact configured budget without approval", () => {
    expect(() => assertBudgetDeviationApproval({ configured: config.economics.budgetSplit, proposed: config.economics.budgetSplit, approvalRecordId: null })).not.toThrow();
  });
});
