"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_LIMITATIONS = exports.REPORT_BASIS = exports.REPORT_STANDARD_VERSION = void 0;
exports.assessVerifierGradeReport = assessVerifierGradeReport;
const decimal_js_1 = require("decimal.js");
exports.REPORT_STANDARD_VERSION = "CBAMVALID-VGRS-1.0";
exports.REPORT_BASIS = [
    "Regulation (EU) 2023/956, Articles 7, 8, 10 and Annexes IV, V and VI",
    "Commission Implementing Regulation (EU) 2018/2066, where incorporated by the active CBAM ruleset",
    "Commission Implementing Regulation (EU) 2018/2067, where incorporated by the active CBAM verification ruleset",
];
exports.REPORT_LIMITATIONS = [
    "This package is an operator/exporter evidence and calculation dossier prepared for independent verification.",
    "It is not an accredited verification opinion and does not replace the work, professional scepticism or installation-visit decisions of an accredited verifier.",
    "It is not customs advice, an EU authority decision, a CBAM Registry acceptance guarantee or an official Registry submission file.",
    "Legal and technical rules may change; the ruleset and engine version printed in the sealed release define the basis applied.",
];
function decimal(value) {
    if (value === null || value === undefined || value === "")
        return null;
    try {
        const parsed = new decimal_js_1.Decimal(value);
        return parsed.isFinite() ? parsed : null;
    }
    catch (_a) {
        return null;
    }
}
function evidenceSupports(caseData, path, evidenceId) {
    if (!evidenceId)
        return false;
    const evidence = caseData.evidenceRegister.find((item) => item.evidenceId === evidenceId);
    return Boolean(evidence &&
        evidence.linkedInputs.includes(path) &&
        evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) &&
        evidence.reviewStatus === "APPROVED" &&
        (evidence.supportStatus === "SUPPORTED" || evidence.supportStatus === "PARTIALLY_SUPPORTED") &&
        /^[a-f0-9]{64}$/i.test(evidence.fileHash) &&
        evidence.sizeBytes > 0);
}
function requiredEvidencePaths(caseData) {
    const paths = [
        { path: "importerIdentity.eoriNumber", evidenceId: caseData.importerIdentity.eoriNumber.evidenceId },
        { path: "directEmissions", evidenceId: caseData.directEmissions.evidenceId },
        { path: "electricityConsumed", evidenceId: caseData.electricityConsumed.evidenceId },
        { path: "gridEmissionFactor", evidenceId: caseData.gridEmissionFactor.evidenceId },
    ];
    caseData.goods.forEach((good, index) => {
        var _a;
        paths.push({ path: `goods.${index}.cnCode`, evidenceId: good.cnCode.evidenceId }, { path: `goods.${index}.productionVolume`, evidenceId: good.productionVolume.evidenceId });
        if (caseData.goods.length > 1) {
            paths.push({ path: `goods.${index}.allocationShare`, evidenceId: (_a = good.allocationShare) === null || _a === void 0 ? void 0 : _a.evidenceId });
        }
    });
    caseData.precursors.forEach((precursor, index) => {
        paths.push({ path: `precursors.${index}.quantity`, evidenceId: precursor.quantity.evidenceId }, { path: `precursors.${index}.directEmissions`, evidenceId: precursor.directEmissions.evidenceId }, { path: `precursors.${index}.indirectEmissions`, evidenceId: precursor.indirectEmissions.evidenceId });
    });
    return paths;
}
function hasAcceptedDecision(caseData, topic, requireEvidence = false) {
    return caseData.methodologyDecisions.some((decision) => decision.topic === topic &&
        decision.reviewStatus === "ACCEPTED" &&
        decision.reason.trim().length > 0 &&
        decision.legalOrTechnicalBasis.trim().length > 0 &&
        decision.rulesetVersion.trim().length > 0 &&
        (!requireEvidence || decision.evidenceIds.length > 0) &&
        decision.evidenceIds.every((evidenceId) => caseData.evidenceRegister.some((evidence) => evidence.evidenceId === evidenceId &&
            evidence.reviewStatus === "APPROVED" &&
            (evidence.supportStatus === "SUPPORTED" || evidence.supportStatus === "PARTIALLY_SUPPORTED"))));
}
function assessVerifierGradeReport(params) {
    const { caseData, calculation, qualityControls } = params;
    const issues = [];
    const add = (code, severity, message, remediation) => {
        issues.push({ code, severity, message, remediation });
    };
    if (!String(caseData.exporterIdentity.legalName.value || "").trim())
        add("REPORT_OPERATOR_IDENTITY_MISSING", "BLOCKER", "Operator/exporter legal identity is missing.", "Enter the legal name of the installation operator or exporter.");
    if (!String(caseData.installation.name.value || "").trim())
        add("REPORT_INSTALLATION_IDENTITY_MISSING", "BLOCKER", "Installation identity is missing.", "Enter the installation name.");
    if (!String(caseData.installation.country.value || "").trim())
        add("REPORT_INSTALLATION_COUNTRY_MISSING", "BLOCKER", "Installation country is missing.", "Enter the ISO country code or unambiguous country name.");
    if (!String(caseData.installation.productionRoute.value || "").trim())
        add("REPORT_PRODUCTION_ROUTE_MISSING", "BLOCKER", "Production route is missing.", "Describe the production route used for the covered goods.");
    if (!String(caseData.installation.systemBoundaries || "").trim())
        add("REPORT_SYSTEM_BOUNDARY_MISSING", "BLOCKER", "System-boundary statement is missing.", "Document included and excluded production processes, source streams and transfers.");
    if (caseData.goods.length === 0)
        add("REPORT_GOODS_MISSING", "BLOCKER", "No goods are defined.", "Add every covered good/CN group produced within the reporting boundary.");
    const evidenceRequirements = requiredEvidencePaths(caseData);
    const supportedFields = evidenceRequirements.filter((requirement) => evidenceSupports(caseData, requirement.path, requirement.evidenceId)).length;
    const evidencePercentage = evidenceRequirements.length === 0 ? 0 : Math.round((supportedFields / evidenceRequirements.length) * 100);
    if (supportedFields !== evidenceRequirements.length) {
        add("REPORT_EVIDENCE_COVERAGE_INCOMPLETE", "BLOCKER", `Only ${supportedFields} of ${evidenceRequirements.length} material fields have approved supporting evidence.`, "Upload, hash, internally approve and link evidence for every material identity, quantity, emissions, factor, precursor and allocation field.");
    }
    const unresolvedQc = qualityControls.filter((item) => item.status === "BLOCKER" || item.status === "WARNING");
    if (unresolvedQc.length > 0)
        add("REPORT_QC_NOT_CLOSED", "BLOCKER", `${unresolvedQc.length} quality-control findings remain unresolved.`, "Resolve all blockers and warnings before sealing the verifier-preparation package.");
    const traceNodes = calculation.trace || [];
    const validHashes = traceNodes.filter((node) => /^[a-f0-9]{64}$/i.test(node.calculationHash)).length;
    const hashCoveragePercentage = traceNodes.length === 0 ? 0 : Math.round((validHashes / traceNodes.length) * 100);
    if (traceNodes.length === 0 || hashCoveragePercentage !== 100)
        add("REPORT_CALCULATION_TRACE_INCOMPLETE", "BLOCKER", "Calculation trace is empty or contains invalid node hashes.", "Recalculate with the production engine and preserve every formula node, input, unit, output and SHA-256 hash.");
    if (!/^[a-f0-9]{64}$/i.test(calculation.calculationRootHash))
        add("REPORT_CALCULATION_ROOT_HASH_INVALID", "BLOCKER", "Calculation root hash is invalid.", "Regenerate the result through the deterministic production calculation engine.");
    if (traceNodes.flatMap((node) => node.warnings || []).filter(Boolean).length > 0)
        add("REPORT_CALCULATION_WARNINGS_OPEN", "BLOCKER", "Calculation warnings remain in the sealed result.", "Resolve the data or methodology conditions that produced calculation warnings.");
    let allocationReconciled = caseData.goods.length <= 1;
    if (caseData.goods.length > 1) {
        const shares = caseData.goods.map((good) => { var _a; return decimal((_a = good.allocationShare) === null || _a === void 0 ? void 0 : _a.value); });
        const validShares = shares.filter((share) => share !== null);
        if (validShares.length !== shares.length ||
            validShares.some((share) => share.lte(0) || share.gt(1))) {
            add("REPORT_ALLOCATION_SHARE_INVALID", "BLOCKER", "Every good in a multi-good installation must have a positive allocation share not exceeding 1.", "Enter evidence-supported decimal allocation shares for every good.");
        }
        else {
            const sum = validShares.reduce((total, share) => total.plus(share), new decimal_js_1.Decimal(0));
            allocationReconciled = sum.minus(1).abs().lte("0.000001");
            if (!allocationReconciled)
                add("REPORT_ALLOCATION_NOT_RECONCILED", "BLOCKER", `Good allocation shares sum to ${sum.toString()} instead of 1.`, "Adjust allocation shares so they reconcile to 1 within 0.000001.");
        }
        if (!hasAcceptedDecision(caseData, "GOODS_EMISSIONS_ALLOCATION", true))
            add("REPORT_ALLOCATION_METHOD_MISSING", "BLOCKER", "The multi-good emissions-allocation method is not documented, evidence-backed and accepted.", "Add an accepted GOODS_EMISSIONS_ALLOCATION decision with basis, rationale and approved evidence references.");
    }
    if (caseData.precursors.length === 0 && !hasAcceptedDecision(caseData, "PRECURSOR_SCOPE"))
        add("REPORT_PRECURSOR_SCOPE_UNCONFIRMED", "BLOCKER", "No precursors are declared and no accepted precursor-scope decision exists.", "Document why precursors are not applicable to the selected goods and production route.");
    const estimatedMaterialInputs = [
        ["directEmissions", caseData.directEmissions],
        ["electricityConsumed", caseData.electricityConsumed],
        ["gridEmissionFactor", caseData.gridEmissionFactor],
    ];
    for (const [path, datum] of estimatedMaterialInputs) {
        if (datum.sourceType === "ESTIMATED" && !hasAcceptedDecision(caseData, `ESTIMATE:${path}`, true)) {
            add("REPORT_ESTIMATE_METHOD_UNDOCUMENTED", "BLOCKER", `${path} uses an estimate without an evidence-backed accepted methodology decision.`, "Document the estimate method, legal or technical basis, uncertainty and approved evidence references.");
        }
    }
    const openMaterialFindings = caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED" && (gap.isBlocking || ["BLOCKER", "CRITICAL", "MAJOR"].includes(gap.severity)));
    if (openMaterialFindings.length > 0)
        add("REPORT_MATERIAL_FINDINGS_OPEN", "BLOCKER", `${openMaterialFindings.length} material findings remain open.`, "Resolve, recalculate and close every material misstatement or non-conformity before sealing.");
    return {
        standardVersion: exports.REPORT_STANDARD_VERSION,
        status: issues.some((issue) => issue.severity === "BLOCKER") ? "FAIL" : "PASS",
        issues,
        evidenceCoverage: { requiredFields: evidenceRequirements.length, supportedFields, percentage: evidencePercentage },
        calculationIntegrity: { traceNodeCount: traceNodes.length, hashCoveragePercentage, allocationReconciled },
    };
}
//# sourceMappingURL=report-quality-contract.js.map