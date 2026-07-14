"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessCaseReadiness = assessCaseReadiness;
const SEVERITY_WEIGHTS = {
    BLOCKER: 100,
    CRITICAL: 50,
    MAJOR: 20,
    MINOR: 5,
    ADVISORY: 1
};
function assessCaseReadiness(caseData) {
    const gaps = [];
    // Internal helper to create gaps
    const addGap = (requirement, severity, whyItMatters, requiredEvidence, suggestedAction, isBlocking = false) => {
        gaps.push({
            gapId: crypto.randomUUID(),
            requirement,
            severity,
            whyItMatters,
            requiredEvidence,
            suggestedAction,
            isBlocking,
            resolutionStatus: "OPEN"
        });
    };
    // 1. Mandatory Identity Check
    if (!caseData.exporterIdentity.legalName.value) {
        addGap("Exporter Legal Corporate Profile", "BLOCKER", "Exporter credentials must match the shipping commercial invoice to establish provenance.", "Corporate Registry or tax certification statement", "Provide official exporter legal name.", true);
    }
    if (!caseData.importerIdentity.eoriNumber.value) {
        addGap("Declarant EORI Reference", "BLOCKER", "The EU buyer cannot submit the data packet without a valid declarant registration code.", "EU Customs Tariff authorization profile", "Provide EORI number.", true);
    }
    // 2. CN Code and Scope
    if (caseData.goods.length === 0) {
        addGap("Products Declaration", "BLOCKER", "At least one imported good must be declared.", "Customs Declaration", "Add an imported good with a valid CN Code.", true);
    }
    else {
        for (const good of caseData.goods) {
            if (!good.cnCode.value) {
                addGap("CN Code", "BLOCKER", "A valid 8-digit CN code is required for sector classification.", "Customs Declaration", "Provide an 8-digit CN code.", true);
            }
            if (!good.productionVolume.value || Number(good.productionVolume.value) <= 0) {
                addGap("Net Production Mass Volume", "BLOCKER", "Specific emissions are calculated by dividing total emissions over total net production volume.", "Signed plant output statistics logs", "Provide positive production volume.", true);
            }
        }
    }
    // 3. Installation
    if (!caseData.installation.name.value) {
        addGap("Installation Facility Profile", "BLOCKER", "Direct process emissions must be anchored to a specific production facility.", "Production permit licenses", "Provide installation name.", true);
    }
    if (!caseData.installation.productionRoute.value) {
        addGap("Production Route Technology", "BLOCKER", "The production route determines the exact system boundaries and formulas applied.", "Technical plant specification", "Select a production route.", true);
    }
    // 4. Emissions Evidence Traceability
    if (!caseData.directEmissions.value && caseData.directEmissions.value !== 0) {
        addGap("Direct Emissions Data", "BLOCKER", "Direct emissions are required for all sectors.", "Actual verified data or standard default values", "Enter direct emissions or select default values pathway.", true);
    }
    else if (caseData.directEmissions.sourceType === "ESTIMATED") {
        addGap("Estimated Direct Emissions", "CRITICAL", "Estimates are strictly prohibited by the CBAM regulation for final reporting.", "Primary monitoring data", "Replace estimates with primary monitoring data.", false);
    }
    // Check evidence lineage
    if (caseData.evidenceRegister.length === 0) {
        addGap("Evidence Register Coverage", "CRITICAL", "An audit-ready dossier requires verifiable document references for its inputs.", "Source documents (invoices, lab reports, declarations)", "Upload or link at least one primary evidence document.", false);
    }
    // 5. Calculate Statuses
    const criticalBlockers = gaps.filter(g => g.isBlocking || g.severity === "BLOCKER");
    let status = "NOT_READY";
    let isEligibleForSealing = false;
    if (criticalBlockers.length > 0) {
        status = "NOT_READY";
        isEligibleForSealing = false;
    }
    else if (gaps.length > 0) {
        status = "READY_WITH_OPEN_ITEMS";
        // Can technically seal if no blockers exist
        isEligibleForSealing = true;
    }
    else {
        // Only achieve independent verification readiness if zero gaps exist
        status = "READY_FOR_INDEPENDENT_VERIFICATION";
        isEligibleForSealing = true;
    }
    const completenessScore = Math.max(0, 100 - gaps.reduce((acc, g) => acc + SEVERITY_WEIGHTS[g.severity], 0));
    const completenessPercentage = criticalBlockers.length > 0 ? 0 : completenessScore;
    return {
        status,
        criticalBlockers,
        allGaps: gaps,
        isEligibleForSealing,
        completenessPercentage
    };
}
//# sourceMappingURL=readiness-assessor.js.map