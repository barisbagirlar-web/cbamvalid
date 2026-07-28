/**
 * ROI exposure calculator (FAZ 2 / T2.2).
 * Fail-closed: missing/invalid inputs return blocked — never silent zero.
 * Certificate price pin: EU CBAM Q2 2026 official quarterly price from certificate engine SSOT.
 * Default factors: CBAMValid default-value engine SSOT (illustrative sector factors; not a customs filing).
 */

import { getDefaultEmissions } from "@/lib/cbam/engine/default-value-engine";
import { resolveCertificatePrice } from "@/lib/cbam/engine/certificate-engine";

export const ROI_CALCULATOR_VERSION = "roi-exposure-v1.0.0" as const;

export const ROI_SECTORS = ["STEEL", "ALUMINIUM", "CEMENT", "FERTILIZER", "HYDROGEN"] as const;
export type RoiSector = (typeof ROI_SECTORS)[number];

export type RoiBlockedResult = {
  ok: false;
  code: string;
  message: string;
  calculatorVersion: typeof ROI_CALCULATOR_VERSION;
};

export type RoiOkResult = {
  ok: true;
  calculatorVersion: typeof ROI_CALCULATOR_VERSION;
  sector: RoiSector;
  volumeTonnes: number;
  actualSeeTPerT: number;
  defaultSeeTPerT: number;
  defaultDatasetVersion: string;
  certificatePriceEurPerT: number;
  certificateDatasetVersion: string;
  certificatePriceState: string;
  defaultExposureEur: number;
  actualExposureEur: number;
  defaultValuePenaltyEur: number;
  packPriceUsd: number;
  notice: string;
};

export type RoiResult = RoiBlockedResult | RoiOkResult;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateDefaultValuePenalty(input: {
  sector: string;
  volumeTonnes: number | null | undefined;
  actualSeeTPerT: number | null | undefined;
  packPriceUsd: number;
}): RoiResult {
  const sector = String(input.sector || "").toUpperCase();
  if (!ROI_SECTORS.includes(sector as RoiSector)) {
    return {
      ok: false,
      code: "ROI_SECTOR_UNSUPPORTED",
      message: "Select a supported CBAM goods sector. Missing sector blocks the estimate.",
      calculatorVersion: ROI_CALCULATOR_VERSION,
    };
  }

  const volume = input.volumeTonnes;
  if (volume === null || volume === undefined || !Number.isFinite(volume) || volume <= 0) {
    return {
      ok: false,
      code: "ROI_VOLUME_MISSING",
      message: "Enter annual export volume in tonnes greater than zero. Missing volume is not treated as zero.",
      calculatorVersion: ROI_CALCULATOR_VERSION,
    };
  }

  const actual = input.actualSeeTPerT;
  if (actual === null || actual === undefined || !Number.isFinite(actual) || actual < 0) {
    return {
      ok: false,
      code: "ROI_ACTUAL_SEE_MISSING",
      message:
        "Enter your estimated actual specific embedded emissions (tCO2e per tonne). Missing actual intensity is not treated as zero.",
      calculatorVersion: ROI_CALCULATOR_VERSION,
    };
  }

  const defaults = getDefaultEmissions(sector);
  if (!defaults || defaults.unit !== "t") {
    return {
      ok: false,
      code: "ROI_DEFAULT_FACTOR_MISSING",
      message: "No default-factor row is published for this sector in the calculator SSOT.",
      calculatorVersion: ROI_CALCULATOR_VERSION,
    };
  }

  const cert = resolveCertificatePrice({ importYear: 2026, importQuarter: 2 });
  if (cert.state !== "OFFICIAL_PUBLISHED" || cert.isProvisional) {
    return {
      ok: false,
      code: "ROI_CERTIFICATE_PRICE_NOT_OFFICIAL",
      message: "Official Q2 2026 certificate price is required. Provisional prices are blocked.",
      calculatorVersion: ROI_CALCULATOR_VERSION,
    };
  }

  const defaultSee = defaults.directFactor + defaults.indirectFactor;
  const defaultExposure = volume * defaultSee * cert.priceEurPerTonne;
  const actualExposure = volume * actual * cert.priceEurPerTonne;
  const penalty = defaultExposure - actualExposure;

  return {
    ok: true,
    calculatorVersion: ROI_CALCULATOR_VERSION,
    sector: sector as RoiSector,
    volumeTonnes: volume,
    actualSeeTPerT: actual,
    defaultSeeTPerT: defaultSee,
    defaultDatasetVersion: defaults.datasetVersion,
    certificatePriceEurPerT: cert.priceEurPerTonne,
    certificateDatasetVersion: cert.datasetVersion,
    certificatePriceState: cert.state,
    defaultExposureEur: roundMoney(defaultExposure),
    actualExposureEur: roundMoney(actualExposure),
    defaultValuePenaltyEur: roundMoney(penalty),
    packPriceUsd: input.packPriceUsd,
    notice:
      "Illustrative exposure using CBAMValid default-factor SSOT and the official Q2 2026 CBAM certificate price. Multi-dimensional official defaults and your verified actual values may differ. Not a customs calculation, certificate purchase, or verification opinion.",
  };
}
