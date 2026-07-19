import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";

export type CreditPackage = {
  slug: string;
  productCode: string;
  displayName: string;
  currency: "USD";
  priceMinor: number;
  accountCredits: number;
  creditsRequiredToUnlock: number;
  cbamReportUses: number;
  subscription: false;
  active: true;
  displayOrder: number;
  featured: boolean;
};

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    slug: COMMERCIAL_CONTRACT.slug,
    productCode: COMMERCIAL_CONTRACT.productCode,
    displayName: COMMERCIAL_CONTRACT.displayName,
    currency: COMMERCIAL_CONTRACT.currency,
    priceMinor: COMMERCIAL_CONTRACT.priceMinor,
    accountCredits: COMMERCIAL_CONTRACT.creditsGranted,
    creditsRequiredToUnlock: COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    cbamReportUses: COMMERCIAL_CONTRACT.releasesPerPack,
    subscription: false,
    active: true,
    displayOrder: 1,
    featured: true,
  },
] as const;

export function getCreditPackageBySlug(slug: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((product) => product.slug === slug && product.active);
}

export function formatPackagePrice(product: CreditPackage): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency,
    maximumFractionDigits: 0,
  }).format(product.priceMinor / 100);
}
