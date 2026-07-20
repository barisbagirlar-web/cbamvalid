import { CANONICAL_PRICING } from "./pricing-config";

export type CreditPackage = {
  slug: string;
  paddlePriceId: string;
  accountCredits: number;
  cbamReportUses: number;
  active: boolean;
  displayOrder: number;
  featured: boolean;
  packName: string;
  priceFormatted: string;
};

// Ensure we fall back securely if env is missing during build, but warn.
const defaultPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "missing-price-id";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    slug: "pack_premium_dossier_v5",
    paddlePriceId: defaultPriceId,
    accountCredits: 100,
    cbamReportUses: CANONICAL_PRICING.includedSealedReleases,
    active: true,
    displayOrder: 1,
    featured: true,
    packName: CANONICAL_PRICING.packName,
    priceFormatted: CANONICAL_PRICING.priceFormatted,
  }
];

export function getCreditPackageByPriceId(priceId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.paddlePriceId === priceId && p.active);
}

export function getCreditPackageBySlug(slug: string): CreditPackage | undefined {
  const targetSlug = (slug === "cbam-5-reports" || slug === "CBAM_CREDIT_PACK_5" || slug === "CBAM_EXPORTER_FINAL_REPORT") 
    ? "pack_premium_dossier_v5" 
    : slug;
  return CREDIT_PACKAGES.find(p => p.slug === targetSlug && p.active);
}
