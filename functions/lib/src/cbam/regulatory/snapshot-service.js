"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegulatorySnapshot = getRegulatorySnapshot;
function getRegulatorySnapshot(snapshotId) {
    return {
        snapshotId,
        legalVersion: "EU_2023_956",
        certificatePriceDatasetVersion: "EU_CBAM_PRICE_2026",
        defaultValuesDatasetVersion: "EU_DEFAULT_VALUES_2026_V1.0",
        benchmarkDatasetVersion: "EU_BENCHMARKS_2026",
        cnScopeDatasetVersion: "EU_CN_SCOPE_2026",
        retrievedAt: "2026-07-10T12:00:00Z",
        effectiveAt: "2026-07-10T12:00:00Z",
        sourceHashes: {
            regulation_pdf: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            default_values_xlsx: "a68f828a2a8a18fa68a7f82b8a28fb68a18fb28c2e68a18fa68c2a68a28e68e1",
        },
    };
}
//# sourceMappingURL=snapshot-service.js.map