import part0 from "./part-0";
import part1 from "./part-1";
import part2 from "./part-2";
import part3 from "./part-3";
import part4 from "./part-4";
import part5 from "./part-5";
import part6 from "./part-6";

export const CBAM_BENCHMARK_DATASET_VERSION = "EU-2025-2620/2026-02-13" as const;
export const CBAM_BENCHMARK_LEGAL_SOURCE = "Commission Implementing Regulation (EU) 2025/2620" as const;

const GROUPS = [...part0, ...part1, ...part2, ...part3, ...part4, ...part5, ...part6] as const;

type Group = (typeof GROUPS)[number];
export type BenchmarkColumn = "ACTUAL" | "DEFAULT";

export type BenchmarkVariant = {
  cnCode: string;
  value: number;
  indicator: string | null;
  column: BenchmarkColumn;
  datasetVersion: typeof CBAM_BENCHMARK_DATASET_VERSION;
  legalSource: typeof CBAM_BENCHMARK_LEGAL_SOURCE;
};

export type BenchmarkResolution =
  | { status: "FOUND"; benchmark: BenchmarkVariant }
  | { status: "AMBIGUOUS"; variants: BenchmarkVariant[] }
  | { status: "NOT_FOUND"; variants: [] };

function normalizeCnCode(value: string): string {
  const normalized = value.replace(/\s+/g, "");
  if (!/^\d{8}$/.test(normalized)) throw new Error("INVALID_BENCHMARK_CN_CODE");
  return normalized;
}

function indicatorAppliesToYear(indicator: string | null, year: number): boolean {
  if (!indicator) return true;
  if (indicator.includes("(1)")) return year >= 2026 && year <= 2027;
  if (indicator.includes("(2)")) return year >= 2028 && year <= 2030;
  return true;
}

function indicatorMatchesRoute(indicator: string | null, routeIndicator?: string): boolean {
  if (!routeIndicator) return true;
  const route = routeIndicator.trim().toUpperCase();
  if (!route) return true;
  return indicator?.toUpperCase().includes(`(${route})`) ?? false;
}

export function getBenchmarkVariants(params: {
  cnCode: string;
  column: BenchmarkColumn;
  year: number;
}): BenchmarkVariant[] {
  const cnCode = normalizeCnCode(params.cnCode);
  if (!Number.isInteger(params.year) || params.year < 2026 || params.year > 2030) {
    throw new Error("INVALID_BENCHMARK_YEAR");
  }

  const variants: BenchmarkVariant[] = [];
  for (const group of GROUPS) {
    if (!(group.codes as readonly string[]).includes(cnCode)) continue;
    const value = params.column === "ACTUAL" ? group.a : group.b;
    const indicator = params.column === "ACTUAL" ? group.ai : group.bi;
    if (typeof value !== "number") continue;
    if (!indicatorAppliesToYear(indicator, params.year)) continue;
    variants.push({
      cnCode,
      value,
      indicator,
      column: params.column,
      datasetVersion: CBAM_BENCHMARK_DATASET_VERSION,
      legalSource: CBAM_BENCHMARK_LEGAL_SOURCE,
    });
  }
  return variants;
}

export function resolveOfficialBenchmark(params: {
  cnCode: string;
  column: BenchmarkColumn;
  year: number;
  routeIndicator?: string;
}): BenchmarkResolution {
  const variants = getBenchmarkVariants(params);
  if (variants.length === 0) return { status: "NOT_FOUND", variants: [] };

  const routeFiltered = params.routeIndicator
    ? variants.filter((variant) => indicatorMatchesRoute(variant.indicator, params.routeIndicator))
    : variants;

  if (routeFiltered.length === 1) return { status: "FOUND", benchmark: routeFiltered[0] };
  if (routeFiltered.length === 0) return { status: "NOT_FOUND", variants: [] };

  const unique = new Map(routeFiltered.map((variant) => [`${variant.value}|${variant.indicator ?? ""}`, variant]));
  const deduped = [...unique.values()];
  if (deduped.length === 1) return { status: "FOUND", benchmark: deduped[0] };
  return { status: "AMBIGUOUS", variants: deduped };
}

export const CBAM_BENCHMARK_GROUP_COUNT = GROUPS.length;
