"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_TOP_LEVEL_COMPONENTS = void 0;
exports.buildVerifierPreparationPackage = buildVerifierPreparationPackage;
const crypto_1 = __importDefault(require("crypto"));
const jszip_1 = __importDefault(require("jszip"));
const jspdf_1 = require("jspdf");
const report_quality_contract_1 = require("./report-quality-contract");
exports.REQUIRED_TOP_LEVEL_COMPONENTS = [
    "01_Product_Scope_Assessment.pdf",
    "02_CN_Code_Reasoning.pdf",
    "03_Required_Data_Checklist.pdf",
    "04_Installation_Monitoring_Plan.pdf",
    "05_Production_Process_Map.pdf",
    "06_System_Boundary_Register.pdf",
    "07_Source_Stream_Register.csv",
    "08_Emission_Source_Register.csv",
    "09_Measurement_and_Meter_Register.csv",
    "10_Activity_Data_Ledger.csv",
    "11_Evidence_Register.csv",
    "12_Field_to_Evidence_Matrix.csv",
    "13_Methodology_Decision_Log.pdf",
    "14_Embedded_Emissions_Calculation_Annex.pdf",
    "15_Operator_Emissions_Report.pdf",
    "16_Operator_Summary_Emissions_Report.pdf",
    "17_Verification_Readiness_Assessment.pdf",
    "18_Misstatement_and_Non_Conformity_Register.csv",
    "19_Corrective_Action_Log.csv",
    "20_O3CI_Field_Mapping.csv",
    "21_Calculation_Trace.json",
    "22_Data_Integrity_Manifest.json",
    "23_Supporting_Evidence/",
];
function sha256(value) {
    return crypto_1.default.createHash("sha256").update(value).digest("hex");
}
function text(value, fallback = "Not provided") {
    if (value === null || value === undefined || value === "")
        return fallback;
    return String(value);
}
function datumText(datum, fallback = "Not provided") {
    return datum ? text(datum.value, fallback) : fallback;
}
function csvCell(value) {
    const normalized = value === null || value === undefined ? "" : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
}
function csv(headers, rows) {
    return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}
