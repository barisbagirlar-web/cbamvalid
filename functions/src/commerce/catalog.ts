import { PREPARATION_PACK } from "./preparation-pack";

export interface ProductDefinition {
  productCode: string;
  currency: string;
  expectedUnitAmount: number;
  entitlementType: "CBAM_PREPARATION_PACK";
  entitlementQuantity: number;
  accountCredits: number;
  creditsPerRelease: number;
  correctionWindowDays: number;
  maxCustomsLines: number;
  maxInstallations: number;
  maxCnCodes: number;
  active: boolean;
  paddlePriceIdSandbox: string;
  paddlePriceIdProduction: string;
}

const product: ProductDefinition = {
  productCode: PREPARATION_PACK.productCode,
  currency: PREPARATION_PACK.currency,
  expectedUnitAmount: PREPARATION_PACK.priceMinor,
  entitlementType: "CBAM_PREPARATION_PACK",
  entitlementQuantity: 1,
  accountCredits: PREPARATION_PACK.accountCredits,
  creditsPerRelease: PREPARATION_PACK.creditsPerRelease,
  correctionWindowDays: PREPARATION_PACK.correctionWindowDays,
  maxCustomsLines: PREPARATION_PACK.maxCustomsLines,
  maxInstallations: PREPARATION_PACK.maxInstallations,
  maxCnCodes: PREPARATION_PACK.maxCnCodes,
  active: true,
  paddlePriceIdSandbox: process.env.PADDLE_PRICE_ID_SANDBOX?.trim() || "",
  paddlePriceIdProduction: process.env.PADDLE_PRICE_ID_PRODUCTION?.trim() || "",
};

export const PRODUCT_CATALOG: Readonly<Record<string, ProductDefinition>> = Object.freeze({
  [PREPARATION_PACK.productCode]: product,
});

export function getProduct(productCode: string): ProductDefinition | null {
  const candidate = PRODUCT_CATALOG[productCode];
  return candidate?.active ? candidate : null;
}

export function getPriceIdForProduct(productCode: string, isSandbox: boolean): string | null {
  const candidate = getProduct(productCode);
  if (!candidate) return null;
  const priceId = isSandbox ? candidate.paddlePriceIdSandbox : candidate.paddlePriceIdProduction;
  return /^pri_[A-Za-z0-9]+$/.test(priceId) ? priceId : null;
}
