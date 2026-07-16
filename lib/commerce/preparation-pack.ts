export const PREPARATION_PACK = Object.freeze({
  productCode: "CBAM_CREDIT_PACK_5",
  slug: "cbam-5-reports",
  displayName: "CBAM Verifier-Preparation Pack",
  currency: "USD",
  priceMinor: 14900,
  accountCredits: 100,
  maxReleases: 5,
  creditsPerRelease: 20,
  correctionWindowDays: 14,
  maxCustomsLines: 100,
  maxInstallations: 1,
  maxCnCodes: 25,
} as const);

export function formatPreparationPackPrice(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: PREPARATION_PACK.currency,
    maximumFractionDigits: 0,
  }).format(PREPARATION_PACK.priceMinor / 100);
}

export function releasesFromCredits(credits: number): number {
  if (!Number.isSafeInteger(credits) || credits < 0) return 0;
  return Math.floor(credits / PREPARATION_PACK.creditsPerRelease);
}
