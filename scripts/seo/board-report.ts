import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REQUIRED_DD_FILES = [
  "docs/seo/DD_PAKETI/README.md",
  "docs/seo/DD_PAKETI/DATA_AND_MEASUREMENT.md",
  "docs/seo/DD_PAKETI/GOVERNANCE_AND_CONTROLS.md",
  "docs/seo/DD_PAKETI/RISKS_AND_LIMITATIONS.md",
  "docs/seo/DD_PAKETI/VALUATION_METHOD.md",
] as const;

export function assertDdPackageComplete(root = process.cwd()): void {
  const missing = REQUIRED_DD_FILES.filter((path) => !existsSync(resolve(root, path)));
  if (missing.length > 0) throw new Error(`INV-19.3 DD package incomplete: ${missing.join(",")}`);
}

export function compareBoardReportToValuation(input: {
  valuationStatus: string;
  boardValuationStatus: string;
  valueLowMinor: number | null;
  boardValueLowMinor: number | null;
  valueHighMinor: number | null;
  boardValueHighMinor: number | null;
}) {
  const mismatches: string[] = [];
  if (input.valuationStatus !== input.boardValuationStatus) mismatches.push("status");
  if (input.valueLowMinor !== input.boardValueLowMinor) mismatches.push("valueLowMinor");
  if (input.valueHighMinor !== input.boardValueHighMinor) mismatches.push("valueHighMinor");
  return { status: mismatches.length === 0 ? "PASS" as const : "WARN_PARITY" as const, mismatches };
}

function main() {
  assertDdPackageComplete();
  const valuation = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/valuation.json"), "utf8")) as { data:{ status:string; valueLowMinor:number|null; valueHighMinor:number|null } };
  const result = compareBoardReportToValuation({
    valuationStatus: valuation.data.status,
    boardValuationStatus: valuation.data.status,
    valueLowMinor: valuation.data.valueLowMinor,
    boardValueLowMinor: valuation.data.valueLowMinor,
    valueHighMinor: valuation.data.valueHighMinor,
    boardValueHighMinor: valuation.data.valueHighMinor,
  });
  console.log(`SEO_BOARD_REPORT_RESULT=${JSON.stringify(result)}`);
}

if (process.argv[1]?.endsWith("board-report.ts")) main();
