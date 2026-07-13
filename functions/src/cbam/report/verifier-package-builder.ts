import crypto from "crypto";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { AuditReadyCase } from "../schema";
import { DossierCalculationResult } from "../calculator";
import { QualityControlResult } from "../validation/quality-controls";

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
  sha256: string;
  sizeBytes: number;
  confidentiality: "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";
};

export type DataIntegrityManifest = {
  manifestVersion: "1.0";
  product: "CBAMValid Exporter Verification Preparation Pack";
  releaseId: string;
  caseId: string;
  caseVersion: number;
  generatedAt: string;
  ruleset: string;
  engineVersion: string;
  calculationRootHash: string;
  topLevelComponentCount: 23;
  files: ManifestFile[];
  limitations: string[];
};

function sha256(value: Buffer | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function text(value: unknown, fallback = "Not provided"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
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

function renderPdf(params: {
  title: string;
  releaseId: string;
  caseId: string;
  generatedAt: string;
  sections: Array<{ heading: string; lines: string[] }>;
}): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 16;
  let y = 18;

  const addHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(params.title, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Release ID: ${params.releaseId}`, margin, y);
    y += 4;
    doc.text(`Case ID: ${params.caseId} | Generated: ${params.generatedAt}`, margin, y);
    y += 6;
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
  };

  const ensureSpace = (required = 24) => {
    if (y + required > 275) {
      doc.addPage();
      y = 18;
      addHeader();
    }
  };

  addHeader();
  for (const section of params.sections) {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(section.heading, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    for (const line of section.lines) {
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
      ensureSpace(wrapped.length * 4 + 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 2;
    }
    y += 3;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text("CBAMValid verifier-preparation output — not an accredited verification opinion", margin, 288);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, 288, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function caseFacts(caseData: AuditReadyCase) {
  return {
    exporter: text(caseData.exporterIdentity.legalName.value),
    importer: text(caseData.importerIdentity.legalName.value),
    eori: text(caseData.importerIdentity.eoriNumber.value),
    year: text(caseData.reportingPeriod.year.value),
    quarter: text(caseData.reportingPeriod.quarter.value),
    installation: text(caseData.installation.name.value),
    country: text(caseData.installation.country.value),
    route: text(caseData.installation.productionRoute.value),
    boundaries: text(caseData.installation.systemBoundaries),
    cnCodes: caseData.goods.map((good) => text(good.cnCode.value)).join(", ") || "None",
  };
}

function qualityStatus(qc: QualityControlResult[]): "READY" | "READY_WITH_WARNINGS" | "BLOCKED" {
  if (qc.some((item) => item.status === "BLOCKER")) return "BLOCKED";
  if (qc.some((item) => item.status === "WARNING")) return "READY_WITH_WARNINGS";
  return "READY";
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

  if (caseData.evidenceRegister.length === 0) {
    throw new Error("VERIFIER_PACKAGE_EVIDENCE_REQUIRED");
  }
  if (evidenceFiles.length !== caseData.evidenceRegister.length) {
    throw new Error("VERIFIER_PACKAGE_EVIDENCE_FILE_COUNT_MISMATCH");
  }

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
      sha256: sha256(buffer),
      sizeBytes: buffer.byteLength,
      confidentiality,
    });
  };

  addFile("01_Product_Scope_Assessment.pdf", renderPdf({
    title: "Product Scope Assessment",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Commercial Scope", lines: [`One installation: ${facts.installation}`, `Reporting year: ${facts.year}`, `Linked CN codes: ${facts.cnCodes}`] },
      { heading: "Assessment Boundary", lines: [`Production route: ${facts.route}`, `System boundaries: ${facts.boundaries}`, "This output supports preparation for independent verification and does not determine customs acceptance."] },
    ],
  }), "PRODUCT_SCOPE_ASSESSMENT");

  addFile("02_CN_Code_Reasoning.pdf", renderPdf({
    title: "CN Code Reasoning",
    releaseId, caseId, generatedAt,
    sections: caseData.goods.map((good, index) => ({
      heading: `Good ${index + 1}`,
      lines: [
        `CN code: ${text(good.cnCode.value)}`,
        `Sector classification: ${text(good.sector)}`,
        `Production quantity: ${text(good.productionVolume.value)} ${good.productionVolume.canonicalUnit || good.productionVolume.unit || "t"}`,
        "The user remains responsible for confirming customs classification with competent advisers or authorities.",
      ],
    })),
  }), "CN_CODE_REASONING");

  addFile("03_Required_Data_Checklist.pdf", renderPdf({
    title: "Required Data Checklist",
    releaseId, caseId, generatedAt,
    sections: [{
      heading: "Case Data",
      lines: [
        `Exporter identity: ${facts.exporter}`,
        `Importer/declarant identity: ${facts.importer}`,
        `EORI: ${facts.eori}`,
        `Installation and route: ${facts.installation} / ${facts.route}`,
        `Evidence records supplied: ${caseData.evidenceRegister.length}`,
        `Open findings: ${caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED").length}`,
      ],
    }],
  }), "REQUIRED_DATA_CHECKLIST");

  addFile("04_Installation_Monitoring_Plan.pdf", renderPdf({
    title: "Installation Monitoring Plan",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Installation", lines: [`Name: ${facts.installation}`, `Country: ${facts.country}`, `Reporting period: ${facts.year} ${facts.quarter}`] },
      { heading: "Monitoring Boundary", lines: [`Production route: ${facts.route}`, `System boundaries: ${facts.boundaries}`] },
      { heading: "Controls", lines: ["Activity data must be traceable to source documents, meters or production records.", "Changes after sealing require a new immutable release version."] },
    ],
  }), "INSTALLATION_MONITORING_PLAN");

  addFile("05_Production_Process_Map.pdf", renderPdf({
    title: "Production Process Map",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Route", lines: [`Installation: ${facts.installation}`, `Production route: ${facts.route}`, `Goods/CN groups: ${facts.cnCodes}`] },
      { heading: "Precursor Chain", lines: caseData.precursors.length > 0 ? caseData.precursors.map((p, index) => `${index + 1}. ${text(p.name.value)} — ${text(p.quantity.value)} ${p.quantity.canonicalUnit || p.quantity.unit || ""}`) : ["No precursor records were declared."] },
    ],
  }), "PRODUCTION_PROCESS_MAP");

  addFile("06_System_Boundary_Register.pdf", renderPdf({
    title: "System Boundary Register",
    releaseId, caseId, generatedAt,
    sections: [{ heading: "Defined Boundary", lines: [`Installation: ${facts.installation}`, `Boundary statement: ${facts.boundaries}`, `Direct-emission input: ${text(caseData.directEmissions.value)} tCO2e`, `Electricity input: ${text(caseData.electricityConsumed.value)} MWh`] }],
  }), "SYSTEM_BOUNDARY_REGISTER");

  addFile("07_Source_Stream_Register.csv", csv(
    ["source_stream_id", "description", "value", "unit", "source_type", "evidence_id"],
    [
      ["DIRECT_EMISSIONS", "Installation direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || caseData.directEmissions.unit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || ""],
      ["ELECTRICITY", "Electricity consumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || caseData.electricityConsumed.unit || "MWh", caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || ""],
      ["GRID_FACTOR", "Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || caseData.gridEmissionFactor.unit || "tCO2e/MWh", caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || ""],
    ]
  ), "SOURCE_STREAM_REGISTER");

  addFile("08_Emission_Source_Register.csv", csv(
    ["source_id", "category", "direct_tco2e", "indirect_tco2e", "evidence_id"],
    [
      ["INSTALLATION", "Installation", caseData.directEmissions.value, calculation.totalIndirectEmissions, caseData.directEmissions.evidenceId || ""],
      ...caseData.precursors.map((p, index) => [`PRECURSOR_${index + 1}`, text(p.name.value), p.directEmissions.value, p.indirectEmissions.value, p.directEmissions.evidenceId || p.indirectEmissions.evidenceId || ""]),
    ]
  ), "EMISSION_SOURCE_REGISTER");

  addFile("09_Measurement_and_Meter_Register.csv", csv(
    ["field", "measurement_method", "responsible_person", "confidence_status", "document_reference"],
    [
      ["directEmissions", caseData.directEmissions.measurementMethod || "", caseData.directEmissions.responsiblePerson || "", caseData.directEmissions.confidenceStatus, caseData.directEmissions.documentReference || ""],
      ["electricityConsumed", caseData.electricityConsumed.measurementMethod || "", caseData.electricityConsumed.responsiblePerson || "", caseData.electricityConsumed.confidenceStatus, caseData.electricityConsumed.documentReference || ""],
      ["gridEmissionFactor", caseData.gridEmissionFactor.measurementMethod || "", caseData.gridEmissionFactor.responsiblePerson || "", caseData.gridEmissionFactor.confidenceStatus, caseData.gridEmissionFactor.documentReference || ""],
    ]
  ), "MEASUREMENT_AND_METER_REGISTER");

  addFile("10_Activity_Data_Ledger.csv", csv(
    ["activity_id", "field", "raw_value", "canonical_unit", "reporting_period", "source_type", "evidence_id"],
    [
      ["ACT_001", "directEmissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.reportingPeriod || facts.year, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || ""],
      ["ACT_002", "electricityConsumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.reportingPeriod || facts.year, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || ""],
      ...caseData.goods.map((good, index) => [`ACT_GOOD_${index + 1}`, `goods.${index}.productionVolume`, good.productionVolume.value, good.productionVolume.canonicalUnit || "t", good.productionVolume.reportingPeriod || facts.year, good.productionVolume.sourceType, good.productionVolume.evidenceId || ""]),
    ]
  ), "ACTIVITY_DATA_LEDGER");

  addFile("11_Evidence_Register.csv", csv(
    ["evidence_id", "document_type", "file_name", "issuer", "issue_date", "reporting_period", "page_reference", "sha256", "review_status", "support_status", "linked_inputs", "confidentiality"],
    caseData.evidenceRegister.map((e) => [e.evidenceId, e.documentType, e.fileName, e.issuer, e.issueDate, e.reportingPeriod, e.pageReference || "", e.fileHash, e.reviewStatus, e.supportStatus, e.linkedInputs.join(";"), e.confidentiality])
  ), "EVIDENCE_REGISTER");

  addFile("12_Field_to_Evidence_Matrix.csv", csv(
    ["field", "entered_value", "unit", "source_type", "evidence_id", "support_status", "document_reference"],
    [
      ["directEmissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "tCO2e", caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "", caseData.directEmissions.evidenceId ? "SUPPORTED" : "UNSUPPORTED", caseData.directEmissions.documentReference || ""],
      ["electricityConsumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "MWh", caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "", caseData.electricityConsumed.evidenceId ? "SUPPORTED" : "UNSUPPORTED", caseData.electricityConsumed.documentReference || ""],
      ["gridEmissionFactor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || "tCO2e/MWh", caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "", caseData.gridEmissionFactor.evidenceId ? "SUPPORTED" : "UNSUPPORTED", caseData.gridEmissionFactor.documentReference || ""],
      ...caseData.goods.map((good, index) => [`goods.${index}.productionVolume`, good.productionVolume.value, good.productionVolume.canonicalUnit || "t", good.productionVolume.sourceType, good.productionVolume.evidenceId || "", good.productionVolume.evidenceId ? "SUPPORTED" : "UNSUPPORTED", good.productionVolume.documentReference || ""]),
    ]
  ), "FIELD_TO_EVIDENCE_MATRIX");

  addFile("13_Methodology_Decision_Log.pdf", renderPdf({
    title: "Methodology Decision Log",
    releaseId, caseId, generatedAt,
    sections: caseData.methodologyDecisions.length > 0 ? caseData.methodologyDecisions.map((decision) => ({
      heading: decision.topic,
      lines: [`Selected method: ${decision.selectedMethod}`, `Reason: ${decision.reason}`, `Basis: ${decision.legalOrTechnicalBasis}`, `Evidence: ${decision.evidenceIds.join(", ") || "None"}`, `Review status: ${decision.reviewStatus}`],
    })) : [{ heading: "No Recorded Decisions", lines: ["No methodology decisions were recorded by the user. Review is required before relying on this output."] }],
  }), "METHODOLOGY_DECISION_LOG");

  addFile("14_Embedded_Emissions_Calculation_Annex.pdf", renderPdf({
    title: "Embedded Emissions Calculation Annex",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Results", lines: [`Total direct emissions: ${calculation.totalDirectEmissions} tCO2e`, `Total indirect emissions: ${calculation.totalIndirectEmissions} tCO2e`, `Total embedded emissions: ${calculation.totalEmbeddedEmissions} tCO2e`, `Production volume: ${calculation.productionVolume} t`, `Specific embedded emissions: ${calculation.specificEmbeddedEmissions} tCO2e/t`] },
      { heading: "Ruleset and Integrity", lines: [`Ruleset: ${calculation.ruleset}`, `Engine version: ${calculation.engineVersion}`, `Calculation root hash: ${calculation.calculationRootHash}`, "Rounding is applied only at the final specific-emissions stage to six decimal places using ROUND_HALF_UP."] },
      ...calculation.trace.map((node) => ({ heading: node.formulaId, lines: [`Inputs: ${JSON.stringify(node.inputs)}`, `Output: ${node.outputValue} ${node.outputUnit}`, `Hash: ${node.calculationHash}`, `Warnings: ${node.warnings.join("; ") || "None"}`] })),
    ],
  }), "EMBEDDED_EMISSIONS_CALCULATION_ANNEX");

  addFile("15_Operator_Emissions_Report.pdf", renderPdf({
    title: "Operator Emissions Report",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Operator and Installation", lines: [`Exporter/operator: ${facts.exporter}`, `Installation: ${facts.installation}`, `Country: ${facts.country}`, `Reporting year: ${facts.year}`] },
      { heading: "Emissions", lines: [`Total direct emissions: ${calculation.totalDirectEmissions} tCO2e`, `Total indirect emissions: ${calculation.totalIndirectEmissions} tCO2e`, `Total precursor emissions: ${calculation.totalPrecursorEmissions} tCO2e`, `Specific embedded emissions: ${calculation.specificEmbeddedEmissions} tCO2e/t`] },
      { heading: "Evidence and Findings", lines: [`Evidence records: ${caseData.evidenceRegister.length}`, `Readiness: ${qualityStatus(qualityControls)}`, `Open findings: ${caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED").length}`] },
    ],
  }), "OPERATOR_EMISSIONS_REPORT");

  addFile("16_Operator_Summary_Emissions_Report.pdf", renderPdf({
    title: "Operator Summary Emissions Report",
    releaseId, caseId, generatedAt,
    sections: [{ heading: "Summary", lines: [`Installation: ${facts.installation}`, `Reporting year: ${facts.year}`, `CN codes: ${facts.cnCodes}`, `Total embedded emissions: ${calculation.totalEmbeddedEmissions} tCO2e`, `Specific embedded emissions: ${calculation.specificEmbeddedEmissions} tCO2e/t`, `Readiness status: ${qualityStatus(qualityControls)}`] }],
  }), "OPERATOR_SUMMARY_EMISSIONS_REPORT");

  addFile("17_Verification_Readiness_Assessment.pdf", renderPdf({
    title: "Verification Readiness Assessment",
    releaseId, caseId, generatedAt,
    sections: [
      { heading: "Overall Status", lines: [`Status: ${qualityStatus(qualityControls)}`, `Evidence coverage records: ${caseData.evidenceRegister.length}`, `Calculation trace nodes: ${calculation.trace.length}`] },
      ...qualityControls.map((item) => ({ heading: `${item.ruleId} — ${item.name}`, lines: [`Status: ${item.status}`, `Finding: ${item.message || "No exception recorded."}`] })),
    ],
  }), "VERIFICATION_READINESS_ASSESSMENT");

  addFile("18_Misstatement_and_Non_Conformity_Register.csv", csv(
    ["gap_id", "issue_type", "requirement", "severity", "affected_result", "is_blocking", "status"],
    caseData.gapAssessment.map((gap) => [gap.gapId, gap.issueType || "", gap.requirement, gap.severity, gap.affectedResult || "", gap.isBlocking, gap.resolutionStatus])
  ), "MISSTATEMENT_AND_NON_CONFORMITY_REGISTER");

  addFile("19_Corrective_Action_Log.csv", csv(
    ["gap_id", "suggested_action", "responsible_party", "deadline", "resolution_status", "resolution_evidence_ids", "closure_note"],
    caseData.gapAssessment.map((gap) => [gap.gapId, gap.suggestedAction, gap.responsibleParty || "", gap.deadline || "", gap.resolutionStatus, (gap.resolutionEvidenceIds || []).join(";"), gap.closureNote || ""])
  ), "CORRECTIVE_ACTION_LOG");

  addFile("20_O3CI_Field_Mapping.csv", csv(
    ["o3ci_field", "case_value", "unit", "source_reference", "status"],
    [
      ["installation.name", facts.installation, "", "case.installation.name", "MAPPED"],
      ["reporting.year", facts.year, "year", "case.reportingPeriod.year", "MAPPED"],
      ["goods.cn_codes", facts.cnCodes, "CN", "case.goods", "MAPPED"],
      ["emissions.total_embedded", calculation.totalEmbeddedEmissions, "tCO2e", "calculation.totalEmbeddedEmissions", "MAPPED"],
      ["emissions.specific_embedded", calculation.specificEmbeddedEmissions, "tCO2e/t", "calculation.specificEmbeddedEmissions", "MAPPED"],
      ["integrity.calculation_root_hash", calculation.calculationRootHash, "SHA-256", "calculation.calculationRootHash", "MAPPED"],
    ]
  ), "O3CI_FIELD_MAPPING");

  addFile("21_Calculation_Trace.json", JSON.stringify({
    releaseId,
    caseId,
    ruleset: calculation.ruleset,
    engineVersion: calculation.engineVersion,
    calculationRootHash: calculation.calculationRootHash,
    trace: calculation.trace,
  }, null, 2), "CALCULATION_TRACE");

  const evidenceFolder = zip.folder("23_Supporting_Evidence");
  if (!evidenceFolder) throw new Error("VERIFIER_PACKAGE_EVIDENCE_FOLDER_CREATION_FAILED");

  const usedNames = new Set<string>();
  for (const evidence of evidenceFiles) {
    const calculatedHash = sha256(evidence.buffer);
    if (calculatedHash !== evidence.sourceHash.toLowerCase()) {
      throw new Error(`VERIFIER_PACKAGE_EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
    }
    let archiveName = `${evidence.evidenceId}_${sanitizeArchiveName(evidence.fileName)}`;
    let suffix = 1;
    while (usedNames.has(archiveName)) {
      archiveName = `${evidence.evidenceId}_${suffix}_${sanitizeArchiveName(evidence.fileName)}`;
      suffix += 1;
    }
    usedNames.add(archiveName);
    const path = `23_Supporting_Evidence/${archiveName}`;
    evidenceFolder.file(archiveName, evidence.buffer);
    manifestFiles.push({
      filename: path,
      documentType: `SUPPORTING_EVIDENCE:${evidence.mimeType}`,
      version: caseData.version,
      releaseId,
      caseId,
      generatedAt,
      ruleset: calculation.ruleset,
      engineVersion: calculation.engineVersion,
      sha256: calculatedHash,
      sizeBytes: evidence.buffer.byteLength,
      confidentiality: "CONFIDENTIAL",
    });
  }

  const manifest: DataIntegrityManifest = {
    manifestVersion: "1.0",
    product: "CBAMValid Exporter Verification Preparation Pack",
    releaseId,
    caseId,
    caseVersion: caseData.version,
    generatedAt,
    ruleset: calculation.ruleset,
    engineVersion: calculation.engineVersion,
    calculationRootHash: calculation.calculationRootHash,
    topLevelComponentCount: 23,
    files: manifestFiles.sort((a, b) => a.filename.localeCompare(b.filename)),
    limitations: [
      "This package supports preparation for independent verification.",
      "It is not an accredited verification opinion, customs approval, EU approval or acceptance guarantee.",
      "O3CI_Field_Mapping.csv is a field-mapped structured export, not an official Registry submission file.",
    ],
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
  if (verification.manifestHash !== manifestHash || verification.topLevelComponentCount !== 23) {
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
    if (!topLevelNames.has(required)) {
      throw new Error(`VERIFIER_PACKAGE_REQUIRED_COMPONENT_MISSING:${required}`);
    }
  }
  if (topLevelNames.size !== REQUIRED_TOP_LEVEL_COMPONENTS.length) {
    throw new Error(`VERIFIER_PACKAGE_TOP_LEVEL_COUNT_INVALID:${topLevelNames.size}`);
  }

  const manifestEntry = zip.file("22_Data_Integrity_Manifest.json");
  if (!manifestEntry) throw new Error("VERIFIER_PACKAGE_MANIFEST_MISSING");
  const manifestBuffer = await manifestEntry.async("nodebuffer");
  const manifest = JSON.parse(manifestBuffer.toString("utf8")) as DataIntegrityManifest;
  if (manifest.topLevelComponentCount !== 23) {
    throw new Error("VERIFIER_PACKAGE_MANIFEST_COMPONENT_COUNT_INVALID");
  }

  let verifiedFileCount = 0;
  for (const fileRecord of manifest.files) {
    const entry = zip.file(fileRecord.filename);
    if (!entry) throw new Error(`VERIFIER_PACKAGE_MANIFEST_FILE_MISSING:${fileRecord.filename}`);
    const bytes = await entry.async("nodebuffer");
    if (sha256(bytes) !== fileRecord.sha256) {
      throw new Error(`VERIFIER_PACKAGE_MANIFEST_HASH_MISMATCH:${fileRecord.filename}`);
    }
    if (bytes.byteLength !== fileRecord.sizeBytes) {
      throw new Error(`VERIFIER_PACKAGE_MANIFEST_SIZE_MISMATCH:${fileRecord.filename}`);
    }
    verifiedFileCount += 1;
  }

  return {
    manifestHash: sha256(manifestBuffer),
    topLevelComponentCount: topLevelNames.size,
    verifiedFileCount,
  };
}
