"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_CATALOG = void 0;
exports.getPriceIdForProduct = getPriceIdForProduct;
exports.PRODUCT_CATALOG = {
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
    CBAM_CREDIT_PACK_5: {
        productCode: "CBAM_CREDIT_PACK_5",
        currency: "USD",
        expectedUnitAmount: 15000, // Or whatever the pack costs (150 EUR/USD)
        entitlementType: "CBAM_SEALED_DOSSIER",
        entitlementQuantity: 5,
        correctionWindowDays: 14,
        maxCustomsLines: 100,
        maxInstallations: 1,
        maxCnCodes: 25,
        active: true,
        paddlePriceIdSandbox: process.env.PADDLE_PRICE_ID_SANDBOX || "pri_01j2fxyz...",
        paddlePriceIdProduction: process.env.PADDLE_PRICE_ID_PRODUCTION || "pri_01j2fabc...",
    },
};
function getPriceIdForProduct(productCode, isSandbox) {
    const product = exports.PRODUCT_CATALOG[productCode];
    if (!product || !product.active) {
        return null;
    }
    return isSandbox ? product.paddlePriceIdSandbox : product.paddlePriceIdProduction;
}
//# sourceMappingURL=catalog.js.map