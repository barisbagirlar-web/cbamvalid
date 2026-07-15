"use strict";
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULESETS = void 0;
exports.getActiveRuleset = getActiveRuleset;
const legal_sources_1 = require("./legal-sources");
exports.RULESETS = {
    "v1.0.0-TRANSITIONAL": {
        version: "1.0.0",
        name: "CBAM Transitional Phase Q4 2023 - Q4 2025",
        period: "TRANSITIONAL",
        activeFrom: "2023-10-01",
        activeUntil: "2025-12-31",
        baseRegulation: ((_a = legal_sources_1.OFFICIAL_SOURCES.REG_2023_956) === null || _a === void 0 ? void 0 : _a.id) || "REG_2023_956",
        implementingActs: [((_b = legal_sources_1.OFFICIAL_SOURCES.IMPL_ACT_2023_1773) === null || _b === void 0 ? void 0 : _b.id) || "IMPL_ACT_2023_1773"],
        delegatedActs: [],
        jurisdiction: "EU",
        sourceProvenance: "Official Journal of the European Union",
        sourceHash: "9f8481358c28cb9e68340d99908cf8dc1de8a562ef6d8a7c2a7bb8658a5be18e",
        supersessionState: "SUPERSEDED",
    },
    "v2.0.0-DEFINITIVE": {
        version: "2.0.0",
        name: "CBAM Definitive Phase Initial",
        period: "DEFINITIVE",
        activeFrom: "2026-01-01",
        activeUntil: "2030-12-31",
        baseRegulation: ((_c = legal_sources_1.OFFICIAL_SOURCES.REG_2023_956) === null || _c === void 0 ? void 0 : _c.id) || "REG_2023_956",
        implementingActs: [((_d = legal_sources_1.OFFICIAL_SOURCES.IMPL_ACT_2025_2083) === null || _d === void 0 ? void 0 : _d.id) || "IMPL_ACT_2025_2083"],
        delegatedActs: [((_e = legal_sources_1.OFFICIAL_SOURCES.DEL_ACT_2025_2547) === null || _e === void 0 ? void 0 : _e.id) || "DEL_ACT_2025_2547"],
        jurisdiction: "EU",
        sourceProvenance: "Official Journal of the European Union",
        sourceHash: "2ca08d6d84a7e9373f7690f0d2c0d83769c0d28362ef74a7bb8658a5be18e2ca",
        supersessionState: "ACTIVE",
    }
};
function getActiveRuleset(date = new Date(), jurisdiction = "EU") {
    const isoDate = date.toISOString().split("T")[0];
    const rulesets = Object.values(exports.RULESETS).sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
    for (const ruleset of rulesets) {
        if (ruleset.jurisdiction === jurisdiction &&
            isoDate >= ruleset.activeFrom &&
            (!ruleset.activeUntil || isoDate <= ruleset.activeUntil)) {
            if (ruleset.supersessionState === "SUPERSEDED" && isoDate >= "2026-01-01") {
                throw new Error(`Ruleset ${ruleset.name} is superseded.`);
            }
            return ruleset;
        }
    }
    throw new Error(`No active or valid CBAM ruleset found for date ${isoDate} in jurisdiction ${jurisdiction}.`);
}
//# sourceMappingURL=rulesets.js.map