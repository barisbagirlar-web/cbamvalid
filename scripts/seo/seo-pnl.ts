import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type SeoPnlInput = {
  currency: string;
  directRevenueMinor: number;
  assistedRevenueMinor: number;
  productionCostMinor: number;
  toolingCostMinor: number;
  conversions: number;
  conversionValueMinor: number;
  generativeAiClicks?: number | null;
};

export type SeoPnlResult = {
  status: "PASS" | "WARN";
  currency: string;
  revenueMinor: number | null;
  costMinor: number;
  profitMinor: number | null;
  roiBps: number | null;
  warnings: string[];
  excludedFromFormula: { generativeAiClicks: number | null };
};

const MONEY_FIELDS = [
  "directRevenueMinor",
  "assistedRevenueMinor",
  "productionCostMinor",
  "toolingCostMinor",
  "conversionValueMinor",
] as const;

export function validateMinorUnitMoney(input: SeoPnlInput): string[] {
  const errors: string[] = [];
  for (const field of MONEY_FIELDS) {
    const value = input[field];
    if (!Number.isSafeInteger(value)) {
      errors.push(`INV-9.1 ${field} must be a safe integer minor-unit amount`);
    }
  }
  if (!Number.isSafeInteger(input.conversions) || input.conversions < 0) {
    errors.push("INV-9.1 conversions must be a non-negative integer");
  }
  return errors.sort();
}

export function buildSeoPnl(input: SeoPnlInput): SeoPnlResult {
  const errors = validateMinorUnitMoney(input);
  if (errors.length > 0) throw new Error(errors.join("; "));

  const costMinor = input.productionCostMinor + input.toolingCostMinor;
  const warnings: string[] = [];
  const conversionValueKnown = input.conversionValueMinor > 0;
  const attributedRevenueProvided = input.directRevenueMinor > 0 || input.assistedRevenueMinor > 0;

  if (!conversionValueKnown && !attributedRevenueProvided) {
    warnings.push("INV-9.4 conversion value is zero/unknown; revenue, profit and ROI remain unknown rather than inferred");
    return {
      status: "WARN",
      currency: input.currency,
      revenueMinor: null,
      costMinor,
      profitMinor: null,
      roiBps: null,
      warnings,
      excludedFromFormula: { generativeAiClicks: input.generativeAiClicks ?? null },
    };
  }

  const revenueMinor = attributedRevenueProvided
    ? input.directRevenueMinor + input.assistedRevenueMinor
    : input.conversions * input.conversionValueMinor;
  const profitMinor = revenueMinor - costMinor;
  const roiBps = costMinor > 0 ? Math.round((profitMinor * 10_000) / costMinor) : null;
  if (costMinor === 0) warnings.push("ROI denominator is zero; roiBps remains null");

  return {
    status: warnings.length > 0 ? "WARN" : "PASS",
    currency: input.currency,
    revenueMinor,
    costMinor,
    profitMinor,
    roiBps,
    warnings,
    excludedFromFormula: { generativeAiClicks: input.generativeAiClicks ?? null },
  };
}

function main() {
  const siteIndex = process.argv.indexOf("--site");
  const site = siteIndex >= 0 ? process.argv[siteIndex + 1] : "cbamvalid";
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), `sites/${site}/seo.config.json`), "utf8"),
  ) as { site: { currency: string }; economics: { defaultValuePerConversionMinor: number } };
  const result = buildSeoPnl({
    currency: config.site.currency,
    directRevenueMinor: 0,
    assistedRevenueMinor: 0,
    productionCostMinor: 0,
    toolingCostMinor: 0,
    conversions: 0,
    conversionValueMinor: config.economics.defaultValuePerConversionMinor,
    generativeAiClicks: null,
  });
  console.log(`SEO_PNL_RESULT=${JSON.stringify(result)}`);
  process.exitCode = result.status === "WARN" ? 2 : 0;
}

if (process.argv[1]?.endsWith("seo-pnl.ts")) main();
