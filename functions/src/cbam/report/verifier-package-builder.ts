import crypto from "crypto";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { AuditReadyCase, EvidenceRecord, InputDatum } from "../schema";
import { DossierCalculationResult } from "../calculator";
import { QualityControlResult } from "../validation/quality-controls";
import {
  assessVerifierGradeReport,
  REPORT_BASIS,
  REPORT_LIMITATIONS,
  REPORT_STANDARD_VERSION,
  ReportQualityAssessment,
} from "./report-quality-contract";

export const REQUIRED_TOP_LEVEL_COMPONENTS = [
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
] as const;

export type PackageEvidenceFile = {
  evidenceId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  sourceHash: string;
};

type ManifestFile = {
  filename: string;
  documentType: string;
  version: number;
  releaseId: string;
  caseId: string;
  generatedAt: string;
  ruleset: string;
  engineVersion: string;
  reportStandardVersion: string;
  sha256: string;
  sizeBytes: number;
  confidentiality: "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";
};

export type DataIntegrityManifest = {
  manifestVersion: "2.0";
  product: "CBAMValid Exporter Verification Preparation Pack";
  reportStandardVersion: string;
  releaseId: string;
  caseId: string;
  caseVersion: number;
  generatedAt: string;
  ruleset: string;
  engineVersion: string;
  calculationRootHash: string;
  topLevelComponentCount: 23;
  regulatoryBasis: readonly string[];
  reportQualityAssessment: ReportQualityAssessment;
  files: ManifestFile[];
  limitations: readonly string[];
};

type PdfSection = {
  heading: string;
  paragraphs?: string[];
  keyValues?: Array<[string, string]>;
  table?: { headers: string[]; rows: string[][]; widths?: number[] };
};

