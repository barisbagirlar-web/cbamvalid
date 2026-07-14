"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_CATALOG = exports.PREPARATION_PACK_PRODUCT_CODE = void 0;
exports.getPriceIdForProduct = getPriceIdForProduct;
exports.PREPARATION_PACK_PRODUCT_CODE = "CBAM_CREDIT_PACK_5";
exports.PRODUCT_CATALOG = {
    [exports.PREPARATION_PACK_PRODUCT_CODE]: {
        productCode: exports.PREPARATION_PACK_PRODUCT_CODE,
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
};
function getPriceIdForProduct(productCode, isSandbox) {
    const product = exports.PRODUCT_CATALOG[productCode];
    if (!product || !product.active)
        return null;
    const priceId = isSandbox ? product.paddlePriceIdSandbox : product.paddlePriceIdProduction;
    return priceId || null;
}
//# sourceMappingURL=catalog.js.map