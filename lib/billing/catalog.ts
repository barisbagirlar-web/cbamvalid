import { PREPARATION_PACK } from "@/lib/commerce/preparation-pack";

export type CreditPackage = {
  slug: string;
  productCode: string;
  displayName: string;
  paddlePriceId: string;
  currency: string;
  priceMinor: number;
  accountCredits: number;
  cbamReportUses: number;
  active: boolean;
  configured: boolean;
  displayOrder: number;
  featured: boolean;
};

const legacyPublicPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim() || "";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    slug: PREPARATION_PACK.slug,
    productCode: PREPARATION_PACK.productCode,
    displayName: PREPARATION_PACK.displayName,
    paddlePriceId: legacyPublicPriceId,
    currency: PREPARATION_PACK.currency,
    priceMinor: PREPARATION_PACK.priceMinor,
    accountCredits: PREPARATION_PACK.accountCredits,
    cbamReportUses: PREPARATION_PACK.maxReleases,
    active: true,
    configured: true,
    displayOrder: 1,
    featured: true,
  },
];

export function getCreditPackageByPriceId(priceId: string): CreditPackage | undefined {
  if (!priceId) return undefined;
  return CREDIT_PACKAGES.find((item) => item.paddlePriceId === priceId && item.active);
}

export function getCreditPackageBySlug(slug: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((item) => item.slug === slug && item.active);
}
