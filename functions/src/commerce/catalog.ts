import { COMMERCIAL_CONTRACT, normalizeProductCode } from "./commercial-contract";

export interface ProductDefinition {
  productCode: string;
  currency: "USD";
  expectedUnitAmount: number;
  creditsGranted: number;
  creditsRequiredToUnlock: number;
  releasesPerPack: number;
  entitlementType: "CBAM_SEALED_DOSSIER";
  correctionWindowDays: number;
  maxCustomsLines: number;
  maxInstallations: number;
  maxCnCodes: number;
  active: true;
}

export const PRODUCT_CATALOG: Record<string, ProductDefinition> = {
  [COMMERCIAL_CONTRACT.productCode]: {
    productCode: COMMERCIAL_CONTRACT.productCode,
    currency: COMMERCIAL_CONTRACT.currency,
    expectedUnitAmount: COMMERCIAL_CONTRACT.priceMinor,
    creditsGranted: COMMERCIAL_CONTRACT.creditsGranted,
    creditsRequiredToUnlock: COMMERCIAL_CONTRACT.creditsRequiredToUnlock,
    releasesPerPack: COMMERCIAL_CONTRACT.releasesPerPack,
    entitlementType: "CBAM_SEALED_DOSSIER",
    correctionWindowDays: COMMERCIAL_CONTRACT.correctionWindowDays,
    maxCustomsLines: COMMERCIAL_CONTRACT.maxCustomsLines,
    maxInstallations: COMMERCIAL_CONTRACT.maxInstallations,
    maxCnCodes: COMMERCIAL_CONTRACT.maxCnCodes,
    active: true,
  },
};

export function getProductDefinition(productCode: string): ProductDefinition {
  const canonicalCode = normalizeProductCode(productCode);
  const product = PRODUCT_CATALOG[canonicalCode];
  if (!product?.active) throw new Error("COMMERCIAL_PRODUCT_INACTIVE");
  return product;
}

export function getPriceIdForProduct(productCode: string, isSandbox: boolean): string {
  getProductDefinition(productCode);
  const priceId = isSandbox
    ? process.env.PADDLE_PRICE_ID_SANDBOX
    : process.env.PADDLE_PRICE_ID_PRODUCTION;
  if (!priceId || !/^pri_[A-Za-z0-9]+$/.test(priceId)) {
    throw new Error(isSandbox ? "PADDLE_SANDBOX_PRICE_ID_MISSING" : "PADDLE_PRODUCTION_PRICE_ID_MISSING");
  }
  return priceId;
}
