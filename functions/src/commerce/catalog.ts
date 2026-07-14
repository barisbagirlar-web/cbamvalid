export interface ProductDefinition {
  productCode: string;
  currency: string;
  expectedUnitAmount: number; // minor units: 15000 = USD 150.00
  entitlementType: string;
  entitlementQuantity: number;
  correctionWindowDays: number;
  maxCustomsLines: number;
  maxInstallations: number;
  maxCnCodes: number;
  active: boolean;
  readonly paddlePriceIdSandbox: string;
  readonly paddlePriceIdProduction: string;
}

export const PREPARATION_PACK_PRODUCT_CODE = "CBAM_CREDIT_PACK_5" as const;

export const PRODUCT_CATALOG: Record<string, ProductDefinition> = {
  [PREPARATION_PACK_PRODUCT_CODE]: {
    productCode: PREPARATION_PACK_PRODUCT_CODE,
    currency: "USD",
    expectedUnitAmount: 15000,
    entitlementType: "CBAM_SEALED_DOSSIER_VERSION",
    entitlementQuantity: 5,
    correctionWindowDays: 14,
    maxCustomsLines: 100,
    maxInstallations: 1,
    maxCnCodes: 25,
    active: true,
    get paddlePriceIdSandbox() {
      return process.env.PADDLE_PRICE_ID_SANDBOX || process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
    },
    get paddlePriceIdProduction() {
      return process.env.PADDLE_PRICE_ID_PRODUCTION || process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
    },
  },
} as const;

export function getPriceIdForProduct(productCode: string, isSandbox: boolean): string | null {
  const product = PRODUCT_CATALOG[productCode];
  if (!product || !product.active) return null;
  const priceId = isSandbox ? product.paddlePriceIdSandbox : product.paddlePriceIdProduction;
  return priceId || null;
}
