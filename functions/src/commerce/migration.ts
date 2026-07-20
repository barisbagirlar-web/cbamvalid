/**
 * Server-Side Commerce Migration Module
 * Retains legacy product codes and maps them to the canonical pack_premium_dossier_v5 code.
 */

export const LEGACY_PRODUCT_CODES = {
  CBAM_CREDIT_PACK_5: "CBAM_CREDIT_PACK_5",
  CBAM_EXPORTER_FINAL_REPORT: "CBAM_EXPORTER_FINAL_REPORT",
} as const;

export function mapLegacyProductCode(productCode: string): string {
  if (productCode === LEGACY_PRODUCT_CODES.CBAM_CREDIT_PACK_5 || productCode === LEGACY_PRODUCT_CODES.CBAM_EXPORTER_FINAL_REPORT) {
    return "pack_premium_dossier_v5";
  }
  return productCode;
}