function sanitizeArchiveName(fileName) {
    const base = fileName.split(/[\\/]/).pop() || "evidence.bin";
    return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || "evidence.bin";
}
function evidenceById(caseData, evidenceId) {
    return evidenceId ? caseData.evidenceRegister.find((item) => item.evidenceId === evidenceId) : undefined;
}
function evidenceStatus(caseData, datum) {
    const evidence = evidenceById(caseData, datum === null || datum === void 0 ? void 0 : datum.evidenceId);
    if (!evidence)
        return "NO EVIDENCE";
    return `${evidence.reviewStatus} / ${evidence.supportStatus}`;
}
function methodologyText(caseData, topic, fallback = "Not documented") {
    const decision = caseData.methodologyDecisions.find((item) => item.topic === topic);
    if (!decision)
        return fallback;
    return `${decision.selectedMethod}: ${decision.reason}`;
}
function wrapText(doc, value, maxWidth) {
    return doc.splitTextToSize(value, maxWidth);
}
function renderPdf(params) {
    const doc = new jspdf_1.jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    const footer = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        doc.text(`CBAMValid · ${params.releaseId} · Page ${doc.getNumberOfPages()}`, margin, pageHeight - 7);
        doc.text("CONFIDENTIAL — OPERATOR/EXPORTER VERIFIER-PREPARATION DOSSIER", pageWidth - margin, pageHeight - 7, { align: "right" });
    };
    const addPage = () => {
        footer();
        doc.addPage();
        y = margin;
    };
    const ensureSpace = (height) => {
        if (y + height > pageHeight - 18)
            addPage();
    };
    doc.setFillColor(20, 37, 63);
    doc.rect(0, 0, pageWidth, 46, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(params.title, margin, 20);
    if (params.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(wrapText(doc, params.subtitle, contentWidth), margin, 28);
    }
    if (params.documentStatus) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(params.documentStatus, margin, 40);
    }
    y = 54;
    doc.setTextColor(25, 25, 25);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const metadataRows = [
        ["Release ID", params.releaseId],
        ["Case ID / version", `${params.caseId} / ${params.caseVersion}`],
        ["Generated", params.generatedAt],
        ["Ruleset / engine", `${params.ruleset} / ${params.engineVersion}`],
        ["Report standard", report_quality_contract_1.REPORT_STANDARD_VERSION],
    ];
    metadataRows.forEach(([key, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(key, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(wrapText(doc, value, contentWidth - 42), margin + 42, y);
        y += 5;
    });
    y += 3;
    for (const section of params.sections) {
        ensureSpace(16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20, 37, 63);
        doc.text(section.heading, margin, y);
        y += 7;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(8);
        for (const paragraph of section.paragraphs || []) {
            const lines = wrapText(doc, paragraph, contentWidth);
            ensureSpace(lines.length * 4 + 4);
            doc.setFont("helvetica", "normal");
            doc.text(lines, margin, y);
            y += lines.length * 4 + 3;
        }
        for (const [key, value] of section.keyValues || []) {
            const valueLines = wrapText(doc, value, contentWidth - 52);
            ensureSpace(Math.max(5, valueLines.length * 4));
            doc.setFont("helvetica", "bold");
            doc.text(key, margin, y);
            doc.setFont("helvetica", "normal");
            doc.text(valueLines, margin + 52, y);
            y += Math.max(5, valueLines.length * 4);
        }
        if (section.table) {
            const { headers, rows } = section.table;
            const widths = section.table.widths || headers.map(() => contentWidth / headers.length);
            const drawRow = (cells, header) => {
                const wrapped = cells.map((cell, index) => wrapText(doc, cell, widths[index] - 3));
                const rowHeight = Math.max(...wrapped.map((lines) => lines.length), 1) * 4 + 3;
                ensureSpace(rowHeight + (header ? 0 : 1));
                let x = margin;
                cells.forEach((_, index) => {
                    doc.setDrawColor(180, 188, 197);
                    if (header)
                        doc.setFillColor(232, 237, 243);
                    doc.rect(x, y - 3, widths[index], rowHeight, header ? "FD" : "D");
                    doc.setFont("helvetica", header ? "bold" : "normal");
                    doc.text(wrapped[index], x + 1.5, y);
                    x += widths[index];
                });
                y += rowHeight;
            };
            drawRow(headers, true);
            rows.forEach((row) => drawRow(row, false));
            y += 3;
        }
        y += 4;
    }
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 45, 35);
    doc.text("Important limitations", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    for (const limitation of report_quality_contract_1.REPORT_LIMITATIONS) {
        const lines = wrapText(doc, `• ${limitation}`, contentWidth);
        ensureSpace(lines.length * 4 + 2);
        doc.text(lines, margin, y);
        y += lines.length * 4 + 1;
    }
    footer();
    return Buffer.from(doc.output("arraybuffer"));
}
async function buildVerifierPreparationPackage(params) {
    const { releaseId, caseData, calculation, qualityControls, evidenceFiles } = params;
    const generatedAt = new Date().toISOString();
    const common = {
        releaseId,
        caseId: caseData.caseId || "UNASSIGNED",
        caseVersion: caseData.version,
        generatedAt,
        ruleset: calculation.ruleset,
        engineVersion: calculation.engineVersion,
    };
    const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData, calculation, qualityControls });
    if (reportQualityAssessment.status !== "PASS") {
        throw new Error(`REPORT_QUALITY_BLOCKED:${reportQualityAssessment.issues.map((issue) => issue.code).join(",")}`);
    }
    const zip = new jszip_1.default();
    const filesForManifest = [];
    const addFile = (filename, content, documentType) => {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
        zip.file(filename, buffer);
        filesForManifest.push({
            filename,
            documentType,
            version: caseData.version,
            releaseId,
            caseId: caseData.caseId || "UNASSIGNED",
            generatedAt,
            ruleset: calculation.ruleset,
            engineVersion: calculation.engineVersion,
            reportStandardVersion: report_quality_contract_1.REPORT_STANDARD_VERSION,
            sha256: sha256(buffer),
            sizeBytes: buffer.byteLength,
            confidentiality: "CONFIDENTIAL",
        });
    };
    const facts = {
        exporter: datumText(caseData.exporterIdentity.legalName),
        importer: datumText(caseData.importerIdentity.legalName),
        eori: datumText(caseData.importerIdentity.eoriNumber),
        installation: datumText(caseData.installation.name),
        country: datumText(caseData.installation.country),
        route: datumText(caseData.installation.productionRoute),
        boundaries: text(caseData.installation.systemBoundaries),
        year: datumText(caseData.reportingPeriod.year),
        period: datumText(caseData.reportingPeriod.quarter, "Annual"),
    };
    const goodsTable = {
        headers: ["CN code", "Sector", "Production t", "Allocation", "Embedded tCO2e", "Intensity tCO2e/t"],
        widths: [22, 30, 30, 24, 35, 37],
        rows: calculation.perGoodResults.map((result) => [result.cnCode, result.sector, result.productionVolume, result.allocationShare, result.allocatedEmbeddedEmissions, result.specificEmbeddedEmissions]),
    };
    const evidenceRows = caseData.evidenceRegister.map((evidence) => [
        evidence.evidenceId,
        evidence.documentType,
        evidence.fileName,
        evidence.issuer,
        evidence.issueDate,
        evidence.reviewStatus,
        evidence.supportStatus,
        evidence.fileHash,
        evidence.linkedInputs.join(";"),
        evidence.linkedCalculations.join(";"),
    ]);
    const materialDatums = [
        ["importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber],
        ["installation.name", caseData.installation.name],
        ["installation.country", caseData.installation.country],
        ["installation.productionRoute", caseData.installation.productionRoute],
        ["directEmissions", caseData.directEmissions],
        ["electricityConsumed", caseData.electricityConsumed],
        ["gridEmissionFactor", caseData.gridEmissionFactor],
    ];
    caseData.goods.forEach((good, index) => {
        materialDatums.push([`goods.${index}.cnCode`, good.cnCode], [`goods.${index}.productionVolume`, good.productionVolume], [`goods.${index}.allocationShare`, good.allocationShare]);
    });
    caseData.precursors.forEach((precursor, index) => {
        materialDatums.push([`precursors.${index}.quantity`, precursor.quantity], [`precursors.${index}.directEmissions`, precursor.directEmissions], [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions]);
    });
    const fieldRows = materialDatums.map(([path, datum]) => [path, datumText(datum), (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.sourceType) || "", (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || "", evidenceStatus(caseData, datum), (datum === null || datum === void 0 ? void 0 : datum.documentReference) || ""]);
    addFile("01_Product_Scope_Assessment.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Product Scope Assessment", subtitle: "CBAM goods and installation scope decision record", sections: [
            { heading: "Covered operator and installation", keyValues: [["Operator/exporter", facts.exporter], ["Installation", facts.installation], ["Country", facts.country], ["Production route", facts.route], ["System boundary", facts.boundaries]] },
            { heading: "Covered goods", table: goodsTable },
            { heading: "Scope basis", paragraphs: report_quality_contract_1.REPORT_BASIS.map((basis) => basis), keyValues: [["Precursor scope", methodologyText(caseData, "PRECURSOR_SCOPE")], ["Allocation method", methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "Single good receives full installation emissions" : "Not documented")], ["Excluded or non-associated flows", methodologyText(caseData, "NON_ASSOCIATED_FLOWS")]] },
        ] })), "PRODUCT_SCOPE_ASSESSMENT");
    addFile("02_CN_Code_Reasoning.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "CN Code Reasoning", subtitle: "Evidence-linked tariff classification record", sections: caseData.goods.map((good, index) => ({
            heading: `Good ${index + 1} — CN ${datumText(good.cnCode)}`,
            keyValues: [["Sector", good.sector], ["Description / shipment record", datumText(good.shipmentRecords)], ["Evidence ID", good.cnCode.evidenceId || "None"], ["Evidence status", evidenceStatus(caseData, good.cnCode)], ["Document reference", good.cnCode.documentReference || "None"]],
        })) })), "CN_CODE_REASONING");
    addFile("03_Required_Data_Checklist.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Required Data Checklist", subtitle: "Material field completion and evidence coverage", sections: [
            { heading: "Report quality status", keyValues: [["Standard", reportQualityAssessment.standardVersion], ["Status", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.supportedFields}/${reportQualityAssessment.evidenceCoverage.requiredFields} (${reportQualityAssessment.evidenceCoverage.percentage}%)`], ["Calculation hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"]] },
            { heading: "Material fields", table: { headers: ["Field", "Value", "Unit", "Source", "Evidence", "Review"], widths: [45, 28, 24, 25, 30, 26], rows: fieldRows.map((row) => [row[0], row[1], row[2], row[3], row[4], row[5]]) } },
        ] })), "REQUIRED_DATA_CHECKLIST");
    addFile("04_Installation_Monitoring_Plan.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Installation Monitoring Plan", subtitle: "Operator data collection, control and evidence plan", sections: [
            { heading: "Installation profile", keyValues: [["Installation", facts.installation], ["Country", facts.country], ["Route", facts.route], ["Reporting period", `${facts.year} / ${facts.period}`], ["System boundary", facts.boundaries]] },
            { heading: "Monitoring data points", table: { headers: ["Field", "Value", "Unit", "Measurement method", "Responsible person", "Evidence"], widths: [42, 27, 23, 36, 26, 24], rows: materialDatums.map(([path, datum]) => [path, datumText(datum), (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.measurementMethod) || "Not documented", (datum === null || datum === void 0 ? void 0 : datum.responsiblePerson) || "Not assigned", (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || "None"]) } },
            { heading: "Control principles", paragraphs: ["Maintain source records at installation level, preserve original units, document conversions, identify responsible personnel and retain hashes and immutable release references.", "Changes after sealing require a new release version; prior sealed versions remain immutable and independently verifiable by their manifest hashes."] },
        ] })), "INSTALLATION_MONITORING_PLAN");
    addFile("05_Production_Process_Map.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Production Process Map", subtitle: "Documented route, goods and precursor flow overview", sections: [
            { heading: "Route and boundary", keyValues: [["Route", facts.route], ["Boundary statement", facts.boundaries], ["Non-associated flows", methodologyText(caseData, "NON_ASSOCIATED_FLOWS")]] },
            { heading: "Goods flow", table: goodsTable },
            { heading: "Precursor flow", table: { headers: ["Precursor", "Origin", "Quantity", "Direct tCO2e", "Indirect tCO2e"], rows: caseData.precursors.map((item) => [datumText(item.name), datumText(item.countryOfOrigin), `${datumText(item.quantity)} ${item.quantity.canonicalUnit || item.quantity.unit || item.quantity.rawUnit || "t"}`, datumText(item.directEmissions), datumText(item.indirectEmissions)]) } },
        ] })), "PRODUCTION_PROCESS_MAP");
    addFile("06_System_Boundary_Register.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "System Boundary Register", subtitle: "Included and excluded installation activities and flows", sections: [
            { heading: "Boundary definition", paragraphs: [facts.boundaries] },
            { heading: "Associated goods", table: goodsTable },
            { heading: "Boundary governance", keyValues: [["Non-associated flows decision", methodologyText(caseData, "NON_ASSOCIATED_FLOWS")], ["Precursor scope decision", methodologyText(caseData, "PRECURSOR_SCOPE")]] },
        ] })), "SYSTEM_BOUNDARY_REGISTER");
    addFile("07_Source_Stream_Register.csv", csv(["source_stream", "value", "unit", "source_type", "evidence_id", "document_reference", "measurement_method", "responsible_person"], [["direct_emissions", datumText(caseData.directEmissions), caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", caseData.directEmissions.documentReference || "", caseData.directEmissions.measurementMethod || "", caseData.directEmissions.responsiblePerson || ""]]), "SOURCE_STREAM_REGISTER");
    addFile("08_Emission_Source_Register.csv", csv(["source", "value", "unit", "factor", "factor_unit", "calculated_emissions", "evidence_status"], [["installation_direct", datumText(caseData.directEmissions), caseData.directEmissions.canonicalUnit || "tCO2e", "", "", calculation.installationDirectEmissions, evidenceStatus(caseData, caseData.directEmissions)], ["purchased_electricity", datumText(caseData.electricityConsumed), caseData.electricityConsumed.canonicalUnit || "MWh", datumText(caseData.gridEmissionFactor), caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", calculation.electricityIndirectEmissions, `${evidenceStatus(caseData, caseData.electricityConsumed)}; ${evidenceStatus(caseData, caseData.gridEmissionFactor)}`]]), "EMISSION_SOURCE_REGISTER");
    addFile("09_Measurement_and_Meter_Register.csv", csv(["field", "measurement_method", "responsible_person", "raw_unit", "canonical_unit", "source_type", "evidence_id"], materialDatums.map(([path, datum]) => [path, (datum === null || datum === void 0 ? void 0 : datum.measurementMethod) || "", (datum === null || datum === void 0 ? void 0 : datum.responsiblePerson) || "", (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || "", (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.sourceType) || "", (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || ""])), "MEASUREMENT_AND_METER_REGISTER");
    addFile("10_Activity_Data_Ledger.csv", csv(["field", "entered_value", "raw_unit", "canonical_unit", "source_type", "reporting_period", "evidence_id", "document_reference", "confidence"], materialDatums.map(([path, datum]) => [path, datumText(datum), (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || "", (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.sourceType) || "", (datum === null || datum === void 0 ? void 0 : datum.reportingPeriod) || facts.year, (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || "", (datum === null || datum === void 0 ? void 0 : datum.documentReference) || "", (datum === null || datum === void 0 ? void 0 : datum.confidenceStatus) || ""])), "ACTIVITY_DATA_LEDGER");
    addFile("11_Evidence_Register.csv", csv(["evidence_id", "document_type", "file_name", "issuer", "issue_date", "review_status", "support_status", "sha256", "linked_inputs", "linked_calculations"], evidenceRows), "EVIDENCE_REGISTER");
    addFile("12_Field_to_Evidence_Matrix.csv", csv(["field", "entered_value", "unit", "source_type", "evidence_id", "review_and_support_status", "document_reference"], fieldRows), "FIELD_TO_EVIDENCE_MATRIX");
    addFile("13_Methodology_Decision_Log.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Methodology Decision Log", subtitle: "Versioned operator decisions, bases, alternatives and evidence references", sections: caseData.methodologyDecisions.map((decision) => ({
            heading: decision.topic,
            keyValues: [["Selected method", decision.selectedMethod], ["Reason", decision.reason], ["Legal or technical basis", decision.legalOrTechnicalBasis], ["Ruleset version", decision.rulesetVersion], ["Evidence IDs", decision.evidenceIds.join(", ") || "None"], ["Rejected alternative", decision.rejectedAlternativeReason || "Not recorded"], ["Internal review status", decision.reviewStatus]],
        })) })), "METHODOLOGY_DECISION_LOG");
    addFile("14_Embedded_Emissions_Calculation_Annex.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Embedded Emissions Calculation Annex", subtitle: "Deterministic formula trace, per-good allocation and reconciliation", sections: [
            { heading: "Installation totals", keyValues: [["Direct emissions including precursor direct", `${calculation.totalDirectEmissions} tCO2e`], ["Indirect emissions including precursor indirect", `${calculation.totalIndirectEmissions} tCO2e`], ["Total precursor emissions", `${calculation.totalPrecursorEmissions} tCO2e`], ["Total embedded emissions", `${calculation.totalEmbeddedEmissions} tCO2e`], ["Aggregate production volume", `${calculation.productionVolume} t`], ["Aggregate diagnostic intensity", `${calculation.specificEmbeddedEmissions} tCO2e/t`]] },
            { heading: "Per-good reportable results", table: goodsTable },
            { heading: "Allocation reconciliation", keyValues: [["Allocation share total", calculation.allocationShareTotal], ["Allocation reconciliation delta", calculation.allocationReconciliationDelta], ["Tolerance", "0.000001"], ["Method", methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "Single good receives 100%" : "Not documented")]] },
            { heading: "Ruleset and integrity", keyValues: [["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Calculation root hash", calculation.calculationRootHash], ["Rounding", "ROUND_HALF_UP, six decimal places, applied at final per-good intensity stage"]] },
            ...calculation.trace.map((trace) => ({ heading: trace.formulaId, keyValues: [["Inputs", JSON.stringify(trace.inputs)], ["Conversions", JSON.stringify(trace.conversions || {})], ["Intermediate calculations", JSON.stringify(trace.intermediateCalculations || {})], ["Output", `${trace.outputValue} ${trace.outputUnit}`], ["Assumptions", trace.assumptions.join("; ") || "None"], ["Warnings", trace.warnings.join("; ") || "None"], ["Node hash", trace.calculationHash]] })),
        ] })), "EMBEDDED_EMISSIONS_CALCULATION_ANNEX");
    addFile("15_Operator_Emissions_Report.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Operator Emissions Report", subtitle: "Annex VI-aligned operator dossier prepared for completion and challenge by an accredited verifier", documentStatus: "OPERATOR PREPARATION — VERIFIER COMPLETION REQUIRED", sections: [
            { heading: "1. Installation and operator identification", keyValues: [["Operator/exporter", facts.exporter], ["Installation", facts.installation], ["Country", facts.country], ["Production route", facts.route], ["System boundary", facts.boundaries]] },
            { heading: "2. Reporting period", keyValues: [["Year", facts.year], ["Quarter or period", facts.period], ["Release timestamp", generatedAt]] },
            { heading: "3. Goods quantities and embedded emissions", table: goodsTable },
            { heading: "4. Direct and indirect emissions", keyValues: [["Installation direct emissions", `${calculation.installationDirectEmissions} tCO2e`], ["Electricity indirect emissions", `${calculation.electricityIndirectEmissions} tCO2e`], ["Precursor direct emissions", `${calculation.precursorDirectEmissions} tCO2e`], ["Precursor indirect emissions", `${calculation.precursorIndirectEmissions} tCO2e`], ["Total embedded emissions", `${calculation.totalEmbeddedEmissions} tCO2e`]] },
            { heading: "5. Monitoring and methodology", keyValues: [["Precursor scope", methodologyText(caseData, "PRECURSOR_SCOPE")], ["Allocation method", methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "Single-good full allocation" : "Not documented")], ["Ruleset", calculation.ruleset], ["Engine", calculation.engineVersion]] },
            { heading: "6. Evidence and control", keyValues: [["Approved evidence records", String(caseData.evidenceRegister.filter((item) => item.reviewStatus === "APPROVED").length)], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Calculation trace nodes", String(reportQualityAssessment.calculationIntegrity.traceNodeCount)], ["Calculation hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Calculation root hash", calculation.calculationRootHash]] },
            { heading: "7. Operator responsibility statement", paragraphs: ["The operator/exporter remains responsible for the completeness, accuracy and lawful presentation of source data and evidence. This package preserves the declared basis and is designed to support, not replace, independent accredited verification."] },
        ] })), "OPERATOR_EMISSIONS_REPORT");
    addFile("16_Operator_Summary_Emissions_Report.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Operator Summary Emissions Report", subtitle: "Executive overview for importer, verifier and internal approval", documentStatus: "VERIFIER-PREPARATION SUMMARY — NOT A VERIFICATION OPINION", sections: [
            { heading: "Executive identity", keyValues: [["Operator/exporter", facts.exporter], ["Importer/declarant", facts.importer], ["EORI", facts.eori], ["Installation", facts.installation], ["Country", facts.country], ["Reporting period", `${facts.year} / ${facts.period}`]] },
            { heading: "Reportable goods results", table: goodsTable },
            { heading: "Readiness and integrity", keyValues: [["Report quality", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"], ["Calculation root hash", calculation.calculationRootHash], ["Package standard", reportQualityAssessment.standardVersion]] },
        ] })), "OPERATOR_SUMMARY_EMISSIONS_REPORT");
    addFile("17_Verification_Readiness_Assessment.pdf", renderPdf(Object.assign(Object.assign({}, common), { title: "Verification Readiness Assessment", subtitle: "Fail-closed quality review before independent verifier engagement", documentStatus: "INTERNAL READINESS ASSESSMENT", sections: [
            { heading: "Overall assessment", keyValues: [["Status", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.supportedFields}/${reportQualityAssessment.evidenceCoverage.requiredFields}`], ["Trace hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"]] },
            { heading: "Quality controls", table: { headers: ["Rule", "Control", "Status", "Message", "Remediation"], widths: [22, 35, 20, 58, 43], rows: qualityControls.map((item) => [item.ruleId, item.name, item.status, item.message || "", item.remediationCode || ""]) } },
            { heading: "Report-quality issues", table: { headers: ["Code", "Severity", "Issue", "Required remediation"], rows: reportQualityAssessment.issues.map((item) => [item.code, item.severity, item.message, item.remediation]) } },
        ] })), "VERIFICATION_READINESS_ASSESSMENT");
    addFile("18_Misstatement_and_Non_Conformity_Register.csv", csv(["finding_id", "issue_type", "requirement", "severity", "affected_result", "why_it_matters", "blocking", "resolution_status", "closure_note"], caseData.gapAssessment.map((gap) => [gap.gapId, gap.issueType || "", gap.requirement, gap.severity, gap.affectedResult || "", gap.whyItMatters, gap.isBlocking, gap.resolutionStatus, gap.closureNote || ""])), "MISSTATEMENT_AND_NON_CONFORMITY_REGISTER");
    addFile("19_Corrective_Action_Log.csv", csv(["finding_id", "suggested_action", "responsible_party", "deadline", "resolution_status", "resolution_evidence_ids", "closure_note"], caseData.gapAssessment.map((gap) => [gap.gapId, gap.suggestedAction, gap.responsibleParty || "", gap.deadline || "", gap.resolutionStatus, (gap.resolutionEvidenceIds || []).join(";"), gap.closureNote || ""])), "CORRECTIVE_ACTION_LOG");
    addFile("20_O3CI_Field_Mapping.csv", csv(["field_group", "mapped_field", "value", "unit", "evidence_id", "calculation_or_method_reference"], [
        ["installation", "operator_name", facts.exporter, "", caseData.exporterIdentity.legalName.evidenceId || "", "Operator evidence"],
        ["installation", "installation_name", facts.installation, "", caseData.installation.name.evidenceId || "", "Installation evidence"],
        ["installation", "country", facts.country, "", caseData.installation.country.evidenceId || "", "Installation evidence"],
        ["reporting_period", "year", facts.year, "", caseData.reportingPeriod.year.evidenceId || "", "Reporting period"],
        ...calculation.perGoodResults.map((result) => { var _a; return ["goods", `CN_${result.cnCode}`, result.specificEmbeddedEmissions, "tCO2e/t", ((_a = caseData.goods[result.goodIndex]) === null || _a === void 0 ? void 0 : _a.productionVolume.evidenceId) || "", result.traceCalculationId]; }),
        ["integrity", "calculation_root_hash", calculation.calculationRootHash, "sha256", "", "Calculation trace"],
    ]), "O3CI_FIELD_MAPPING");
    addFile("21_Calculation_Trace.json", JSON.stringify({
        releaseId,
        caseId: common.caseId,
        ruleset: calculation.ruleset,
        engineVersion: calculation.engineVersion,
        calculationRootHash: calculation.calculationRootHash,
        trace: calculation.trace,
        perGoodResults: calculation.perGoodResults,
        reconciliation: {
            allocationShareTotal: calculation.allocationShareTotal,
            allocationReconciliationDelta: calculation.allocationReconciliationDelta,
            totalEmbeddedEmissions: calculation.totalEmbeddedEmissions,
            allocatedEmbeddedEmissionsTotal: calculation.perGoodResults.reduce((sum, result) => sum + Number(result.allocatedEmbeddedEmissions), 0).toFixed(6),
        },
    }, null, 2), "CALCULATION_TRACE");
    const supportingFolder = zip.folder("23_Supporting_Evidence");
    if (!supportingFolder)
        throw new Error("EVIDENCE_FOLDER_CREATION_FAILED");
    for (const evidence of evidenceFiles) {
        if (sha256(evidence.buffer) !== evidence.sourceHash.toLowerCase()) {
            throw new Error(`EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
        }
        const archiveName = `${evidence.evidenceId}_${sanitizeArchiveName(evidence.fileName)}`;
        supportingFolder.file(archiveName, evidence.buffer);
        filesForManifest.push({
            filename: `23_Supporting_Evidence/${archiveName}`,
            documentType: "SUPPORTING_EVIDENCE",
            version: caseData.version,
            releaseId,
            caseId: common.caseId,
            generatedAt,
            ruleset: calculation.ruleset,
            engineVersion: calculation.engineVersion,
            reportStandardVersion: report_quality_contract_1.REPORT_STANDARD_VERSION,
            sha256: evidence.sourceHash.toLowerCase(),
            sizeBytes: evidence.buffer.byteLength,
            confidentiality: "CONFIDENTIAL",
        });
    }
    if (evidenceFiles.length === 0)
        supportingFolder.file("README.txt", "No evidence files were included. Sealing should have been blocked by the report-quality contract.");
    const manifestBase = {
        manifestVersion: "2.0",
        product: "CBAMValid Exporter Verification Preparation Pack",
        reportStandardVersion: report_quality_contract_1.REPORT_STANDARD_VERSION,
        releaseId,
        caseId: common.caseId,
        caseVersion: caseData.version,
        generatedAt,
        ruleset: calculation.ruleset,
        engineVersion: calculation.engineVersion,
        calculationRootHash: calculation.calculationRootHash,
        topLevelComponentCount: 23,
        regulatoryBasis: report_quality_contract_1.REPORT_BASIS,
        reportQualityAssessment,
        files: [],
        limitations: report_quality_contract_1.REPORT_LIMITATIONS,
    };
    const manifestDraft = Object.assign(Object.assign({}, manifestBase), { files: filesForManifest });
    const manifestContent = Buffer.from(JSON.stringify(manifestDraft, null, 2), "utf8");
    zip.file("22_Data_Integrity_Manifest.json", manifestContent);
    filesForManifest.push({
        filename: "22_Data_Integrity_Manifest.json",
        documentType: "DATA_INTEGRITY_MANIFEST",
        version: caseData.version,
        releaseId,
        caseId: common.caseId,
        generatedAt,
        ruleset: calculation.ruleset,
        engineVersion: calculation.engineVersion,
        reportStandardVersion: report_quality_contract_1.REPORT_STANDARD_VERSION,
        sha256: sha256(manifestContent),
        sizeBytes: manifestContent.byteLength,
        confidentiality: "CONFIDENTIAL",
    });
    const manifest = Object.assign(Object.assign({}, manifestBase), { files: filesForManifest });
    const manifestHash = sha256(JSON.stringify(manifest));
    const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
        platform: "UNIX",
        streamFiles: false,
    });
    return { zipBuffer, manifest, manifestHash };
}
//# sourceMappingURL=verifier-package-builder.js.map