function sha256(value: Buffer | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function text(value: unknown, fallback = "Not provided"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function datumText(datum: InputDatum | undefined, fallback = "Not provided"): string {
  return datum ? text(datum.value, fallback) : fallback;
}

function csvCell(value: unknown): string {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}

function sanitizeArchiveName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || "evidence.bin";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || "evidence.bin";
}

function evidenceById(caseData: AuditReadyCase, evidenceId?: string): EvidenceRecord | undefined {
  return evidenceId ? caseData.evidenceRegister.find((item) => item.evidenceId === evidenceId) : undefined;
}

function evidenceStatus(caseData: AuditReadyCase, datum: InputDatum | undefined): string {
  const evidence = evidenceById(caseData, datum?.evidenceId);
  if (!evidence) return "UNSUPPORTED";
  return `${evidence.reviewStatus}/${evidence.supportStatus}`;
}

function renderPdf(params: {
  title: string;
  subtitle?: string;
  releaseId: string;
  caseId: string;
  generatedAt: string;
  caseVersion: number;
  confidentiality?: "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";
  documentStatus?: string;
  sections: PdfSection[];
}): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const confidentiality = params.confidentiality || "CONFIDENTIAL";
  let y = 16;

  const resetText = () => {
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
  };

  const addPageHeader = () => {
    resetText();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CBAMValid", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.text(params.title, pageWidth - margin, 9, { align: "right" });
    doc.setDrawColor(190, 190, 190);
    doc.line(margin, 11, pageWidth - margin, 11);
    y = 17;
  };

  const ensureSpace = (required = 16) => {
    if (y + required > pageHeight - 17) {
      doc.addPage();
      addPageHeader();
    }
  };

  const writeParagraph = (paragraph: string, fontSize = 8.5) => {
    resetText();
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(paragraph, contentWidth) as string[];
    ensureSpace(wrapped.length * 4.2 + 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2 + 2;
  };

  const drawKeyValues = (pairs: Array<[string, string]>) => {
    for (const [label, value] of pairs) {
      const labelWidth = 52;
      const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth - 4) as string[];
      const rowHeight = Math.max(7, valueLines.length * 4 + 3);
      ensureSpace(rowHeight);
      doc.setFillColor(245, 246, 248);
      doc.rect(margin, y, labelWidth, rowHeight, "F");
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, y, contentWidth, rowHeight);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(label, margin + 2, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.text(valueLines, margin + labelWidth + 2, y + 4.5);
      y += rowHeight;
    }
    y += 3;
  };

  const drawTable = (table: NonNullable<PdfSection["table"]>) => {
    const widths = table.widths && table.widths.length === table.headers.length
      ? table.widths
      : table.headers.map(() => contentWidth / table.headers.length);
    const drawRow = (cells: string[], header: boolean) => {
      const wrapped = cells.map((cell, index) => doc.splitTextToSize(cell, widths[index] - 4) as string[]);
      const rowHeight = Math.max(7, ...wrapped.map((lines) => lines.length * 3.6 + 3));
      ensureSpace(rowHeight + 1);
      let x = margin;
      cells.forEach((_, index) => {
        if (header) doc.setFillColor(232, 235, 239);
        else if (Math.floor(y) % 2 === 0) doc.setFillColor(249, 249, 249);
        doc.rect(x, y, widths[index], rowHeight, header ? "FD" : "D");
        doc.setFont("helvetica", header ? "bold" : "normal");
        doc.setFontSize(header ? 7 : 6.8);
        doc.text(wrapped[index], x + 2, y + 4.2);
        x += widths[index];
      });
      y += rowHeight;
    };
    drawRow(table.headers, true);
    table.rows.forEach((row) => drawRow(row, false));
    y += 4;
  };

  doc.setFillColor(24, 39, 75);
  doc.rect(0, 0, pageWidth, 52, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(params.title, margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (params.subtitle) doc.text(doc.splitTextToSize(params.subtitle, contentWidth), margin, 32);
  doc.setFontSize(7.5);
  doc.text(`Report standard: ${REPORT_STANDARD_VERSION}`, margin, 45);
  doc.text(`Status: ${params.documentStatus || "Operator-prepared verifier package"}`, pageWidth - margin, 45, { align: "right" });

  y = 61;
  drawKeyValues([
    ["Release ID", params.releaseId],
    ["Case ID", params.caseId],
    ["Case version", String(params.caseVersion)],
    ["Generated", params.generatedAt],
    ["Confidentiality", confidentiality],
    ["Document boundary", "Prepared for independent verification; not an accredited verification opinion"],
  ]);

  for (const section of params.sections) {
    ensureSpace(14);
    doc.setTextColor(24, 39, 75);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.heading, margin, y);
    y += 6;
    doc.setDrawColor(24, 39, 75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    section.paragraphs?.forEach((paragraph) => writeParagraph(paragraph));
    if (section.keyValues) drawKeyValues(section.keyValues);
    if (section.table) drawTable(section.table);
    y += 2;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    resetText();
    doc.setFontSize(6.5);
    doc.setTextColor(95, 95, 95);
    doc.line(margin, 281, pageWidth - margin, 281);
    doc.text(`${confidentiality} · ${REPORT_STANDARD_VERSION} · ${params.releaseId}`, margin, 286);
    doc.text("Not an accredited verification opinion, customs decision or EU acceptance guarantee", pageWidth / 2, 290, { align: "center" });
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, 286, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function caseFacts(caseData: AuditReadyCase) {
  return {
    exporter: datumText(caseData.exporterIdentity.legalName),
    importer: datumText(caseData.importerIdentity.legalName),
    eori: datumText(caseData.importerIdentity.eoriNumber),
    year: datumText(caseData.reportingPeriod.year),
    period: datumText(caseData.reportingPeriod.quarter),
    installation: datumText(caseData.installation.name),
    country: datumText(caseData.installation.country),
    route: datumText(caseData.installation.productionRoute),
    boundaries: text(caseData.installation.systemBoundaries),
    cnCodes: caseData.goods.map((good) => datumText(good.cnCode)).join(", ") || "None",
  };
}

function qualityStatus(qc: QualityControlResult[]): "READY" | "READY_WITH_WARNINGS" | "BLOCKED" {
  if (qc.some((item) => item.status === "BLOCKER")) return "BLOCKED";
  if (qc.some((item) => item.status === "WARNING")) return "READY_WITH_WARNINGS";
  return "READY";
}

function methodologyText(caseData: AuditReadyCase, topic: string, fallback: string): string {
  const decision = caseData.methodologyDecisions.find((item) => item.topic === topic);
  if (!decision) return fallback;
  return `${decision.selectedMethod}. ${decision.reason} Basis: ${decision.legalOrTechnicalBasis}`;
}

function goodRows(caseData: AuditReadyCase, calculation: DossierCalculationResult): string[][] {
  return calculation.goods.map((good) => [
    String(good.goodIndex),
    good.cnCode,
    good.sector.replace(/_/g, " "),
    `${good.productionVolume} ${good.productionUnit}`,
    good.allocationShare,
    `${good.allocatedEmbeddedEmissions} tCO2e`,
    `${good.specificEmbeddedEmissions} tCO2e/t`,
    evidenceStatus(caseData, caseData.goods[good.goodIndex - 1]?.productionVolume),
  ]);
}

export async function buildVerifierPreparationPackage(params: {
  releaseId: string;
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  qualityControls: QualityControlResult[];
  evidenceFiles: PackageEvidenceFile[];
}): Promise<{ zipBuffer: Buffer; manifest: DataIntegrityManifest; manifestHash: string }> {
  const { releaseId, caseData, calculation, qualityControls, evidenceFiles } = params;
  const caseId = caseData.caseId || "UNASSIGNED";
  const generatedAt = new Date().toISOString();
  const facts = caseFacts(caseData);
  const reportQualityAssessment = assessVerifierGradeReport({ caseData, calculation, qualityControls });

  if (reportQualityAssessment.status !== "PASS") {
    throw new Error(`VERIFIER_GRADE_REPORT_BLOCKED:${reportQualityAssessment.issues.map((issue) => issue.code).join(",")}`);
  }
  if (caseData.evidenceRegister.length === 0) throw new Error("VERIFIER_PACKAGE_EVIDENCE_REQUIRED");
  if (evidenceFiles.length !== caseData.evidenceRegister.length) throw new Error("VERIFIER_PACKAGE_EVIDENCE_FILE_COUNT_MISMATCH");
  if (calculation.goods.length !== caseData.goods.length) throw new Error("VERIFIER_PACKAGE_GOOD_RESULT_COUNT_MISMATCH");

  const zip = new JSZip();
  const manifestFiles: ManifestFile[] = [];
  const addFile = (
    filename: string,
    content: Buffer | string,
    documentType: string,
    confidentiality: ManifestFile["confidentiality"] = "CONFIDENTIAL"
  ) => {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    zip.file(filename, buffer);
    manifestFiles.push({
      filename,
      documentType,
      version: caseData.version,
      releaseId,
      caseId,
      generatedAt,
      ruleset: calculation.ruleset,
      engineVersion: calculation.engineVersion,
      reportStandardVersion: REPORT_STANDARD_VERSION,
      sha256: sha256(buffer),
      sizeBytes: buffer.byteLength,
      confidentiality,
    });
  };

  const common = { releaseId, caseId, generatedAt, caseVersion: caseData.version };
  const goodsTable = {
    headers: ["#", "CN", "Sector", "Production", "Share", "Allocated emissions", "Specific emissions", "Evidence"],
    rows: goodRows(caseData, calculation),
    widths: [8, 20, 25, 25, 16, 30, 30, 26],
  };

  addFile("01_Product_Scope_Assessment.pdf", renderPdf({
    ...common,
    title: "Product Scope Assessment",
    subtitle: "Installation-year and goods boundary for the CBAM verifier-preparation dossier",
    sections: [
      { heading: "Scope conclusion", paragraphs: [`This release covers one installation (${facts.installation}), reporting period ${facts.year} ${facts.period}, and the goods listed below. The scope is evidence-linked and immutable for this release.`] },
      { heading: "Commercial and reporting boundary", keyValues: [["Exporter/operator", facts.exporter], ["Importer/declarant", facts.importer], ["EORI", facts.eori], ["Installation", facts.installation], ["Country", facts.country], ["Production route", facts.route], ["System boundary", facts.boundaries]] },
      { heading: "Covered goods", table: goodsTable },
      { heading: "Regulatory basis", paragraphs: [...REPORT_BASIS] },
      { heading: "Use limitations", paragraphs: [...REPORT_LIMITATIONS] },
    ],
  }), "PRODUCT_SCOPE_ASSESSMENT");

  addFile("02_CN_Code_Reasoning.pdf", renderPdf({
    ...common,
    title: "CN Code Reasoning",
    subtitle: "Evidence-linked customs classification record for each covered good",
    sections: caseData.goods.flatMap((good, index) => [
      { heading: `Good ${index + 1} — ${datumText(good.cnCode)}`, keyValues: [["Sector", good.sector.replace(/_/g, " ")], ["Production quantity", `${datumText(good.productionVolume)} ${good.productionVolume.canonicalUnit || good.productionVolume.unit || "t"}`], ["CN evidence", good.cnCode.evidenceId || "Not linked"], ["Evidence status", evidenceStatus(caseData, good.cnCode)], ["Classification responsibility", "Operator/declarant remains responsible for confirming the CN code with competent customs advisers or authorities"]] },
    ]),
  }), "CN_CODE_REASONING");

  addFile("03_Required_Data_Checklist.pdf", renderPdf({
    ...common,
    title: "Required Data Checklist",
    subtitle: "Completeness and evidence coverage against the sealed report contract",
    sections: [
      { heading: "Completion dashboard", keyValues: [["Report-quality status", reportQualityAssessment.status], ["Required material fields", String(reportQualityAssessment.evidenceCoverage.requiredFields)], ["Supported material fields", String(reportQualityAssessment.evidenceCoverage.supportedFields)], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Calculation trace nodes", String(reportQualityAssessment.calculationIntegrity.traceNodeCount)], ["Trace hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "YES" : "NO"]] },
      { heading: "Required records", table: { headers: ["Record", "Status"], rows: [["Operator/exporter identity", facts.exporter !== "Not provided" ? "COMPLETE" : "MISSING"], ["Importer/declarant and EORI", facts.eori !== "Not provided" ? "COMPLETE" : "MISSING"], ["Installation and production route", facts.installation !== "Not provided" ? "COMPLETE" : "MISSING"], ["System boundary", facts.boundaries !== "Not provided" ? "COMPLETE" : "MISSING"], ["Goods and production quantities", caseData.goods.length > 0 ? "COMPLETE" : "MISSING"], ["Evidence register", `${caseData.evidenceRegister.length} records`], ["Methodology decisions", `${caseData.methodologyDecisions.length} records`]], widths: [105, 75] } },
    ],
  }), "REQUIRED_DATA_CHECKLIST");

  addFile("04_Installation_Monitoring_Plan.pdf", renderPdf({
    ...common,
    title: "Installation Monitoring Plan",
    subtitle: "Operator-prepared monitoring architecture and control expectations",
    sections: [
      { heading: "Installation identification", keyValues: [["Installation", facts.installation], ["Country", facts.country], ["Operator/exporter", facts.exporter], ["Reporting period", `${facts.year} ${facts.period}`], ["Production route", facts.route]] },
      { heading: "Monitoring boundary", paragraphs: [facts.boundaries] },
      { heading: "Material data controls", table: { headers: ["Field", "Value", "Unit", "Source type", "Evidence", "Review"], rows: [["Direct emissions", datumText(caseData.directEmissions), caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", evidenceStatus(caseData, caseData.directEmissions)], ["Electricity consumed", datumText(caseData.electricityConsumed), caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "", evidenceStatus(caseData, caseData.electricityConsumed)], ["Grid emission factor", datumText(caseData.gridEmissionFactor), caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "", evidenceStatus(caseData, caseData.gridEmissionFactor)]], widths: [32, 24, 25, 25, 38, 36] } },
      { heading: "Governance", paragraphs: ["Source records are hashed with SHA-256, linked to material fields and preserved in the sealed evidence folder.", "Changes to data, evidence, allocation or methodology require a new immutable release version.", "The operator should retain the source records and external verifier report for the legally applicable retention period."] },
    ],
  }), "INSTALLATION_MONITORING_PLAN");

  addFile("05_Production_Process_Map.pdf", renderPdf({
    ...common,
    title: "Production Process Map",
    subtitle: "Textual process and precursor flow map for independent review",
    sections: [
      { heading: "Process route", keyValues: [["Installation", facts.installation], ["Production route", facts.route], ["System boundary", facts.boundaries]] },
      { heading: "Goods output", table: goodsTable },
      { heading: "Precursor chain", table: { headers: ["#", "Precursor", "Origin", "Quantity", "Direct", "Indirect"], rows: caseData.precursors.length > 0 ? caseData.precursors.map((precursor, index) => [String(index + 1), datumText(precursor.name), datumText(precursor.countryOfOrigin), `${datumText(precursor.quantity)} ${precursor.quantity.canonicalUnit || "t"}`, `${datumText(precursor.directEmissions)} tCO2e`, `${datumText(precursor.indirectEmissions)} tCO2e`]) : [["—", "No precursor records; scope decision documented", "", "", "", ""]], widths: [10, 45, 25, 35, 32, 32] } },
    ],
  }), "PRODUCTION_PROCESS_MAP");

  addFile("06_System_Boundary_Register.pdf", renderPdf({
    ...common,
    title: "System Boundary Register",
    subtitle: "Included, excluded and allocation-boundary record",
    sections: [
      { heading: "Defined boundary", paragraphs: [facts.boundaries] },
      { heading: "Emissions totals", keyValues: [["Installation direct emissions", `${datumText(caseData.directEmissions)} tCO2e`], ["Electricity consumed", `${datumText(caseData.electricityConsumed)} MWh`], ["Grid factor", `${datumText(caseData.gridEmissionFactor)} tCO2e/MWh`], ["Calculated indirect emissions", `${calculation.totalIndirectEmissions} tCO2e`], ["Total precursor emissions", `${calculation.totalPrecursorEmissions} tCO2e`], ["Total embedded emissions", `${calculation.totalEmbeddedEmissions} tCO2e`]] },
      { heading: "Allocation method", paragraphs: [methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "Single-good installation: 100% of installation emissions are attributed to the only covered good." : "Allocation decision missing.")] },
      { heading: "Non-associated flows", paragraphs: [methodologyText(caseData, "NON_ASSOCIATED_FLOWS", "No separate non-associated goods, emissions or energy flows were declared. The external verifier must challenge this statement against the installation boundary and records.")] },
    ],
  }), "SYSTEM_BOUNDARY_REGISTER");

  addFile("07_Source_Stream_Register.csv", csv(
    ["source_stream_id", "description", "value", "unit", "source_type", "evidence_id", "review_status", "support_status"],
    [
      ["DIRECT_EMISSIONS", "Installation direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", evidenceById(caseData, caseData.directEmissions.evidenceId)?.reviewStatus || "", evidenceById(caseData, caseData.directEmissions.evidenceId)?.supportStatus || ""],
      ["ELECTRICITY", "Electricity consumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "", evidenceById(caseData, caseData.electricityConsumed.evidenceId)?.reviewStatus || "", evidenceById(caseData, caseData.electricityConsumed.evidenceId)?.supportStatus || ""],
      ["GRID_FACTOR", "Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "", evidenceById(caseData, caseData.gridEmissionFactor.evidenceId)?.reviewStatus || "", evidenceById(caseData, caseData.gridEmissionFactor.evidenceId)?.supportStatus || ""],
      ...caseData.precursors.flatMap((precursor, index) => [
        [`PRECURSOR_${index + 1}_QTY`, `${datumText(precursor.name)} quantity`, precursor.quantity.value, precursor.quantity.canonicalUnit || "t", precursor.quantity.sourceType, precursor.quantity.evidenceId || "", evidenceById(caseData, precursor.quantity.evidenceId)?.reviewStatus || "", evidenceById(caseData, precursor.quantity.evidenceId)?.supportStatus || ""],
        [`PRECURSOR_${index + 1}_DIRECT`, `${datumText(precursor.name)} direct emissions`, precursor.directEmissions.value, precursor.directEmissions.canonicalUnit || "tCO2e", precursor.directEmissions.sourceType, precursor.directEmissions.evidenceId || "", evidenceById(caseData, precursor.directEmissions.evidenceId)?.reviewStatus || "", evidenceById(caseData, precursor.directEmissions.evidenceId)?.supportStatus || ""],
        [`PRECURSOR_${index + 1}_INDIRECT`, `${datumText(precursor.name)} indirect emissions`, precursor.indirectEmissions.value, precursor.indirectEmissions.canonicalUnit || "tCO2e", precursor.indirectEmissions.sourceType, precursor.indirectEmissions.evidenceId || "", evidenceById(caseData, precursor.indirectEmissions.evidenceId)?.reviewStatus || "", evidenceById(caseData, precursor.indirectEmissions.evidenceId)?.supportStatus || ""],
      ]),
    ]
  ), "SOURCE_STREAM_REGISTER");

  addFile("08_Emission_Source_Register.csv", csv(
    ["source_id", "category", "direct_tco2e", "indirect_tco2e", "evidence_ids"],
    [
      ["INSTALLATION", "Installation", caseData.directEmissions.value, calculation.totalIndirectEmissions, [caseData.directEmissions.evidenceId, caseData.electricityConsumed.evidenceId, caseData.gridEmissionFactor.evidenceId].filter(Boolean).join(";")],
      ...caseData.precursors.map((precursor, index) => [`PRECURSOR_${index + 1}`, datumText(precursor.name), precursor.directEmissions.value, precursor.indirectEmissions.value, [precursor.directEmissions.evidenceId, precursor.indirectEmissions.evidenceId].filter(Boolean).join(";")]),
    ]
  ), "EMISSION_SOURCE_REGISTER");

  addFile("09_Measurement_and_Meter_Register.csv", csv(
    ["field", "measurement_method", "responsible_person", "confidence_status", "document_reference", "evidence_id", "review_status"],
    [
      ["directEmissions", caseData.directEmissions.measurementMethod || "", caseData.directEmissions.responsiblePerson || "", caseData.directEmissions.confidenceStatus, caseData.directEmissions.documentReference || "", caseData.directEmissions.evidenceId || "", evidenceById(caseData, caseData.directEmissions.evidenceId)?.reviewStatus || ""],
      ["electricityConsumed", caseData.electricityConsumed.measurementMethod || "", caseData.electricityConsumed.responsiblePerson || "", caseData.electricityConsumed.confidenceStatus, caseData.electricityConsumed.documentReference || "", caseData.electricityConsumed.evidenceId || "", evidenceById(caseData, caseData.electricityConsumed.evidenceId)?.reviewStatus || ""],
      ["gridEmissionFactor", caseData.gridEmissionFactor.measurementMethod || "", caseData.gridEmissionFactor.responsiblePerson || "", caseData.gridEmissionFactor.confidenceStatus, caseData.gridEmissionFactor.documentReference || "", caseData.gridEmissionFactor.evidenceId || "", evidenceById(caseData, caseData.gridEmissionFactor.evidenceId)?.reviewStatus || ""],
    ]
  ), "MEASUREMENT_AND_METER_REGISTER");

  addFile("10_Activity_Data_Ledger.csv", csv(
    ["activity_id", "field", "raw_value", "canonical_unit", "reporting_period", "source_type", "evidence_id", "allocation_share"],
    [
      ["ACT_001", "directEmissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.reportingPeriod || facts.year, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", ""],
      ["ACT_002", "electricityConsumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.reportingPeriod || facts.year, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "", ""],
      ["ACT_003", "gridEmissionFactor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", caseData.gridEmissionFactor.reportingPeriod || facts.year, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "", ""],
      ...caseData.goods.map((good, index) => [`ACT_GOOD_${index + 1}`, `goods.${index}.productionVolume`, good.productionVolume.value, good.productionVolume.canonicalUnit || "t", good.productionVolume.reportingPeriod || facts.year, good.productionVolume.sourceType, good.productionVolume.evidenceId || "", calculation.goods[index]?.allocationShare || ""]),
    ]
  ), "ACTIVITY_DATA_LEDGER");

  addFile("11_Evidence_Register.csv", csv(
    ["evidence_id", "document_type", "file_name", "issuer", "issue_date", "reporting_period", "page_reference", "sha256", "size_bytes", "review_status", "support_status", "linked_inputs", "linked_calculations", "confidentiality"],
    caseData.evidenceRegister.map((evidence) => [evidence.evidenceId, evidence.documentType, evidence.fileName, evidence.issuer, evidence.issueDate, evidence.reportingPeriod, evidence.pageReference || "", evidence.fileHash, evidence.sizeBytes, evidence.reviewStatus, evidence.supportStatus, evidence.linkedInputs.join(";"), evidence.linkedCalculations.join(";"), evidence.confidentiality])
  ), "EVIDENCE_REGISTER");

  const fieldRows: unknown[][] = [
    ["importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber.value, "", caseData.importerIdentity.eoriNumber.sourceType, caseData.importerIdentity.eoriNumber.evidenceId || "", evidenceStatus(caseData, caseData.importerIdentity.eoriNumber), caseData.importerIdentity.eoriNumber.documentReference || ""],
    ["directEmissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", evidenceStatus(caseData, caseData.directEmissions), caseData.directEmissions.documentReference || ""],
    ["electricityConsumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "", evidenceStatus(caseData, caseData.electricityConsumed), caseData.electricityConsumed.documentReference || ""],
    ["gridEmissionFactor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "", evidenceStatus(caseData, caseData.gridEmissionFactor), caseData.gridEmissionFactor.documentReference || ""],
    ...caseData.goods.flatMap((good, index) => [
      [`goods.${index}.cnCode`, good.cnCode.value, "CN", good.cnCode.sourceType, good.cnCode.evidenceId || "", evidenceStatus(caseData, good.cnCode), good.cnCode.documentReference || ""],
      [`goods.${index}.productionVolume`, good.productionVolume.value, good.productionVolume.canonicalUnit || "t", good.productionVolume.sourceType, good.productionVolume.evidenceId || "", evidenceStatus(caseData, good.productionVolume), good.productionVolume.documentReference || ""],
      ...(caseData.goods.length > 1 ? [[`goods.${index}.allocationShare`, good.allocationShare?.value || "", "fraction", good.allocationShare?.sourceType || "", good.allocationShare?.evidenceId || "", evidenceStatus(caseData, good.allocationShare), good.allocationShare?.documentReference || ""]] : []),
    ]),
    ...caseData.precursors.flatMap((precursor, index) => [
      [`precursors.${index}.quantity`, precursor.quantity.value, precursor.quantity.canonicalUnit || "t", precursor.quantity.sourceType, precursor.quantity.evidenceId || "", evidenceStatus(caseData, precursor.quantity), precursor.quantity.documentReference || ""],
      [`precursors.${index}.directEmissions`, precursor.directEmissions.value, precursor.directEmissions.canonicalUnit || "tCO2e", precursor.directEmissions.sourceType, precursor.directEmissions.evidenceId || "", evidenceStatus(caseData, precursor.directEmissions), precursor.directEmissions.documentReference || ""],
      [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions.value, precursor.indirectEmissions.canonicalUnit || "tCO2e", precursor.indirectEmissions.sourceType, precursor.indirectEmissions.evidenceId || "", evidenceStatus(caseData, precursor.indirectEmissions), precursor.indirectEmissions.documentReference || ""],
    ]),
  ];
  addFile("12_Field_to_Evidence_Matrix.csv", csv(
    ["field", "entered_value", "unit", "source_type", "evidence_id", "review_and_support_status", "document_reference"],
    fieldRows
  ), "FIELD_TO_EVIDENCE_MATRIX");

  addFile("13_Methodology_Decision_Log.pdf", renderPdf({
    ...common,
    title: "Methodology Decision Log",
    subtitle: "Versioned operator decisions, bases, alternatives and evidence references",
    sections: caseData.methodologyDecisions.map<PdfSection>((decision) => ({
      heading: decision.topic,
      keyValues: [["Selected method", decision.selectedMethod], ["Reason", decision.reason], ["Legal or technical basis", decision.legalOrTechnicalBasis], ["Ruleset version", decision.rulesetVersion], ["Evidence IDs", decision.evidenceIds.join(", ") || "None"], ["Rejected alternative", decision.rejectedAlternativeReason || "Not recorded"], ["Internal review status", decision.reviewStatus]],
    })),
  }), "METHODOLOGY_DECISION_LOG");

  addFile("14_Embedded_Emissions_Calculation_Annex.pdf", renderPdf({
    ...common,
    title: "Embedded Emissions Calculation Annex",
    subtitle: "Deterministic formula trace, per-good allocation and reconciliation",
    sections: [
      { heading: "Installation totals", keyValues: [["Direct emissions including precursor direct", `${calculation.totalDirectEmissions} tCO2e`], ["Indirect emissions including precursor indirect", `${calculation.totalIndirectEmissions} tCO2e`], ["Total precursor emissions", `${calculation.totalPrecursorEmissions} tCO2e`], ["Total embedded emissions", `${calculation.totalEmbeddedEmissions} tCO2e`], ["Aggregate production volume", `${calculation.productionVolume} t`], ["Aggregate diagnostic intensity", `${calculation.specificEmbeddedEmissions} tCO2e/t`]] },
      { heading: "Per-good reportable results", table: goodsTable },
      { heading: "Allocation reconciliation", keyValues: [["Allocation share total", calculation.allocationShareTotal], ["Allocation reconciliation delta", calculation.allocationReconciliationDelta], ["Tolerance", "0.000001"], ["Method", methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "Single good receives 100%" : "Not documented")]] },
      { heading: "Ruleset and integrity", keyValues: [["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Calculation root hash", calculation.calculationRootHash], ["Rounding", "ROUND_HALF_UP, six decimal places, applied at final per-good intensity stage"]] },
      ...calculation.trace.map((trace) => ({ heading: trace.formulaId, keyValues: [["Inputs", JSON.stringify(trace.inputs)], ["Conversions", JSON.stringify(trace.conversions || {})], ["Intermediate calculations", JSON.stringify(trace.intermediateCalculations || {})], ["Output", `${trace.outputValue} ${trace.outputUnit}`], ["Assumptions", trace.assumptions.join("; ") || "None"], ["Warnings", trace.warnings.join("; ") || "None"], ["Node hash", trace.calculationHash]] })),
    ],
  }), "EMBEDDED_EMISSIONS_CALCULATION_ANNEX");

  addFile("15_Operator_Emissions_Report.pdf", renderPdf({
    ...common,
    title: "Operator Emissions Report",
    subtitle: "Annex VI-aligned operator dossier prepared for completion and challenge by an accredited verifier",
    documentStatus: "OPERATOR PREPARATION — VERIFIER COMPLETION REQUIRED",
    sections: [
      { heading: "1. Installation and operator identification", keyValues: [["Operator/exporter", facts.exporter], ["Installation", facts.installation], ["Country", facts.country], ["Production route", facts.route], ["System boundary", facts.boundaries]] },
      { heading: "2. Reporting period", keyValues: [["Year", facts.year], ["Quarter or period", facts.period], ["Release timestamp", generatedAt]] },
      { heading: "3. Goods quantities and embedded emissions", table: goodsTable },
      { heading: "4. Installation direct emissions", keyValues: [["Installation direct input", `${datumText(caseData.directEmissions)} tCO2e`], ["Precursor direct emissions", `${caseData.precursors.reduce((sum, precursor) => sum + Number(precursor.directEmissions.value || 0), 0)} tCO2e`], ["Reported total direct emissions", `${calculation.totalDirectEmissions} tCO2e`], ["Evidence status", evidenceStatus(caseData, caseData.directEmissions)]] },
      { heading: "5. Attribution to different goods", paragraphs: [methodologyText(caseData, "GOODS_EMISSIONS_ALLOCATION", caseData.goods.length === 1 ? "The installation produces one covered good; the good receives 100% of installation emissions." : "Allocation method not documented.")], keyValues: [["Allocation share total", calculation.allocationShareTotal], ["Reconciliation delta", calculation.allocationReconciliationDelta]] },
      { heading: "6. Non-associated goods, emissions and energy flows", paragraphs: [methodologyText(caseData, "NON_ASSOCIATED_FLOWS", "No separate non-associated flows were declared. This statement requires external verifier challenge against process and energy records.")] },
      { heading: "7. Complex-goods precursor information", table: { headers: ["#", "Input material", "Origin", "Quantity", "Direct emissions", "Indirect emissions", "Evidence"], rows: caseData.precursors.length > 0 ? caseData.precursors.map((precursor, index) => [String(index + 1), datumText(precursor.name), datumText(precursor.countryOfOrigin), `${datumText(precursor.quantity)} ${precursor.quantity.canonicalUnit || "t"}`, `${datumText(precursor.directEmissions)} tCO2e`, `${datumText(precursor.indirectEmissions)} tCO2e`, [precursor.quantity.evidenceId, precursor.directEmissions.evidenceId, precursor.indirectEmissions.evidenceId].filter(Boolean).join(";")]) : [["—", "No precursors; accepted scope decision applies", "", "", "", "", ""]], widths: [8, 34, 22, 28, 28, 28, 32] } },
      { heading: "8. Evidence, quality and calculation integrity", keyValues: [["Report-quality status", reportQualityAssessment.status], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Evidence records", String(caseData.evidenceRegister.length)], ["Calculation trace nodes", String(calculation.trace.length)], ["Calculation root hash", calculation.calculationRootHash], ["Open material findings", String(caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED" && (gap.isBlocking || ["BLOCKER", "CRITICAL", "MAJOR"].includes(gap.severity))).length)]] },
      { heading: "9. Verifier completion section", keyValues: [["Verifier name and contact", "TO BE COMPLETED BY ACCREDITED VERIFIER"], ["Accreditation number and body", "TO BE COMPLETED BY ACCREDITED VERIFIER"], ["Installation visit date or justified waiver", "TO BE COMPLETED BY ACCREDITED VERIFIER"], ["Reasonable-assurance conclusion", "NOT PROVIDED BY CBAMVALID"], ["Material misstatements found and corrected", "TO BE COMPLETED BY ACCREDITED VERIFIER"], ["Material non-conformities found and corrected", "TO BE COMPLETED BY ACCREDITED VERIFIER"]] },
      { heading: "10. Responsibility and limitation statement", paragraphs: [...REPORT_LIMITATIONS] },
    ],
  }), "OPERATOR_EMISSIONS_REPORT");

  addFile("16_Operator_Summary_Emissions_Report.pdf", renderPdf({
    ...common,
    title: "Operator Summary Emissions Report",
    subtitle: "Executive summary for management, importer/declarant and external verifier",
    sections: [
      { heading: "Executive conclusion", paragraphs: [`The sealed dossier reports ${calculation.totalEmbeddedEmissions} tCO2e of total embedded emissions for ${caseData.goods.length} covered good(s) produced at ${facts.installation} during ${facts.year} ${facts.period}. Report-quality status: ${reportQualityAssessment.status}.`] },
      { heading: "Key identifiers", keyValues: [["Operator/exporter", facts.exporter], ["Importer/declarant", facts.importer], ["EORI", facts.eori], ["Installation", facts.installation], ["Country", facts.country], ["CN codes", facts.cnCodes]] },
      { heading: "Per-good results", table: goodsTable },
      { heading: "Integrity and readiness", keyValues: [["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Calculation root hash", calculation.calculationRootHash], ["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Report standard", REPORT_STANDARD_VERSION], ["Verification boundary", "Prepared for independent verification; accredited verifier conclusion not included"]] },
    ],
  }), "OPERATOR_SUMMARY_EMISSIONS_REPORT");

  addFile("17_Verification_Readiness_Assessment.pdf", renderPdf({
    ...common,
    title: "Verification Readiness Assessment",
    subtitle: "Professional-scepticism checklist and closure status before independent verification",
    sections: [
      { heading: "Overall assessment", keyValues: [["Report-quality status", reportQualityAssessment.status], ["Quality-control status", qualityStatus(qualityControls)], ["Evidence coverage", `${reportQualityAssessment.evidenceCoverage.percentage}%`], ["Hash coverage", `${reportQualityAssessment.calculationIntegrity.hashCoveragePercentage}%`], ["Allocation reconciled", reportQualityAssessment.calculationIntegrity.allocationReconciled ? "YES" : "NO"]] },
      { heading: "Quality-control results", table: { headers: ["Rule", "Control", "Status", "Finding", "Remediation"], rows: qualityControls.map((item) => [item.ruleId, item.name, item.status, item.message || "No exception", item.remediationCode || ""]), widths: [18, 40, 22, 62, 38] } },
      { heading: "Report-quality issues", table: { headers: ["Code", "Severity", "Issue", "Remediation"], rows: reportQualityAssessment.issues.length > 0 ? reportQualityAssessment.issues.map((issue) => [issue.code, issue.severity, issue.message, issue.remediation]) : [["NONE", "—", "No open report-quality issue", "—"]], widths: [38, 18, 62, 62] } },
      { heading: "External verifier challenge points", paragraphs: ["Confirm installation identity, operator contact and reporting boundary.", "Challenge completeness of source streams, meters, precursors, non-associated flows and allocation bases.", "Reperform material calculations from source evidence and assess materiality.", "Determine whether an installation visit is required and document the decision.", "Issue the independent verification conclusion outside CBAMValid."] },
    ],
  }), "VERIFICATION_READINESS_ASSESSMENT");

  addFile("18_Misstatement_and_Non_Conformity_Register.csv", csv(
    ["gap_id", "issue_type", "requirement", "severity", "affected_result", "why_it_matters", "is_blocking", "status", "closure_note"],
    caseData.gapAssessment.map((gap) => [gap.gapId, gap.issueType || "", gap.requirement, gap.severity, gap.affectedResult || "", gap.whyItMatters, gap.isBlocking, gap.resolutionStatus, gap.closureNote || ""])
  ), "MISSTATEMENT_AND_NON_CONFORMITY_REGISTER");

  addFile("19_Corrective_Action_Log.csv", csv(
    ["gap_id", "required_evidence", "suggested_action", "responsible_party", "deadline", "resolution_status", "resolution_evidence_ids", "closure_note"],
    caseData.gapAssessment.map((gap) => [gap.gapId, gap.requiredEvidence, gap.suggestedAction, gap.responsibleParty || "", gap.deadline || "", gap.resolutionStatus, (gap.resolutionEvidenceIds || []).join(";"), gap.closureNote || ""])
  ), "CORRECTIVE_ACTION_LOG");

  addFile("20_O3CI_Field_Mapping.csv", csv(
    ["mapped_field", "case_value", "unit", "source_reference", "evidence_or_hash", "status"],
    [
      ["installation.name", facts.installation, "", "case.installation.name", caseData.installation.name.evidenceId || "", "MAPPED"],
      ["installation.country", facts.country, "", "case.installation.country", caseData.installation.country.evidenceId || "", "MAPPED"],
      ["reporting.year", facts.year, "year", "case.reportingPeriod.year", "", "MAPPED"],
      ...calculation.goods.flatMap((good) => [
        [`goods.${good.goodIndex}.cn_code`, good.cnCode, "CN", `case.goods.${good.goodIndex - 1}.cnCode`, caseData.goods[good.goodIndex - 1]?.cnCode.evidenceId || "", "MAPPED"],
        [`goods.${good.goodIndex}.production_quantity`, good.productionVolume, "t", `case.goods.${good.goodIndex - 1}.productionVolume`, caseData.goods[good.goodIndex - 1]?.productionVolume.evidenceId || "", "MAPPED"],
        [`goods.${good.goodIndex}.allocation_share`, good.allocationShare, "fraction", `case.goods.${good.goodIndex - 1}.allocationShare`, caseData.goods[good.goodIndex - 1]?.allocationShare?.evidenceId || "", "MAPPED"],
        [`goods.${good.goodIndex}.specific_embedded_emissions`, good.specificEmbeddedEmissions, "tCO2e/t", `calculation.goods.${good.goodIndex - 1}.specificEmbeddedEmissions`, calculation.calculationRootHash, "MAPPED"],
      ]),
      ["emissions.total_embedded", calculation.totalEmbeddedEmissions, "tCO2e", "calculation.totalEmbeddedEmissions", calculation.calculationRootHash, "MAPPED"],
      ["integrity.calculation_root_hash", calculation.calculationRootHash, "SHA-256", "calculation.calculationRootHash", calculation.calculationRootHash, "MAPPED"],
      ["integrity.report_standard", REPORT_STANDARD_VERSION, "", "manifest.reportStandardVersion", "", "MAPPED"],
    ]
  ), "O3CI_FIELD_MAPPING");

  addFile("21_Calculation_Trace.json", JSON.stringify({
    releaseId,
    caseId,
    reportStandardVersion: REPORT_STANDARD_VERSION,
    ruleset: calculation.ruleset,
    engineVersion: calculation.engineVersion,
    calculationRootHash: calculation.calculationRootHash,
    allocationShareTotal: calculation.allocationShareTotal,
    allocationReconciliationDelta: calculation.allocationReconciliationDelta,
    goods: calculation.goods,
    trace: calculation.trace,
  }, null, 2), "CALCULATION_TRACE");

  const evidenceFolder = zip.folder("23_Supporting_Evidence");
  if (!evidenceFolder) throw new Error("VERIFIER_PACKAGE_EVIDENCE_FOLDER_CREATION_FAILED");
  const usedNames = new Set<string>();
  for (const evidence of evidenceFiles) {
    const calculatedHash = sha256(evidence.buffer);
    if (calculatedHash !== evidence.sourceHash.toLowerCase()) throw new Error(`VERIFIER_PACKAGE_EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
    let archiveName = `${evidence.evidenceId}_${sanitizeArchiveName(evidence.fileName)}`;
    let suffix = 1;
    while (usedNames.has(archiveName)) {
      archiveName = `${evidence.evidenceId}_${suffix}_${sanitizeArchiveName(evidence.fileName)}`;
      suffix += 1;
    }
    usedNames.add(archiveName);
    const archivePath = `23_Supporting_Evidence/${archiveName}`;
    evidenceFolder.file(archiveName, evidence.buffer);
    manifestFiles.push({
      filename: archivePath,
      documentType: `SUPPORTING_EVIDENCE:${evidence.mimeType}`,
      version: caseData.version,
      releaseId,
      caseId,
      generatedAt,
      ruleset: calculation.ruleset,
      engineVersion: calculation.engineVersion,
      reportStandardVersion: REPORT_STANDARD_VERSION,
      sha256: calculatedHash,
      sizeBytes: evidence.buffer.byteLength,
      confidentiality: "CONFIDENTIAL",
    });
  }

  const manifest: DataIntegrityManifest = {
    manifestVersion: "2.0",
    product: "CBAMValid Exporter Verification Preparation Pack",
    reportStandardVersion: REPORT_STANDARD_VERSION,
    releaseId,
    caseId,
    caseVersion: caseData.version,
    generatedAt,
    ruleset: calculation.ruleset,
    engineVersion: calculation.engineVersion,
    calculationRootHash: calculation.calculationRootHash,
    topLevelComponentCount: 23,
    regulatoryBasis: REPORT_BASIS,
    reportQualityAssessment,
    files: manifestFiles.sort((a, b) => a.filename.localeCompare(b.filename)),
    limitations: REPORT_LIMITATIONS,
  };

  const manifestContent = JSON.stringify(manifest, null, 2);
  zip.file("22_Data_Integrity_Manifest.json", manifestContent);
  const manifestHash = sha256(manifestContent);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });

  const verification = await verifyVerifierPreparationPackage(zipBuffer);
  if (
    verification.manifestHash !== manifestHash ||
    verification.topLevelComponentCount !== 23 ||
    verification.verifiedFileCount !== manifest.files.length
  ) {
    throw new Error("VERIFIER_PACKAGE_POST_BUILD_VERIFICATION_FAILED");
  }

  return { zipBuffer, manifest, manifestHash };
}

export async function verifyVerifierPreparationPackage(zipBuffer: Buffer): Promise<{
  manifestHash: string;
  topLevelComponentCount: number;
  verifiedFileCount: number;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const names = Object.keys(zip.files);
  const topLevelNames = new Set(names.map((name) => {
    const slashIndex = name.indexOf("/");
    return slashIndex === -1 ? name : `${name.slice(0, slashIndex)}/`;
  }));

  for (const required of REQUIRED_TOP_LEVEL_COMPONENTS) {
    if (!topLevelNames.has(required)) throw new Error(`VERIFIER_PACKAGE_REQUIRED_COMPONENT_MISSING:${required}`);
  }
  if (topLevelNames.size !== REQUIRED_TOP_LEVEL_COMPONENTS.length) {
    throw new Error(`VERIFIER_PACKAGE_TOP_LEVEL_COUNT_INVALID:${topLevelNames.size}`);
  }

  const manifestEntry = zip.file("22_Data_Integrity_Manifest.json");
  if (!manifestEntry) throw new Error("VERIFIER_PACKAGE_MANIFEST_MISSING");
  const manifestBuffer = await manifestEntry.async("nodebuffer");
  const manifest = JSON.parse(manifestBuffer.toString("utf8")) as DataIntegrityManifest;
  if (manifest.topLevelComponentCount !== 23) throw new Error("VERIFIER_PACKAGE_MANIFEST_COMPONENT_COUNT_INVALID");
  if (manifest.reportStandardVersion !== REPORT_STANDARD_VERSION) throw new Error("VERIFIER_PACKAGE_REPORT_STANDARD_VERSION_INVALID");
  if (manifest.reportQualityAssessment.status !== "PASS") throw new Error("VERIFIER_PACKAGE_REPORT_QUALITY_NOT_PASS");

  let verifiedFileCount = 0;
  for (const fileRecord of manifest.files) {
    const entry = zip.file(fileRecord.filename);
    if (!entry) throw new Error(`VERIFIER_PACKAGE_MANIFEST_FILE_MISSING:${fileRecord.filename}`);
    const bytes = await entry.async("nodebuffer");
    if (sha256(bytes) !== fileRecord.sha256) throw new Error(`VERIFIER_PACKAGE_MANIFEST_HASH_MISMATCH:${fileRecord.filename}`);
    if (bytes.byteLength !== fileRecord.sizeBytes) throw new Error(`VERIFIER_PACKAGE_MANIFEST_SIZE_MISMATCH:${fileRecord.filename}`);
    verifiedFileCount += 1;
  }

  return {
    manifestHash: sha256(manifestBuffer),
    topLevelComponentCount: topLevelNames.size,
    verifiedFileCount,
  };
}
