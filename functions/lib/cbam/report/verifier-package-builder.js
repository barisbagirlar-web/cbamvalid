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
const package_manifest_1 = require("./package-manifest");
exports.REQUIRED_TOP_LEVEL_COMPONENTS = package_manifest_1.PACKAGE_COMPONENTS.map((c) => c.filename);
function sha256(content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    return crypto_1.default.createHash("sha256").update(buffer).digest("hex");
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
    doc.setProperties({
        author: "CBAMValid",
        creator: "CBAMValid Report Engine",
        title: params.title,
    });
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
                    doc.setTextColor(header ? 20 : 60, header ? 37 : 60, header ? 63 : 60);
                    let textY = y - 1 + (rowHeight - 3) / 2;
                    const lines = wrapped[index];
                    if (lines.length > 1) {
                        textY = y - 1 + (rowHeight - lines.length * 4) / 2;
                    }
                    lines.forEach((line, lineIndex) => {
                        doc.text(line, x + 1.5, textY + lineIndex * 4);
                    });
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
    const OriginalDate = global.Date;
    // @ts-ignore
    global.Date = class extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super(params.deterministicDate.getTime());
            }
            else {
                // @ts-ignore
                super(...args);
            }
        }
        static now() {
            return params.deterministicDate.getTime();
        }
    };
    try {
        const rawBuffer = Buffer.from(doc.output("arraybuffer"));
        const pdfString = rawBuffer.toString("binary").replace(/\/ID\s*\[\s*<[0-9a-fA-F]{32}>\s*<[0-9a-fA-F]{32}>\s*\]/g, "/ID [ <00000000000000000000000000000000> <00000000000000000000000000000000> ]");
        return Buffer.from(pdfString, "binary");
    }
    finally {
        global.Date = OriginalDate;
    }
}
const COMPONENT_PRODUCERS = {
    productScopeAssessment: (ctx) => {
        return {
            filename: "01_Product_Scope_Assessment.pdf",
            content: renderPdf({
                title: "Product Scope Assessment",
                subtitle: "CBAM goods and installation scope decision record",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Covered operator and installation", keyValues: [["Operator/exporter", ctx.facts.exporter], ["Installation", ctx.facts.installation], ["Country", ctx.facts.country], ["Production route", ctx.facts.route], ["System boundary", ctx.facts.boundaries]] },
                    { heading: "Covered goods", table: ctx.goodsTable },
                    { heading: "Scope basis", paragraphs: report_quality_contract_1.REPORT_BASIS.map((basis) => basis), keyValues: [["Precursor scope", methodologyText(ctx.caseData, "PRECURSOR_SCOPE")], ["Allocation method", methodologyText(ctx.caseData, "GOODS_EMISSIONS_ALLOCATION", ctx.caseData.goods.length === 1 ? "Single good receives full installation emissions" : "Not documented")], ["Excluded or non-associated flows", methodologyText(ctx.caseData, "NON_ASSOCIATED_FLOWS")]] },
                ],
            }),
            documentType: "PRODUCT_SCOPE_ASSESSMENT",
        };
    },
    cnCodeReasoning: (ctx) => {
        return {
            filename: "02_CN_Code_Reasoning.pdf",
            content: renderPdf({
                title: "CN Code Reasoning",
                subtitle: "Evidence-linked tariff classification record",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: ctx.caseData.goods.map((good, index) => ({
                    heading: `Good ${index + 1} — CN ${datumText(good.cnCode)}`,
                    keyValues: [["Sector", good.sector], ["Description / shipment record", datumText(good.shipmentRecords)], ["Evidence ID", good.cnCode.evidenceId || "None"], ["Evidence status", evidenceStatus(ctx.caseData, good.cnCode)], ["Document reference", good.cnCode.documentReference || "None"]],
                })),
            }),
            documentType: "CN_CODE_REASONING",
        };
    },
    requiredDataChecklist: (ctx) => {
        const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData: ctx.caseData, calculation: ctx.calculation, qualityControls: ctx.qualityControls });
        return {
            filename: "03_Required_Data_Checklist.pdf",
            content: renderPdf({
                title: "Required Data Checklist",
                subtitle: "Material field completion and evidence coverage",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Report quality status", keyValues: [["Standard", reportQualityAssessment.standardVersion], ["Status", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.supportedFields}/${reportQualityAssessment.evidenceCoverage.requiredFields} (${reportQualityAssessment.evidenceCoverage.percentage}%)`], ["Calculation hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"]] },
                    { heading: "Material fields", table: { headers: ["Field", "Value", "Unit", "Source", "Evidence", "Review"], widths: [45, 28, 24, 25, 30, 26], rows: ctx.fieldRows.map((row) => [row[0], row[1], row[2], row[3], row[4], row[5]]) } },
                ],
            }),
            documentType: "REQUIRED_DATA_CHECKLIST",
        };
    },
    installationMonitoringPlan: (ctx) => {
        return {
            filename: "04_Installation_Monitoring_Plan.pdf",
            content: renderPdf({
                title: "Installation Monitoring Plan",
                subtitle: "Operator data collection, control and evidence plan",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Installation profile", keyValues: [["Installation", ctx.facts.installation], ["Country", ctx.facts.country], ["Route", ctx.facts.route], ["Reporting period", `${ctx.facts.year} / ${ctx.facts.period}`], ["System boundary", ctx.facts.boundaries]] },
                    { heading: "Monitoring data points", table: { headers: ["Field", "Value", "Unit", "Measurement method", "Responsible person", "Evidence"], widths: [42, 27, 23, 36, 26, 24], rows: ctx.materialDatums.map(([path, datum]) => [path, datumText(datum), (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.measurementMethod) || "Not documented", (datum === null || datum === void 0 ? void 0 : datum.responsiblePerson) || "Not assigned", (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || "None"]) } },
                    { heading: "Control principles", paragraphs: ["Maintain source records at installation level, preserve original units, document conversions, identify responsible personnel and retain hashes and immutable release references.", "Changes after sealing require a new release version; prior sealed versions remain immutable and independently verifiable by their manifest hashes."] },
                ],
            }),
            documentType: "INSTALLATION_MONITORING_PLAN",
        };
    },
    productionProcessMap: (ctx) => {
        return {
            filename: "05_Production_Process_Map.pdf",
            content: renderPdf({
                title: "Production Process Map",
                subtitle: "Documented route, goods and precursor flow overview",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Route and boundary", keyValues: [["Route", ctx.facts.route], ["Boundary statement", ctx.facts.boundaries], ["Non-associated flows", methodologyText(ctx.caseData, "NON_ASSOCIATED_FLOWS")]] },
                    { heading: "Goods flow", table: ctx.goodsTable },
                    { heading: "Precursor flow", table: { headers: ["Precursor", "Origin", "Quantity", "Direct tCO2e", "Indirect tCO2e"], rows: ctx.caseData.precursors.map((item) => [datumText(item.name), datumText(item.countryOfOrigin), `${datumText(item.quantity)} ${item.quantity.canonicalUnit || item.quantity.unit || item.quantity.rawUnit || "t"}`, datumText(item.directEmissions), datumText(item.indirectEmissions)]) } },
                ],
            }),
            documentType: "PRODUCTION_PROCESS_MAP",
        };
    },
    systemBoundaryRegister: (ctx) => {
        return {
            filename: "06_System_Boundary_Register.pdf",
            content: renderPdf({
                title: "System Boundary Register",
                subtitle: "Included and excluded installation activities and flows",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Boundary definition", paragraphs: [ctx.facts.boundaries] },
                    { heading: "Associated goods", table: ctx.goodsTable },
                    { heading: "Boundary governance", keyValues: [["Non-associated flows decision", methodologyText(ctx.caseData, "NON_ASSOCIATED_FLOWS")], ["Precursor scope decision", methodologyText(ctx.caseData, "PRECURSOR_SCOPE")]] },
                ],
            }),
            documentType: "SYSTEM_BOUNDARY_REGISTER",
        };
    },
    sourceStreamRegister: (ctx) => {
        return {
            filename: "07_Source_Stream_Register.csv",
            content: csv(["source_stream", "value", "unit", "source_type", "evidence_id", "document_reference", "measurement_method", "responsible_person"], [["direct_emissions", datumText(ctx.caseData.directEmissions), ctx.caseData.directEmissions.canonicalUnit || "tCO2e", ctx.caseData.directEmissions.sourceType, ctx.caseData.directEmissions.evidenceId || "", ctx.caseData.directEmissions.documentReference || "", ctx.caseData.directEmissions.measurementMethod || "", ctx.caseData.directEmissions.responsiblePerson || ""]]),
            documentType: "SOURCE_STREAM_REGISTER",
        };
    },
    emissionSourceRegister: (ctx) => {
        return {
            filename: "08_Emission_Source_Register.csv",
            content: csv(["source", "value", "unit", "factor", "factor_unit", "calculated_emissions", "evidence_status"], [["installation_direct", datumText(ctx.caseData.directEmissions), ctx.caseData.directEmissions.canonicalUnit || "tCO2e", "", "", ctx.calculation.installationDirectEmissions, evidenceStatus(ctx.caseData, ctx.caseData.directEmissions)], ["purchased_electricity", datumText(ctx.caseData.electricityConsumed), ctx.caseData.electricityConsumed.canonicalUnit || "MWh", datumText(ctx.caseData.gridEmissionFactor), ctx.caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", ctx.calculation.electricityIndirectEmissions, `${evidenceStatus(ctx.caseData, ctx.caseData.electricityConsumed)}; ${evidenceStatus(ctx.caseData, ctx.caseData.gridEmissionFactor)}`]]),
            documentType: "EMISSION_SOURCE_REGISTER",
        };
    },
    measurementMeterRegister: (ctx) => {
        return {
            filename: "09_Measurement_and_Meter_Register.csv",
            content: csv(["field", "measurement_method", "responsible_person", "raw_unit", "canonical_unit", "source_type", "evidence_id"], ctx.materialDatums.map(([path, datum]) => [path, (datum === null || datum === void 0 ? void 0 : datum.measurementMethod) || "", (datum === null || datum === void 0 ? void 0 : datum.responsiblePerson) || "", (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || "", (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.sourceType) || "", (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || ""])),
            documentType: "MEASUREMENT_AND_METER_REGISTER",
        };
    },
    activityDataLedger: (ctx) => {
        return {
            filename: "10_Activity_Data_Ledger.csv",
            content: csv(["field", "entered_value", "raw_unit", "canonical_unit", "source_type", "reporting_period", "evidence_id", "document_reference", "confidence"], ctx.materialDatums.map(([path, datum]) => [path, datumText(datum), (datum === null || datum === void 0 ? void 0 : datum.rawUnit) || (datum === null || datum === void 0 ? void 0 : datum.unit) || "", (datum === null || datum === void 0 ? void 0 : datum.canonicalUnit) || "", (datum === null || datum === void 0 ? void 0 : datum.sourceType) || "", (datum === null || datum === void 0 ? void 0 : datum.reportingPeriod) || ctx.facts.year, (datum === null || datum === void 0 ? void 0 : datum.evidenceId) || "", (datum === null || datum === void 0 ? void 0 : datum.documentReference) || "", (datum === null || datum === void 0 ? void 0 : datum.confidenceStatus) || ""])),
            documentType: "ACTIVITY_DATA_LEDGER",
        };
    },
    evidenceRegister: (ctx) => {
        return {
            filename: "11_Evidence_Register.csv",
            content: csv(["evidence_id", "document_type", "file_name", "issuer", "issue_date", "review_status", "support_status", "sha256", "linked_inputs", "linked_calculations"], ctx.evidenceRows),
            documentType: "EVIDENCE_REGISTER",
        };
    },
    fieldToEvidenceMatrix: (ctx) => {
        return {
            filename: "12_Field_to_Evidence_Matrix.csv",
            content: csv(["field", "entered_value", "unit", "source_type", "evidence_id", "review_and_support_status", "document_reference"], ctx.fieldRows),
            documentType: "FIELD_TO_EVIDENCE_MATRIX",
        };
    },
    methodologyDecisionLog: (ctx) => {
        return {
            filename: "13_Methodology_Decision_Log.pdf",
            content: renderPdf({
                title: "Methodology Decision Log",
                subtitle: "Versioned operator decisions, bases, alternatives and evidence references",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: ctx.caseData.methodologyDecisions.map((decision) => ({
                    heading: decision.topic,
                    keyValues: [["Selected method", decision.selectedMethod], ["Reason", decision.reason], ["Legal or technical basis", decision.legalOrTechnicalBasis], ["Ruleset version", decision.rulesetVersion], ["Evidence IDs", decision.evidenceIds.join(", ") || "None"], ["Rejected alternative", decision.rejectedAlternativeReason || "Not recorded"], ["Internal review status", decision.reviewStatus]],
                })),
            }),
            documentType: "METHODOLOGY_DECISION_LOG",
        };
    },
    calculationAnnex: (ctx) => {
        return {
            filename: "14_Embedded_Emissions_Calculation_Annex.pdf",
            content: renderPdf({
                title: "Embedded Emissions Calculation Annex",
                subtitle: "Deterministic formula trace, per-good allocation and reconciliation",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Installation totals", keyValues: [["Direct emissions including precursor direct", `${ctx.calculation.totalDirectEmissions} tCO2e`], ["Indirect emissions including precursor indirect", `${ctx.calculation.totalIndirectEmissions} tCO2e`], ["Total precursor emissions", `${ctx.calculation.totalPrecursorEmissions} tCO2e`], ["Total embedded emissions", `${ctx.calculation.totalEmbeddedEmissions} tCO2e`], ["Aggregate production volume", `${ctx.calculation.productionVolume} t`], ["Aggregate diagnostic intensity", `${ctx.calculation.specificEmbeddedEmissions} tCO2e/t`]] },
                    { heading: "Per-good reportable results", table: ctx.goodsTable },
                    { heading: "Allocation reconciliation", keyValues: [["Allocation share total", ctx.calculation.allocationShareTotal], ["Allocation reconciliation delta", ctx.calculation.allocationReconciliationDelta], ["Tolerance", "0.000001"], ["Method", methodologyText(ctx.caseData, "GOODS_EMISSIONS_ALLOCATION", ctx.caseData.goods.length === 1 ? "Single good receives 100%" : "Not documented")]] },
                    { heading: "Ruleset and integrity", keyValues: [["Ruleset", ctx.calculation.ruleset], ["Engine version", ctx.calculation.engineVersion], ["Calculation root hash", ctx.calculation.calculationRootHash], ["Rounding", "ROUND_HALF_UP, six decimal places, applied at final per-good intensity stage"]] },
                    ...ctx.calculation.trace.map((trace) => ({ heading: trace.formulaId, keyValues: [["Inputs", JSON.stringify(trace.inputs)], ["Conversions", JSON.stringify(trace.conversions || {})], ["Intermediate calculations", JSON.stringify(trace.intermediateCalculations || {})], ["Output", `${trace.outputValue} ${trace.outputUnit}`], ["Assumptions", trace.assumptions.join("; ") || "None"], ["Warnings", trace.warnings.join("; ") || "None"], ["Node hash", trace.calculationHash]] })),
                ],
            }),
            documentType: "EMBEDDED_EMISSIONS_CALCULATION_ANNEX",
        };
    },
    operatorEmissionsReport: (ctx) => {
        const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData: ctx.caseData, calculation: ctx.calculation, qualityControls: ctx.qualityControls });
        return {
            filename: "15_Operator_Emissions_Report.pdf",
            content: renderPdf({
                title: "Operator Emissions Report",
                subtitle: "Annex VI-aligned operator dossier prepared for completion and challenge by an accredited verifier",
                documentStatus: "OPERATOR PREPARATION — VERIFIER COMPLETION REQUIRED",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "1. Installation and operator identification", keyValues: [["Operator/exporter", ctx.facts.exporter], ["Installation", ctx.facts.installation], ["Country", ctx.facts.country], ["Production route", ctx.facts.route], ["System boundary", ctx.facts.boundaries]] },
                    { heading: "2. Reporting period", keyValues: [["Year", ctx.facts.year], ["Quarter or period", ctx.facts.period], ["Release timestamp", ctx.generatedAt]] },
                    { heading: "3. Goods quantities and embedded emissions", table: ctx.goodsTable },
                    { heading: "4. Direct and indirect emissions", keyValues: [["Installation direct emissions", `${ctx.calculation.installationDirectEmissions} tCO2e`], ["Electricity indirect emissions", `${ctx.calculation.electricityIndirectEmissions} tCO2e`], ["Precursor direct emissions", `${ctx.calculation.precursorDirectEmissions} tCO2e`], ["Precursor indirect emissions", `${ctx.calculation.precursorIndirectEmissions} tCO2e`], ["Total embedded emissions", `${ctx.calculation.totalEmbeddedEmissions} tCO2e`]] },
                    { heading: "5. Monitoring and methodology", keyValues: [["Precursor scope", methodologyText(ctx.caseData, "PRECURSOR_SCOPE")], ["Allocation method", methodologyText(ctx.caseData, "GOODS_EMISSIONS_ALLOCATION", ctx.caseData.goods.length === 1 ? "Single-good full allocation" : "Not documented")], ["Ruleset", ctx.calculation.ruleset], ["Engine", ctx.calculation.engineVersion]] },
                    { heading: "6. Evidence and control", keyValues: [["Approved evidence records", String(ctx.caseData.evidenceRegister.filter((item) => item.reviewStatus === "APPROVED").length)], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Calculation trace nodes", String(reportQualityAssessment.calculationIntegrity.traceNodeCount)], ["Calculation hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Calculation root hash", ctx.calculation.calculationRootHash]] },
                    { heading: "7. Operator responsibility statement", paragraphs: ["The operator/exporter remains responsible for the completeness, accuracy and lawful presentation of source data and evidence. This package preserves the declared basis and is designed to support, not replace, independent accredited verification."] },
                ],
            }),
            documentType: "OPERATOR_EMISSIONS_REPORT",
        };
    },
    operatorSummaryEmissionsReport: (ctx) => {
        const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData: ctx.caseData, calculation: ctx.calculation, qualityControls: ctx.qualityControls });
        return {
            filename: "16_Operator_Summary_Emissions_Report.pdf",
            content: renderPdf({
                title: "Operator Summary Emissions Report",
                subtitle: "Executive overview for importer, verifier and internal approval",
                documentStatus: "VERIFIER-PREPARATION SUMMARY — NOT A VERIFICATION OPINION",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Executive identity", keyValues: [["Operator/exporter", ctx.facts.exporter], ["Importer/declarant", ctx.facts.importer], ["EORI", ctx.facts.eori], ["Installation", ctx.facts.installation], ["Country", ctx.facts.country], ["Reporting period", `${ctx.facts.year} / ${ctx.facts.period}`]] },
                    { heading: "Reportable goods results", table: ctx.goodsTable },
                    { heading: "Readiness and integrity", keyValues: [["Report quality", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"], ["Calculation root hash", ctx.calculation.calculationRootHash], ["Package standard", reportQualityAssessment.standardVersion]] },
                ],
            }),
            documentType: "OPERATOR_SUMMARY_EMISSIONS_REPORT",
        };
    },
    verificationReadinessAssessment: (ctx) => {
        const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData: ctx.caseData, calculation: ctx.calculation, qualityControls: ctx.qualityControls });
        return {
            filename: "17_Verification_Readiness_Assessment.pdf",
            content: renderPdf({
                title: "Verification Readiness Assessment",
                subtitle: "Fail-closed quality review before independent verifier engagement",
                documentStatus: "INTERNAL READINESS ASSESSMENT",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    { heading: "Overall assessment", keyValues: [["Status", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.supportedFields}/${reportQualityAssessment.evidenceCoverage.requiredFields}`], ["Trace hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "Yes" : "No"]] },
                    { heading: "Quality controls", table: { headers: ["Rule", "Control", "Status", "Message", "Remediation"], widths: [22, 35, 20, 58, 43], rows: ctx.qualityControls.map((item) => [item.ruleId, item.name, item.status, item.message || "", item.remediationCode || ""]) } },
                    { heading: "Report-quality issues", table: { headers: ["Code", "Severity", "Issue", "Required remediation"], rows: reportQualityAssessment.issues.map((item) => [item.code, item.severity, item.message, item.remediation]) } },
                ],
            }),
            documentType: "VERIFICATION_READINESS_ASSESSMENT",
        };
    },
    misstatementRegister: (ctx) => {
        const rows = ctx.caseData.gapAssessment.length === 0
            ? [["NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD"]]
            : ctx.caseData.gapAssessment.map((gap) => [gap.gapId, gap.issueType || "", gap.requirement, gap.severity, gap.affectedResult || "", gap.whyItMatters, gap.isBlocking, gap.resolutionStatus, gap.closureNote || ""]);
        return {
            filename: "18_Misstatement_and_Non_Conformity_Register.csv",
            content: csv(["finding_id", "issue_type", "requirement", "severity", "affected_result", "why_it_matters", "blocking", "resolution_status", "closure_note"], rows),
            documentType: "MISSTATEMENT_AND_NON_CONFORMITY_REGISTER",
        };
    },
    correctiveActionLog: (ctx) => {
        const rows = ctx.caseData.gapAssessment.length === 0
            ? [["NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD", "NO_RECORD"]]
            : ctx.caseData.gapAssessment.map((gap) => [gap.gapId, gap.suggestedAction, gap.responsibleParty || "", gap.deadline || "", gap.resolutionStatus, (gap.resolutionEvidenceIds || []).join(";"), gap.closureNote || ""]);
        return {
            filename: "19_Corrective_Action_Log.csv",
            content: csv(["finding_id", "suggested_action", "responsible_party", "deadline", "resolution_status", "resolution_evidence_ids", "closure_note"], rows),
            documentType: "CORRECTIVE_ACTION_LOG",
        };
    },
    o3ciFieldMapping: (ctx) => {
        return {
            filename: "20_O3CI_Field_Mapping.csv",
            content: csv(["field_group", "mapped_field", "value", "unit", "evidence_id", "calculation_or_method_reference"], [
                ["installation", "operator_name", ctx.facts.exporter, "", ctx.caseData.exporterIdentity.legalName.evidenceId || "", "Operator evidence"],
                ["installation", "installation_name", ctx.facts.installation, "", ctx.caseData.installation.name.evidenceId || "", "Installation evidence"],
                ["installation", "country", ctx.facts.country, "", ctx.caseData.installation.country.evidenceId || "", "Installation evidence"],
                ["reporting_period", "year", ctx.facts.year, "", ctx.caseData.reportingPeriod.year.evidenceId || "", "Reporting period"],
                ...ctx.calculation.perGoodResults.map((result) => { var _a; return ["goods", `CN_${result.cnCode}`, result.specificEmbeddedEmissions, "tCO2e/t", ((_a = ctx.caseData.goods[result.goodIndex]) === null || _a === void 0 ? void 0 : _a.productionVolume.evidenceId) || "", result.traceCalculationId]; }),
                ["integrity", "calculation_root_hash", ctx.calculation.calculationRootHash, "sha256", "", "Calculation trace"],
            ]),
            documentType: "O3CI_FIELD_MAPPING",
        };
    },
    calculationTrace: (ctx) => {
        return {
            filename: "21_Calculation_Trace.json",
            content: JSON.stringify({
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                ruleset: ctx.calculation.ruleset,
                engineVersion: ctx.calculation.engineVersion,
                calculationRootHash: ctx.calculation.calculationRootHash,
                trace: ctx.calculation.trace,
                perGoodResults: ctx.calculation.perGoodResults,
                reconciliation: {
                    allocationShareTotal: ctx.calculation.allocationShareTotal,
                    allocationReconciliationDelta: ctx.calculation.allocationReconciliationDelta,
                    totalEmbeddedEmissions: ctx.calculation.totalEmbeddedEmissions,
                    allocatedEmbeddedEmissionsTotal: ctx.calculation.perGoodResults.reduce((sum, result) => sum + Number(result.allocatedEmbeddedEmissions), 0).toFixed(6),
                },
            }, null, 2),
            documentType: "CALCULATION_TRACE",
        };
    },
    dataIntegrityManifest: () => {
        return {
            filename: "22_Data_Integrity_Manifest.json",
            content: "",
            documentType: "DATA_INTEGRITY_MANIFEST",
        };
    },
    supportingEvidence: async (ctx) => {
        const produced = [];
        const headers = ["evidence_id", "file_name", "sha256"];
        let csvRows;
        if (ctx.evidenceFiles.length === 0) {
            csvRows = [["NO_EVIDENCE", "NO_EVIDENCE", "NO_EVIDENCE"]];
        }
        else {
            csvRows = ctx.evidenceFiles.map(e => [
                e.evidenceId,
                e.fileName,
                e.sourceHash.toLowerCase()
            ]);
        }
        produced.push({
            filename: "23_Supporting_Evidence/_index.csv",
            content: csv(headers, csvRows),
            documentType: "SUPPORTING_EVIDENCE_INDEX"
        });
        for (const evidence of ctx.evidenceFiles) {
            if (sha256(evidence.buffer) !== evidence.sourceHash.toLowerCase()) {
                throw new Error(`EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
            }
            const archiveName = `${evidence.evidenceId}_${sanitizeArchiveName(evidence.fileName)}`;
            produced.push({
                filename: `23_Supporting_Evidence/${archiveName}`,
                content: evidence.buffer,
                documentType: "SUPPORTING_EVIDENCE"
            });
        }
        return produced;
    },
    executiveVerificationReadinessSummary: (ctx) => {
        const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData: ctx.caseData, calculation: ctx.calculation, qualityControls: ctx.qualityControls });
        return {
            filename: "24_Executive_Verification_Readiness_Summary.pdf",
            content: renderPdf({
                title: "Executive Verification Readiness Summary",
                subtitle: "Dossier readiness status, findings, and verifier guidance summary",
                documentStatus: "EXECUTIVE SUMMARY",
                releaseId: ctx.releaseId,
                caseId: ctx.caseData.caseId || "UNASSIGNED",
                caseVersion: ctx.caseData.version,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.calculation.ruleset,
                engineVersion: ctx.calculation.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    {
                        heading: "1. Dossier & Operator Profile",
                        keyValues: [
                            ["Exporter / Operator", ctx.facts.exporter],
                            ["Installation Name", ctx.facts.installation],
                            ["Reporting Period", `${ctx.facts.year} Q${ctx.facts.period}`],
                            ["Readiness Status", reportQualityAssessment.status],
                            ["Evidence Coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`],
                            ["Ruleset Version", ctx.calculation.ruleset],
                            ["Engine Version", ctx.calculation.engineVersion]
                        ]
                    },
                    {
                        heading: "2. Embedded Emissions & Allocation Integrity",
                        keyValues: [
                            ["Calculation Root Hash", ctx.calculation.calculationRootHash],
                            ["Allocation Share Total", ctx.calculation.allocationShareTotal],
                            ["Allocation Reconciliation Delta", ctx.calculation.allocationReconciliationDelta],
                            ["Total Embedded Emissions", `${ctx.calculation.totalEmbeddedEmissions} tCO2e`]
                        ]
                    },
                    {
                        heading: "3. Unresolved Material Findings",
                        paragraphs: ctx.caseData.gapAssessment.length === 0
                            ? ["No material gaps or non-conformities are currently logged."]
                            : ctx.caseData.gapAssessment.map(gap => `• [${gap.gapId}] (${gap.severity}) ${gap.requirement} - Status: ${gap.resolutionStatus}`)
                    },
                    {
                        heading: "4. Verifier Action Priorities",
                        paragraphs: [
                            "1. Reconcile specific embedded emissions intensity values against physical monitoring systems.",
                            "2. Verify source stream registers and meter calibration certificates in Component 09.",
                            "3. Review the methodology decisions log in Component 13 against Annex IV rules."
                        ]
                    },
                    {
                        heading: "5. Important Disclaimer",
                        paragraphs: ["This readiness summary is an internal tool to prepare for accredited verification and does not constitute a formal, accredited verification opinion under EU regulations."]
                    }
                ]
            }),
            documentType: "EXECUTIVE_VERIFICATION_READINESS_SUMMARY"
        };
    },
    perGoodEmbeddedEmissionsSchedule: (ctx) => {
        // Per-Good Embedded Emissions Schedule
        const headers = [
            "good_index",
            "cn_code",
            "sector",
            "product_description",
            "production_volume",
            "production_unit",
            "allocation_share",
            "allocated_direct_emissions",
            "allocated_indirect_emissions",
            "allocated_precursor_emissions",
            "allocated_total_embedded_emissions",
            "specific_embedded_emissions",
            "specific_emissions_unit",
            "calculation_trace_id",
            "evidence_ids",
            "ruleset",
            "engine_version"
        ];
        const rows = ctx.calculation.perGoodResults.map((result) => {
            const good = ctx.caseData.goods[result.goodIndex];
            return [
                result.goodIndex,
                result.cnCode,
                result.sector,
                good ? datumText(good.shipmentRecords, "Steel Good") : "Steel Good",
                result.productionVolume,
                result.productionUnit,
                result.allocationShare,
                result.allocatedDirectEmissions,
                result.allocatedIndirectEmissions,
                result.allocatedPrecursorEmissions,
                result.allocatedEmbeddedEmissions,
                result.specificEmbeddedEmissions,
                "tCO2e/t",
                result.traceCalculationId,
                good ? (good.cnCode.evidenceId || "None") : "None",
                ctx.calculation.ruleset,
                ctx.calculation.engineVersion
            ];
        });
        return {
            filename: "25_Per_Good_Embedded_Emissions_Schedule.csv",
            content: csv(headers, rows),
            documentType: "PER_GOOD_EMBEDDED_EMISSIONS_SCHEDULE"
        };
    },
    carbonPricePaidSchedule: (ctx) => {
        // Carbon Price Paid Schedule
        const headers = [
            "jurisdiction",
            "instrument_type",
            "payment_reference",
            "payment_date",
            "currency",
            "gross_amount",
            "eligible_amount",
            "exchange_rate",
            "converted_eur_amount",
            "covered_emissions",
            "deduction_method",
            "evidence_id",
            "evidence_review_status",
            "calculation_trace_id"
        ];
        let rows;
        if (ctx.caseData.carbonPriceRecords.length === 0) {
            rows = [headers.map(() => "NO_ELIGIBLE_CARBON_PRICE_PAID_DECLARED")];
        }
        else {
            rows = ctx.caseData.carbonPriceRecords.map((record) => {
                const evidenceId = record.proofOfPaymentEvidenceId || "None";
                const evidence = evidenceId !== "None" ? ctx.caseData.evidenceRegister.find(e => e.evidenceId === evidenceId) : undefined;
                const reviewStatus = evidence ? evidence.reviewStatus : "N/A";
                return [
                    record.legislationReference,
                    "Carbon Tax / ETS",
                    record.id,
                    record.paymentPeriod,
                    record.currency,
                    record.amountPaid,
                    record.eligibleCertificateReduction,
                    "1.0",
                    record.amountPaid,
                    record.applicableEmissions,
                    record.conversionMethod || "DIRECT_DEDUCTION",
                    evidenceId,
                    reviewStatus,
                    "calc_carbon_price_deduction"
                ];
            });
        }
        return {
            filename: "26_Carbon_Price_Paid_Schedule.csv",
            content: csv(headers, rows),
            documentType: "CARBON_PRICE_PAID_SCHEDULE"
        };
    },
    readMeAndVerifierNavigationGuide: (ctx) => {
        // Read-Me and Verifier Navigation Guide
        const indexRows = package_manifest_1.PACKAGE_COMPONENTS.map(c => [c.filename.slice(0, 2), c.filename.slice(3), c.kind]);
        return {
            filename: "27_Read_Me_and_Verifier_Navigation_Guide.pdf",
            content: renderPdf({
                title: "Read-Me and Verifier Navigation Guide",
                subtitle: "A guide to the 27 components and recommended review paths",
                releaseId: ctx.releaseId,
                caseId: ctx.common.caseId,
                caseVersion: ctx.common.caseVersion,
                generatedAt: ctx.generatedAt,
                ruleset: ctx.common.ruleset,
                engineVersion: ctx.common.engineVersion,
                deterministicDate: ctx.deterministicDate,
                sections: [
                    {
                        heading: "1. Package Purpose",
                        paragraphs: [
                            "This preparation pack is an structured dossier aligning with Annex V and VI of EU Regulation 2023/1773. It provides an exhaustive trace from raw monitoring inputs to verified calculation outputs.",
                            "Accredited verifiers should review this data chronologically to trace process maps, activity data ledgers, field-to-evidence matrix, and calculation outputs."
                        ]
                    },
                    {
                        heading: "2. The 27-Component Index",
                        table: {
                            headers: ["Seq", "Component Filename", "Type"],
                            widths: [20, 130, 28],
                            rows: indexRows
                        }
                    },
                    {
                        heading: "3. Recommended Review Order",
                        paragraphs: [
                            "1. Process & Scope Validation: Start with Components 01, 02, 05, and 06 to understand boundaries.",
                            "2. Data Parity & Quality: Review Components 03, 11, 12, and 17 to check completeness and gaps.",
                            "3. Formula Auditing: Validate calculations with Components 14, 21, and 25.",
                            "4. Verification Statement Sign-off: Use final components 24 and 27 as references."
                        ]
                    },
                    {
                        heading: "4. Immutable Versioning & Limits",
                        paragraphs: [
                            "Sealed packages represent a single point-in-time calculation state. Any changes after sealing require generating a new release version with unique cryptographic manifests.",
                            "For inquiries or technical escalation, contact the operator or CBAMValid support."
                        ]
                    }
                ]
            }),
            documentType: "README_AND_VERIFIER_NAVIGATION_GUIDE"
        };
    }
};
function getPeriodEnd(caseData) {
    const year = Number(caseData.reportingPeriod.year.value || "2026");
    const quarter = String(caseData.reportingPeriod.quarter.value || "").trim().toUpperCase();
    let month = 11;
    let day = 31;
    if (quarter === "Q1" || quarter === "1") {
        month = 2;
        day = 31;
    }
    else if (quarter === "Q2" || quarter === "2") {
        month = 5;
        day = 30;
    }
    else if (quarter === "Q3" || quarter === "3") {
        month = 8;
        day = 30;
    }
    const date = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return { date, isoString: date.toISOString() };
}
async function buildVerifierPreparationPackage(params) {
    const { releaseId, caseData, calculation, qualityControls, evidenceFiles } = params;
    const reportQualityAssessment = (0, report_quality_contract_1.assessVerifierGradeReport)({ caseData, calculation, qualityControls });
    if (reportQualityAssessment.status !== "PASS") {
        throw new Error(`REPORT_QUALITY_BLOCKED:${reportQualityAssessment.issues.map((issue) => issue.code).join(",")}`);
    }
    const periodEnd = getPeriodEnd(caseData);
    const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : undefined;
    const deterministicDate = sourceDateEpoch || periodEnd.date;
    const generatedAt = deterministicDate.toISOString();
    const common = {
        releaseId,
        caseId: caseData.caseId || "UNASSIGNED",
        caseVersion: caseData.version,
        generatedAt,
        ruleset: calculation.ruleset,
        engineVersion: calculation.engineVersion,
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
    const context = {
        releaseId,
        caseData,
        calculation,
        qualityControls,
        evidenceFiles,
        generatedAt,
        deterministicDate,
        facts,
        goodsTable,
        evidenceRows,
        fieldRows,
        materialDatums,
        common,
    };
    const zip = new jszip_1.default();
    const filesForManifest = [];
    const addFile = (filename, content, documentType) => {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
        zip.file(filename, buffer, { date: deterministicDate });
        filesForManifest.push({
            filename,
            documentType,
            version: caseData.version,
            releaseId,
            caseId: common.caseId,
            generatedAt,
            ruleset: calculation.ruleset,
            engineVersion: calculation.engineVersion,
            reportStandardVersion: report_quality_contract_1.REPORT_STANDARD_VERSION,
            sha256: sha256(buffer),
            sizeBytes: buffer.byteLength,
            confidentiality: "CONFIDENTIAL",
        });
    };
    // Iterate in registry order
    for (const comp of package_manifest_1.PACKAGE_COMPONENTS) {
        const producer = COMPONENT_PRODUCERS[comp.id];
        if (!producer) {
            throw new Error(`PACKAGE_COMPONENT_PRODUCER_MISSING:${comp.id}`);
        }
        // Manifest file is generated at the end
        if (comp.id === "dataIntegrityManifest") {
            continue;
        }
        const produced = await producer(context);
        if (Array.isArray(produced)) {
            for (const item of produced) {
                if (item.content.length === 0) {
                    throw new Error(`PACKAGE_COMPONENT_EMPTY:${item.filename}`);
                }
                addFile(item.filename, item.content, item.documentType);
            }
        }
        else {
            if (produced.filename !== comp.filename) {
                throw new Error(`PACKAGE_COMPONENT_FILENAME_MISMATCH: Expected ${comp.filename}, got ${produced.filename}`);
            }
            if (produced.content.length === 0) {
                throw new Error(`PACKAGE_COMPONENT_EMPTY:${produced.filename}`);
            }
            // Check kind
            if (comp.kind === "pdf" && !produced.filename.endsWith(".pdf")) {
                throw new Error(`PACKAGE_COMPONENT_KIND_MISMATCH:${produced.filename}`);
            }
            if (comp.kind === "csv" && !produced.filename.endsWith(".csv")) {
                throw new Error(`PACKAGE_COMPONENT_KIND_MISMATCH:${produced.filename}`);
            }
            if (comp.kind === "json" && !produced.filename.endsWith(".json")) {
                throw new Error(`PACKAGE_COMPONENT_KIND_MISMATCH:${produced.filename}`);
            }
            addFile(produced.filename, produced.content, produced.documentType);
        }
    }
    // Generate manifest
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
        topLevelComponentCount: package_manifest_1.PACKAGE_COMPONENTS.length,
        regulatoryBasis: report_quality_contract_1.REPORT_BASIS,
        reportQualityAssessment,
        files: [],
        limitations: report_quality_contract_1.REPORT_LIMITATIONS,
    };
    const manifestDraft = Object.assign(Object.assign({}, manifestBase), { files: filesForManifest });
    const manifestContent = Buffer.from(JSON.stringify(manifestDraft, null, 2), "utf8");
    zip.file("22_Data_Integrity_Manifest.json", manifestContent, { date: deterministicDate });
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
    // Order files for deterministic manifest hash
    manifest.files.sort((a, b) => a.filename.localeCompare(b.filename));
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