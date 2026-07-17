export type PriceState =
  | "OFFICIAL_PUBLISHED"
  | "PROVISIONAL_MARKET_ESTIMATE"
  | "NOT_YET_PUBLISHED";

export interface CertificatePriceResult {
  priceEurPerTonne: number;
  cadence: "QUARTERLY" | "WEEKLY";
  state: PriceState;
  datasetVersion: string;
  isProvisional: boolean;
}

export function resolveCertificatePrice(params: {
  importYear: number;
  importQuarter?: number; // 1-4
  importWeek?: number; // 1-53
}): CertificatePriceResult {
  const year = params.importYear || 2026;
  const quarter = params.importQuarter || 1;

  if (year === 2026) {
    if (quarter === 1) {
      return {
        priceEurPerTonne: 75.50,
        cadence: "QUARTERLY",
        state: "OFFICIAL_PUBLISHED",
        datasetVersion: "EU_CBAM_PRICE_2026_Q1",
        isProvisional: false,
      };
    } else if (quarter === 2) {
      return {
        priceEurPerTonne: 75.28,
        cadence: "QUARTERLY",
        state: "OFFICIAL_PUBLISHED",
        datasetVersion: "EU_CBAM_PRICE_2026_Q2",
        isProvisional: false,
      };
    } else {
      // Future Q3/Q4 2026 are not yet published, use provisional
      return {
        priceEurPerTonne: 76.50, // provisional estimate
        cadence: "QUARTERLY",
        state: "PROVISIONAL_MARKET_ESTIMATE",
        datasetVersion: "ESTIMATE_CBAM_PRICE_2026",
        isProvisional: true,
      };
    }
  }

  // 2027 onward uses weekly cadence
  return {
    priceEurPerTonne: 80.0, // fallback provisional estimate
    cadence: "WEEKLY",
    state: "PROVISIONAL_MARKET_ESTIMATE",
    datasetVersion: "ESTIMATE_CBAM_PRICE_2027",
    isProvisional: true,
  };
}
