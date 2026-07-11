export interface ProductDefinition {
  productCode: string;
  currency: string;
  expectedUnitAmount: number; // in minor units (e.g. 15000 = $150.00)
  entitlementType: string;
  entitlementQuantity: number;
  correctionWindowDays: number;
  maxCustomsLines: number;
  maxInstallations: number;
  maxCnCodes: number;
  active: boolean;
  paddlePriceIdSandbox: string;
  paddlePriceIdProduction: string;
}

export const PRODUCT_CATALOG: Record<string, ProductDefinition> = {
  CBAM_EXPORTER_FINAL_REPORT: {
    productCode: "CBAM_EXPORTER_FINAL_REPORT",
    currency: "USD",
    expectedUnitAmount: 15000,
    entitlementType: "CBAM_SEALED_DOSSIER",
    entitlementQuantity: 1,
    correctionWindowDays: 14,
    maxCustomsLines: 100,
    maxInstallations: 1,
    maxCnCodes: 25,
    active: true,
    paddlePriceIdSandbox: process.env.PADDLE_PRICE_ID_SANDBOX || "pri_01j2fxyz...",
    paddlePriceIdProduction: process.env.PADDLE_PRICE_ID_PRODUCTION || "pri_01j2fabc...",
  },
} as const;

export function getPriceIdForProduct(productCode: string, isSandbox: boolean): string | null {
  const product = PRODUCT_CATALOG[productCode];
  if (!product || !product.active) {
    return null;
  }
  return isSandbox ? product.paddlePriceIdSandbox : product.paddlePriceIdProduction;
}
