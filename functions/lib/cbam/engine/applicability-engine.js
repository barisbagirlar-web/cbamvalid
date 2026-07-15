"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineApplicability = determineApplicability;
const cn_scope_dataset_1 = require("../regulatory/cn-scope-dataset");
function determineApplicability(params) {
    const cnCode = params.cnCode || "";
    const totalMass = params.totalMassTonnes || 0;
    const res = (0, cn_scope_dataset_1.resolveCNCodeScope)(cnCode);
    const sector = res.sector;
    const chapter = cnCode.substring(0, 2);
    const isElectricityOrHydrogen = sector === "ELECTRICITY" || sector === "HYDROGEN";
    // Threshold rules: 50-tonne de minimis does not apply to electricity or hydrogen
    let underThreshold = false;
    if (res.inScope && !isElectricityOrHydrogen) {
        if (totalMass < 50.0) {
            underThreshold = true;
        }
    }
    // Electricity and Hydrogen are always applicable if in scope
    const isApplicable = res.inScope && (!underThreshold || isElectricityOrHydrogen);
    const requiresAuthorisedDeclarant = isApplicable && params.role !== "OPERATOR";
    const requiresVerification = isApplicable;
    return {
        isApplicable,
        sector,
        chapter,
        underThreshold,
        requiresAuthorisedDeclarant,
        requiresVerification,
    };
}
//# sourceMappingURL=applicability-engine.js.map