"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQualityControls = runQualityControls;
const decimal_js_1 = require("decimal.js");
const ALLOCATION_TOLERANCE = new decimal_js_1.Decimal("0.000001");
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
function finiteNonNegative(value) {
    const parsed = decimal(value);
    return parsed !== null && parsed.gte(0);
}
function finitePositive(value) {
    const parsed = decimal(value);
    return parsed !== null && parsed.gt(0);
}
function unitOf(datum, fallback) {
    return datum.canonicalUnit || datum.unit || datum.rawUnit || fallback;
}
function supportedEvidence(caseData, path, datum) {
    if (!datum.evidenceId)
        return false;
    const record = caseData.evidenceRegister.find((item) => item.evidenceId === datum.evidenceId);
    return Boolean(record &&
        record.linkedInputs.includes(path) &&
        record.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) &&
        /^[a-f0-9]{64}$/i.test(record.fileHash) &&
        record.sizeBytes > 0 &&
        record.reviewStatus === "APPROVED" &&
        (record.supportStatus === "SUPPORTED" || record.supportStatus === "PARTIALLY_SUPPORTED"));
}
function hasAcceptedMethodologyDecision(caseData, topic) {
    return caseData.methodologyDecisions.some((decision) => decision.topic === topic &&
        decision.reviewStatus === "ACCEPTED" &&
        decision.reason.trim().length > 0 &&
        decision.legalOrTechnicalBasis.trim().length > 0 &&
        decision.rulesetVersion.trim().length > 0 &&
        decision.evidenceIds.every((evidenceId) => caseData.evidenceRegister.some((evidence) => evidence.evidenceId === evidenceId)));
}
function runQualityControls(caseData) {
    const results = [];
    const add = (ruleId, name, status, message, remediationCode) => results.push({ ruleId, name, status, message, remediationCode });
    const exporterName = String(caseData.exporterIdentity.legalName.value || "").trim();
    const installationName = String(caseData.installation.name.value || "").trim();
    const installationCountry = String(caseData.installation.country.value || "").trim();
    const productionRoute = String(caseData.installation.productionRoute.value || "").trim();
    const systemBoundaries = String(caseData.installation.systemBoundaries || "").trim();
    if (!exporterName || !installationName || !installationCountry || !productionRoute || !systemBoundaries) {
        add("QC_00", "Operator, installation and system-boundary identity", "BLOCKER", "Exporter/operator name, installation name, country, production route and system-boundary statement are all required.", "REM_COMPLETE_INSTALLATION_IDENTITY");
    }
    else {
        add("QC_00", "Operator, installation and system-boundary identity", "PASS");
    }
    const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
    if (!eori) {
        add("QC_01", "EORI presence", "BLOCKER", "EORI number is missing.", "REM_PROVIDE_EORI");
    }
    else if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) {
        add("QC_01", "EORI format", "BLOCKER", "EORI must contain a two-letter country prefix followed by 6–15 alphanumeric characters.", "REM_CORRECT_EORI_FORMAT");
    }
    else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) {
        add("QC_01", "EORI evidence", "BLOCKER", "EORI is not linked to an internally approved supporting evidence record.", "REM_LINK_AND_APPROVE_EORI_EVIDENCE");
    }
    else {
        add("QC_01", "EORI format and evidence", "PASS");
    }
    const year = Number(caseData.reportingPeriod.year.value);
    if (!Number.isInteger(year) || year < 2026 || year > 2100) {
        add("QC_02", "Definitive-period reporting year", "BLOCKER", "Enter a valid definitive-period reporting year from 2026 onward.", "REM_CORRECT_REPORTING_YEAR");
    }
    else {
        add("QC_02", "Definitive-period reporting year", "PASS");
    }
    if (caseData.goods.length === 0) {
        add("QC_03", "Goods definition", "BLOCKER", "No goods are defined.", "REM_ADD_GOOD");
    }
    else {
        caseData.goods.forEach((good, index) => {
            const cnPath = `goods.${index}.cnCode`;
            const productionPath = `goods.${index}.productionVolume`;
            const cnCode = String(good.cnCode.value || "");
            if (!/^\d{8}$/.test(cnCode)) {
                add(`QC_03_${index + 1}`, `Good ${index + 1} CN code`, "BLOCKER", "CN code must contain exactly eight digits.", "REM_CORRECT_CN_CODE");
            }
            else if (!supportedEvidence(caseData, cnPath, good.cnCode)) {
                add(`QC_03_${index + 1}`, `Good ${index + 1} CN code evidence`, "BLOCKER", "CN code is not linked to internally approved customs-classification evidence.", "REM_LINK_AND_APPROVE_CN_EVIDENCE");
            }
            else {
                add(`QC_03_${index + 1}`, `Good ${index + 1} CN code and evidence`, "PASS");
            }
            if (!finitePositive(good.productionVolume.value)) {
                add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity`, "BLOCKER", "Production quantity must be finite and greater than zero.", "REM_CORRECT_PRODUCTION_QUANTITY");
            }
            else if (!["t", "kg", "metric_tonne"].includes(unitOf(good.productionVolume, "t"))) {
                add(`QC_04_${index + 1}`, `Good ${index + 1} production unit`, "BLOCKER", "Production quantity must use tonnes or kilograms and be convertible to tonnes.", "REM_CORRECT_PRODUCTION_UNIT");
            }
            else if (!supportedEvidence(caseData, productionPath, good.productionVolume)) {
                add(`QC_04_${index + 1}`, `Good ${index + 1} production evidence`, "BLOCKER", "Production quantity is not linked to internally approved production evidence.", "REM_LINK_AND_APPROVE_PRODUCTION_EVIDENCE");
            }
            else {
                add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity and evidence`, "PASS");
            }
            if (!["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector)) {
                add(`QC_05_${index + 1}`, `Good ${index + 1} sector mapping`, "BLOCKER", "The selected sector is unsupported by the active calculation engine.", "REM_SELECT_SUPPORTED_SECTOR");
            }
            else {
                add(`QC_05_${index + 1}`, `Good ${index + 1} sector mapping`, "PASS");
            }
        });
    }
    if (caseData.goods.length <= 1) {
        add("QC_05A", "Goods emissions allocation", caseData.goods.length === 1 ? "PASS" : "NOT_APPLICABLE");
    }
    else {
        const shares = caseData.goods.map((good, index) => { var _a; return ({
            index,
            share: decimal((_a = good.allocationShare) === null || _a === void 0 ? void 0 : _a.value),
            datum: good.allocationShare,
        }); });
        const invalid = shares.some(({ share }) => share === null || share.lte(0) || share.gt(1));
        if (invalid) {
            add("QC_05A", "Goods emissions allocation shares", "BLOCKER", "Every good requires a positive decimal allocation share not exceeding 1.", "REM_ENTER_GOOD_ALLOCATION_SHARES");
        }
        else {
            const sum = shares.reduce((total, item) => total.plus(item.share), new decimal_js_1.Decimal(0));
            if (sum.minus(1).abs().gt(ALLOCATION_TOLERANCE)) {
                add("QC_05A", "Goods emissions allocation reconciliation", "BLOCKER", `Allocation shares sum to ${sum.toString()} instead of 1.`, "REM_RECONCILE_GOOD_ALLOCATION_SHARES");
            }
            else if (shares.some(({ index, datum }) => !datum || !supportedEvidence(caseData, `goods.${index}.allocationShare`, datum))) {
                add("QC_05A", "Goods emissions allocation evidence", "BLOCKER", "Every allocation share must be linked to internally approved allocation evidence.", "REM_LINK_AND_APPROVE_ALLOCATION_EVIDENCE");
            }
            else if (!hasAcceptedMethodologyDecision(caseData, "GOODS_EMISSIONS_ALLOCATION")) {
                add("QC_05A", "Goods emissions allocation method", "BLOCKER", "The allocation method is not documented as an accepted methodology decision.", "REM_DOCUMENT_ALLOCATION_METHOD");
            }
            else {
                add("QC_05A", "Goods emissions allocation and reconciliation", "PASS");
            }
        }
    }
    const materialInputs = [
        { ruleId: "QC_06", path: "directEmissions", name: "Direct emissions", datum: caseData.directEmissions, units: ["tCO2e"], fallback: "tCO2e" },
        { ruleId: "QC_07", path: "electricityConsumed", name: "Electricity consumed", datum: caseData.electricityConsumed, units: ["MWh"], fallback: "MWh" },
        { ruleId: "QC_08", path: "gridEmissionFactor", name: "Grid emission factor", datum: caseData.gridEmissionFactor, units: ["tCO2e/MWh"], fallback: "tCO2e/MWh" },
    ];
    for (const item of materialInputs) {
        if (!finiteNonNegative(item.datum.value)) {
            add(item.ruleId, item.name, "BLOCKER", `${item.name} must be a finite, non-negative number.`, `REM_CORRECT_${item.ruleId}`);
        }
        else if (!item.units.includes(unitOf(item.datum, item.fallback))) {
            add(item.ruleId, `${item.name} unit`, "BLOCKER", `${item.name} uses an unsupported unit.`, `REM_CORRECT_${item.ruleId}_UNIT`);
        }
        else if (!supportedEvidence(caseData, item.path, item.datum)) {
            add(item.ruleId, `${item.name} evidence`, "BLOCKER", `${item.name} is not linked to internally approved supporting evidence.`, `REM_LINK_AND_APPROVE_${item.ruleId}_EVIDENCE`);
        }
        else if (item.datum.sourceType === "ESTIMATED" && !hasAcceptedMethodologyDecision(caseData, `ESTIMATE:${item.path}`)) {
            add(item.ruleId, `${item.name} source method`, "BLOCKER", `${item.name} uses an estimate without an accepted methodology decision.`, `REM_DOCUMENT_${item.ruleId}_METHOD`);
        }
        else {
            add(item.ruleId, `${item.name} value, unit and evidence`, "PASS");
        }
    }
    if (caseData.precursors.length === 0) {
        if (hasAcceptedMethodologyDecision(caseData, "PRECURSOR_SCOPE")) {
            add("QC_09", "Precursor scope decision", "PASS");
        }
        else {
            add("QC_09", "Precursor scope decision", "BLOCKER", "No precursor records are declared and no accepted precursor-scope decision is recorded.", "REM_CONFIRM_PRECURSOR_SCOPE");
        }
    }
    else {
        caseData.precursors.forEach((precursor, index) => {
            const paths = [
                [`precursors.${index}.quantity`, precursor.quantity, "quantity", ["t", "kg", "metric_tonne"]],
                [`precursors.${index}.directEmissions`, precursor.directEmissions, "direct emissions", ["tCO2e"]],
                [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions, "indirect emissions", ["tCO2e"]],
            ];
            for (const [path, datum, label, units] of paths) {
                if (!finiteNonNegative(datum.value) || (label === "quantity" && !finitePositive(datum.value))) {
                    add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label}`, "BLOCKER", `Precursor ${label} must be finite and non-negative${label === "quantity" ? " and greater than zero" : ""}.`, "REM_CORRECT_PRECURSOR_DATA");
                }
                else if (!units.includes(unitOf(datum, label === "quantity" ? "t" : "tCO2e"))) {
                    add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label} unit`, "BLOCKER", `Precursor ${label} uses an unsupported unit.`, "REM_CORRECT_PRECURSOR_UNIT");
                }
                else if (!supportedEvidence(caseData, path, datum)) {
                    add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label} evidence`, "BLOCKER", `Precursor ${label} is not linked to internally approved evidence.`, "REM_LINK_AND_APPROVE_PRECURSOR_EVIDENCE");
                }
                else {
                    add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label}`, "PASS");
                }
            }
        });
    }
    const seenHashes = new Set();
    let duplicateHash = false;
    let invalidEvidenceMetadata = false;
    for (const evidence of caseData.evidenceRegister) {
        const normalizedHash = evidence.fileHash.toLowerCase();
        if (seenHashes.has(normalizedHash))
            duplicateHash = true;
        seenHashes.add(normalizedHash);
        if (!/^[a-f0-9]{64}$/.test(normalizedHash) ||
            evidence.sizeBytes <= 0 ||
            !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) ||
            evidence.linkedInputs.length === 0 ||
            evidence.reviewStatus !== "APPROVED" ||
            !["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(evidence.supportStatus)) {
            invalidEvidenceMetadata = true;
        }
    }
    if (caseData.evidenceRegister.length === 0) {
        add("QC_10", "Evidence register", "BLOCKER", "Evidence register is empty.", "REM_UPLOAD_EVIDENCE");
    }
    else if (invalidEvidenceMetadata) {
        add("QC_10", "Evidence metadata and internal approval", "BLOCKER", "One or more evidence records have invalid hash, size, ownership path, linkage, support status or internal review status.", "REM_REVIEW_AND_APPROVE_EVIDENCE");
    }
    else if (duplicateHash) {
        add("QC_10", "Duplicate source documents", "BLOCKER", "Duplicate evidence hashes were detected.", "REM_REMOVE_DUPLICATE_EVIDENCE");
    }
    else {
        add("QC_10", "Evidence register integrity", "PASS");
    }
    if (caseData.carbonPriceRecords.length === 0) {
        add("QC_11", "Carbon-price adjustment evidence", "NOT_APPLICABLE");
    }
    else {
        caseData.carbonPriceRecords.forEach((record, index) => {
            const claimed = Number(record.amountPaid) > 0 || Number(record.eligibleCertificateReduction) > 0;
            if (!claimed) {
                add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1}`, "NOT_APPLICABLE");
                return;
            }
            const proof = record.proofOfPaymentEvidenceId
                ? caseData.evidenceRegister.find((item) => item.evidenceId === record.proofOfPaymentEvidenceId)
                : undefined;
            if (!proof || proof.reviewStatus !== "APPROVED" || !["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(proof.supportStatus)) {
                add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} payment proof`, "BLOCKER", "The claimed adjustment does not reference internally approved supporting evidence.", "REM_LINK_AND_APPROVE_CARBON_PRICE_PROOF");
            }
            else if (!record.legislationReference.trim()) {
                add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} legal basis`, "BLOCKER", "The claimed adjustment is missing its scheme or legislation reference.", "REM_ADD_CARBON_PRICE_BASIS");
            }
            else {
                add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} evidence`, "PASS");
            }
        });
    }
    const openRecordedFindings = caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED");
    if (openRecordedFindings.some((gap) => gap.isBlocking || ["BLOCKER", "CRITICAL", "MAJOR"].includes(gap.severity))) {
        add("QC_12", "Recorded material findings", "BLOCKER", "The dossier contains unresolved blocking, critical or major findings.", "REM_RESOLVE_MATERIAL_FINDINGS");
    }
    else if (openRecordedFindings.length > 0) {
        add("QC_12", "Recorded open findings", "WARNING", "The dossier contains unresolved minor or advisory findings.", "REM_REVIEW_OPEN_FINDINGS");
    }
    else {
        add("QC_12", "Recorded findings", "PASS");
    }
    const invalidDecisions = caseData.methodologyDecisions.filter((decision) => decision.reviewStatus !== "ACCEPTED" ||
        !decision.reason.trim() ||
        !decision.legalOrTechnicalBasis.trim() ||
        !decision.rulesetVersion.trim() ||
        decision.evidenceIds.some((id) => !caseData.evidenceRegister.some((evidence) => evidence.evidenceId === id)));
    if (invalidDecisions.length > 0) {
        add("QC_13", "Methodology decision governance", "BLOCKER", `${invalidDecisions.length} methodology decisions are incomplete, unaccepted or reference missing evidence.`, "REM_COMPLETE_METHODOLOGY_DECISIONS");
    }
    else {
        add("QC_13", "Methodology decision governance", "PASS");
    }
    return results;
}
//# sourceMappingURL=quality-controls.js.map