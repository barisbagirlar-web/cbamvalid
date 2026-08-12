import { resolveOfficialBenchmark, type BenchmarkColumn } from "./benchmarks-2025-2620";

export const CBAM_CSCF_2026_2030 = 1 as const;
export const CBAM_CSCF_SOURCE = "Commission Implementing Decision (EU) 2026/1862" as const;

const CBAM_FACTORS: Record<number, number> = {
  2026: 0.975,
  2027: 0.95,
  2028: 0.9,
  2029: 0.775,
  2030: 0.515,
};

export type FreeAllocationResolution =
  | {
      status: "CALCULATED";
      benchmarkValue: number;
      benchmarkIndicator: string | null;
      cbamFactor: number;
      cscf: number;
      specificEmbeddedFreeAllocationTco2ePerT: number;
      freeAllocationAdjustmentTco2e: number;
      sources: readonly string[];
    }
  | { status: "BENCHMARK_AMBIGUOUS"; variants: readonly { value: number; indicator: string | null }[] }
  | { status: "BENCHMARK_NOT_FOUND" }
  | { status: "UNSUPPORTED_YEAR" };

function round(value: number, decimals = 6): number {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function calculateFreeAllocationAdjustment(params: {
  cnCode: string;
  year: number;
  massTonnes: number;
  dataBasis: "ACTUAL" | "DEFAULT";
  routeIndicator?: string;
}): FreeAllocationResolution {
  if (!Number.isFinite(params.massTonnes) || params.massTonnes < 0) {
    throw new Error("INVALID_FREE_ALLOCATION_MASS");
  }
  if (params.cnCode.replace(/\s+/g, "") === "27160000") {
    return {
      status: "CALCULATED",
      benchmarkValue: 0,
      benchmarkIndicator: null,
      cbamFactor: CBAM_FACTORS[params.year] ?? 0,
      cscf: CBAM_CSCF_2026_2030,
      specificEmbeddedFreeAllocationTco2ePerT: 0,
      freeAllocationAdjustmentTco2e: 0,
      sources: ["Commission Implementing Regulation (EU) 2025/2620, Article 1(2)"],
    };
  }

  const cbamFactor = CBAM_FACTORS[params.year];
  if (cbamFactor == null) return { status: "UNSUPPORTED_YEAR" };

  const benchmark = resolveOfficialBenchmark({
    cnCode: params.cnCode,
    column: params.dataBasis as BenchmarkColumn,
    year: params.year,
    routeIndicator: params.routeIndicator,
  });
  if (benchmark.status === "NOT_FOUND") return { status: "BENCHMARK_NOT_FOUND" };
  if (benchmark.status === "AMBIGUOUS") {
    return {
      status: "BENCHMARK_AMBIGUOUS",
      variants: benchmark.variants.map(({ value, indicator }) => ({ value, indicator })),
    };
  }

  const specific = benchmark.benchmark.value * cbamFactor * CBAM_CSCF_2026_2030;
  return {
    status: "CALCULATED",
    benchmarkValue: benchmark.benchmark.value,
    benchmarkIndicator: benchmark.benchmark.indicator,
    cbamFactor,
    cscf: CBAM_CSCF_2026_2030,
    specificEmbeddedFreeAllocationTco2ePerT: round(specific),
    freeAllocationAdjustmentTco2e: round(specific * params.massTonnes),
    sources: [
      "Commission Implementing Regulation (EU) 2025/2620",
      "Directive 2003/87/EC, Article 10a(1a)",
      CBAM_CSCF_SOURCE,
    ],
  };
}
