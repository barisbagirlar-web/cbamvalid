import { mapLegacyProductCode } from "./migration";

export interface ProductDefinition {
  productCode: string;
  currency: string;
  expectedUnitAmount: number; // in minor units (e.g. 14900 = $149.00)
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
  pack_premium_dossier_v5: {
    productCode: "pack_premium_dossier_v5",
    currency: "USD",
    expectedUnitAmount: 14900,
    entitlementType: "CBAM_SEALED_DOSSIER",
    entitlementQuantity: 5,
    correctionWindowDays: 14,
    maxCustomsLines: 100,
    maxInstallations: 1,
    maxCnCodes: 25,
    active: true,
    paddlePriceIdSandbox: process.env.PADDLE_PRICE_ID_SANDBOX || process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "pri_01kx4373n0xa7fthk3ttqqd7p8",
    paddlePriceIdProduction: process.env.PADDLE_PRICE_ID_PRODUCTION || process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "pri_01kx4373n0xa7fthk3ttqqd7p8",
  },
} as const;

export function getPriceIdForProduct(productCode: string, isSandbox: boolean): string | null {
  const mappedCode = mapLegacyProductCode(productCode);
  const product = PRODUCT_CATALOG[mappedCode];
  if (!product || !product.active) {
    return null;
  }
  return isSandbox ? product.paddlePriceIdSandbox : product.paddlePriceIdProduction;
}
