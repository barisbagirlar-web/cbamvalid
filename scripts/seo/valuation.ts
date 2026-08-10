import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ValuationConfig = {
  site: { currency: string };
  thresholds: { valuationMinHistoryMonths: number; valuationCashflowMinHistoryMonths: number };
  economics: { valuationMultiples: { low: number; high: number } };
};

export type ValuationInput = {
  historyMonths: number;
  trailingRevenueMinor: number | null;
  trailingCashflowMinor: number | null;
};

export function assertValuationMethodologyRange(low: number, high: number): void {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || low >= high) {
    throw new Error("INV-19.1 valuation methodology requires a finite low/high range with low < high");
  }
}

export function assertMinorUnit(value: number | null, field: string): void {
  if (value === null) return;
  if (!Number.isSafeInteger(value)) throw new Error(`${field} must be integer minor-unit money`);
}

export function buildValuation(config: ValuationConfig, input: ValuationInput) {
  assertValuationMethodologyRange(config.economics.valuationMultiples.low, config.economics.valuationMultiples.high);
  assertMinorUnit(input.trailingRevenueMinor, "trailingRevenueMinor");
  assertMinorUnit(input.trailingCashflowMinor, "trailingCashflowMinor");

  if (input.historyMonths < config.thresholds.valuationMinHistoryMonths || input.trailingRevenueMinor === null) {
    return {
      status: "SKIP_NO_DATA" as const,
      method: "revenue_multiple_range" as const,
      valueLowMinor: null,
      valueHighMinor: null,
      cashflowMethodEligible: false,
      reason: "Insufficient measured history and/or trailing revenue for a valuation range.",
    };
  }

  const valueLowMinor = Math.round(input.trailingRevenueMinor * config.economics.valuationMultiples.low);
  const valueHighMinor = Math.round(input.trailingRevenueMinor * config.economics.valuationMultiples.high);
  const cashflowMethodEligible = input.historyMonths >= config.thresholds.valuationCashflowMinHistoryMonths && input.trailingCashflowMinor !== null;
  return {
    status: "RANGE_AVAILABLE" as const,
    method: "revenue_multiple_range" as const,
    valueLowMinor,
    valueHighMinor,
    cashflowMethodEligible,
    reason: cashflowMethodEligible ? null : "Cashflow valuation remains unavailable until its longer history requirement is met.",
  };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as ValuationConfig;
  const pnl = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/pnl.json"), "utf8")) as { data:{ revenueMinor:number|null; profitMinor:number|null } };
  const result = buildValuation(config, { historyMonths:0, trailingRevenueMinor:pnl.data.revenueMinor, trailingCashflowMinor:pnl.data.profitMinor });
  console.log(`SEO_VALUATION_RESULT=${JSON.stringify(result)}`);
}

if (process.argv[1]?.endsWith("valuation.ts")) main();
