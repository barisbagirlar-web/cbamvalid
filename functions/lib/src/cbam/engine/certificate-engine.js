"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCertificatePrice = resolveCertificatePrice;
function resolveCertificatePrice(params) {
    const year = params.importYear || 2026;
    const quarter = params.importQuarter || 1;
    if (year === 2026) {
        if (quarter === 1) {
            return {
                priceEurPerTonne: 75.36,
                cadence: "QUARTERLY",
                state: "OFFICIAL_PUBLISHED",
                datasetVersion: "EU_CBAM_PRICE_2026_Q1",
                isProvisional: false,
            };
        }
        else if (quarter === 2) {
            return {
                priceEurPerTonne: 75.28,
                cadence: "QUARTERLY",
                state: "OFFICIAL_PUBLISHED",
                datasetVersion: "EU_CBAM_PRICE_2026_Q2",
                isProvisional: false,
            };
        }
        else {
            // Future Q3/Q4 2026 are not yet published, use provisional
            return {
                priceEurPerTonne: 76.50, // provisional estimate
                cadence: "QUARTERLY",
                state: "PROVISIONAL_MARKET_ESTIMATE",
                datasetVersion: "ESTIMATE_CBAM_PRICE_2026",
                isProvisional: true,
            };
        }
    }
    // 2027 onward uses weekly cadence
    return {
        priceEurPerTonne: 80.0, // fallback provisional estimate
        cadence: "WEEKLY",
        state: "PROVISIONAL_MARKET_ESTIMATE",
        datasetVersion: "ESTIMATE_CBAM_PRICE_2027",
        isProvisional: true,
    };
}
//# sourceMappingURL=certificate-engine.js.map