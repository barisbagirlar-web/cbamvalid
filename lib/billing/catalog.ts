export type CreditPackage = {
  slug: string;
  paddlePriceId: string;
  accountCredits: number;
  cbamReportUses: number;
  active: boolean;
  displayOrder: number;
  featured: boolean;
};

// Ensure we fall back securely if env is missing during build, but warn.
const defaultPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "missing-price-id";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    slug: "cbam-5-reports",
    paddlePriceId: defaultPriceId,
    accountCredits: 100,
    cbamReportUses: 5,
    active: true,
    displayOrder: 1,
    featured: true,
  }
];

export function getCreditPackageByPriceId(priceId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.paddlePriceId === priceId && p.active);
}

export function getCreditPackageBySlug(slug: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.slug === slug && p.active);
}
