import { CBAM_BENCHMARK_DATASET_VERSION } from "./benchmarks-2025-2620";
import { CBAM_CSCF_2026_2030 } from "./free-allocation";

/**
 * Versioned, code-reviewed parameter surface for definitive-period calculations.
 * Empty maps are intentional placeholders: unpublished values must never be invented.
 */
export const DEFINITIVE_CALCULATION_PARAMETERS = {
  version: "CBAM-PARAMETERS-2026.08.13",
  benchmarkDatasetVersion: CBAM_BENCHMARK_DATASET_VERSION,
  benchmarkLegalSource: "Commission Implementing Regulation (EU) 2025/2620",
  crossSectoralCorrectionFactor2026To2030: CBAM_CSCF_2026_2030,
  crossSectoralCorrectionFactorSource: "Commission Implementing Decision (EU) 2026/1862",
  thirdCountryCarbonPrices: {} as Readonly<Record<string, number>>,
  thirdCountryCarbonPriceStatus: "NOT_PUBLISHED_IN_RULESET" as const,
  fxRates: {} as Readonly<Record<string, number>>,
  fxRateStatus: "REQUIRES_PINNED_SOURCE" as const,
} as const;

export type DefinitiveCalculationParameters = typeof DEFINITIVE_CALCULATION_PARAMETERS;
