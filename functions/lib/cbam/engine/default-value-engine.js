"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultEmissions = getDefaultEmissions;
const DEFAULT_VALUES_MAP = {
    CEMENT: { directFactor: 0.76, indirectFactor: 0.08, unit: "t" },
    STEEL: { directFactor: 1.89, indirectFactor: 0.42, unit: "t" },
    ALUMINIUM: { directFactor: 8.24, indirectFactor: 10.21, unit: "t" },
    FERTILIZER: { directFactor: 2.11, indirectFactor: 0.35, unit: "t" },
    ELECTRICITY: { directFactor: 0.45, indirectFactor: 0.0, unit: "MWh" },
    HYDROGEN: { directFactor: 9.85, indirectFactor: 1.2, unit: "t" },
};
function getDefaultEmissions(sector) {
    const defaults = DEFAULT_VALUES_MAP[sector];
    if (!defaults) {
        return null;
    }
    return Object.assign(Object.assign({}, defaults), { datasetVersion: "EU_DEFAULT_VALUES_2026_V1.0" });
}
//# sourceMappingURL=default-value-engine.js.map