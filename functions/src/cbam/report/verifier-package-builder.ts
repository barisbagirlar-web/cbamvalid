import crypto from "node:crypto";
import JSZip from "jszip";
import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import { DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT } from "../registry/legal-sources";
import type { KmsSignatureResult } from "./kms-signature";
import { buildProfessionalPdf, type PdfSection } from "./professional-pdf";
import { buildVerifierPackageModel, type VerifierPackageModel } from "./verifier-model";
import { buildVerifierWorkbook } from "./xlsx-builder";

// V5 engines imports
import { runEvidenceSufficiency } from "../validation/evidence-sufficiency";
import { buildVerificationCrosswalk } from "../registry/verification-template-2025-2546";
import { generateFindingsAndActions } from "../validation/findings-engine";
import { assessReadiness } from "../validation/readiness-score";
import { buildPremiumDossierPdf } from "./premium-dossier-pdf";
import type { PremiumDossierViewModel } from "./premium-dossier-schema";

export const REQUIRED_TOP_LEVEL_COMPONENTS = [
  "Product and Scope Definition.pdf",
  "CN Code Classification.pdf",
  "Data Request Checklist.pdf",
  "Monitoring Plan Summary.pdf",
  "Process Map.pdf",
  "System Boundary.pdf",
  "Source Stream Register.csv",
  "Emission Source Register.csv",
  "Meter Register.csv",
  "Activity Data Ledger.csv",
  "Evidence Register.csv",
  "Field Evidence Matrix.csv",
  "Methodology Decision Log.pdf",
  "Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
  "Operator Summary Statement.pdf",
  "Verification Readiness Assessment.pdf",
  "Misstatement Register.csv",
  "Corrective Action Log.csv",
  "O3CI Field Mapping.csv",
  "Calculation Trace.json",
  "Data Integrity Manifest.json",
  "Manifest Signature.sig",
  "Units and Conversions Register.csv",
  "Carbon Price Register.csv",
  "Verifier Workspace.xlsx",
  "Supporting_Evidence/",
] as const;

export const REQUIRED_TOP_LEVEL_COMPONENTS_V5 = [
  "Product Scope Assessment.pdf",
  "CN Code Reasoning.pdf",
  "Required Data Checklist.pdf",
  "Installation Monitoring Plan.pdf",
  "Production Process Map.pdf",
  "System Boundary Register.pdf",
  "Source Stream Register.csv",
  "Emission Source Register.csv",
  "Measurement and Meter Register.csv",
  "Activity Data Ledger.csv",
  "Evidence Register.csv",
  "Field-to-Evidence Matrix.csv",
  "Methodology Decision Log.pdf",
  "Embedded Emissions Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
  "Misstatement and Non-Conformity Register.csv",
  "Corrective Action Log.csv",
  "O3CI Field Mapping.csv",
  "Calculation Trace.json",
  "Verifier Workspace.xlsx",
  "Data Integrity Manifest.json",
  "Manifest Signature.sig",
  "Supporting_Evidence/",
] as const;

export type EvidenceBinary = { evidenceId: string; fileName: string; bytes: Buffer };
export type PackageArtifact = { path: string; bytes: Buffer; mediaType: string };

type ManifestFile = { path: string; sha256: string; sizeBytes: number; mediaType: string };
export type DataIntegrityManifest = {
  schemaVersion: "CBAMVALID-DOSSIER-4.0" | "CBAMVALID-DOSSIER-5.0";
  reportId: string;
  caseId: string;
  releaseVersion: number;
  generatedAt: string;
  ruleset: string;
  engineVersion: string;
  calculationRootHash: string;
  legalSourceRegistryHash: string;
  componentContract: { requiredTopLevelComponents: readonly string[]; requiredCount: number };
  files: ManifestFile[];
  evidenceCount: number;
  signatureScope: "EXACT_UTF8_BYTES_OF_THIS_MANIFEST";
};

function hash(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]): Buffer {
  return Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
}

function artifact(path: string, bytes: Buffer, mediaType: string): PackageArtifact {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    throw new Error(`PACKAGE_PATH_INVALID:${path}`);
  }
  return { path, bytes, mediaType };
}

function supportedEvidencePath(item: EvidenceBinary): string {
  const fileName = item.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || "evidence.bin";
  return `Supporting_Evidence/${item.evidenceId}/${fileName}`;
}

function legalSourceTable(model: VerifierPackageModel) {
  return {
    headers: ["Source", "CELEX", "Applies from", "Methodology scope"],
    widths: [33, 22, 25, 100],
    rows: model.legalSources.map((source) => [
      source.id,
      source.celexId,
      source.appliesFrom,
      source.methodologyScope.join("; "),
    ]),
  };
}

function identityTable(model: VerifierPackageModel) {
  return {
    headers: ["Field", "Value"],
    widths: [45, 135],
    rows: [
      ["Importer", model.identity.importer],
      ["EORI", model.identity.eori],
      ["Exporter / operator", model.identity.exporterOperator],
      ["Installation", model.identity.installation],
      ["Country", model.identity.country],
      ["Production route", model.identity.productionRoute],
      ["Reporting period", model.identity.reportingPeriod],
    ],
  };
}

function goodsTable(model: VerifierPackageModel) {
  return {
    headers: ["Good", "CN", "Sector", "Production t", "Share", "Allocated tCO2e", "Specific tCO2e/t", "5% materiality tCO2e/t"],
    widths: [12, 20, 32, 22, 18, 25, 26, 25],
    rows: model.goods.map((good) => [
      good.goodIndex,
      good.cnCode,
      good.sector,
      good.productionVolume,
      good.allocationShare,
      good.allocatedEmbeddedEmissions,
      good.specificEmbeddedEmissions,
      good.materialityThresholdSpecific,
    ]),
  };
}

function qualityTable(model: VerifierPackageModel) {
  return {
    headers: ["Rule", "Control", "Status", "Finding", "Remediation"],
    widths: [18, 43, 22, 67, 30],
    rows: model.qualityControls.map((control) => [
      control.ruleId,
      control.name,
      control.status,
      control.message || "No automated finding",
      control.remediationCode || "—",
    ]),
  };
}

function monitoringTable(model: VerifierPackageModel) {
  return {
    headers: ["Requirement", "Definitive-period monitoring-plan element", "Status", "Evidence / basis"],
    widths: [20, 76, 22, 62],
    rows: model.monitoringPlan.map((item) => [item.requirementId, item.requirement, item.status, item.evidence]),
  };
}

function buildPdfArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  model: VerifierPackageModel;
}): PackageArtifact[] {
  const { caseData, calculation, reportId, releaseVersion, generatedAt, model } = params;
  const pdfFile = (path: string, title: string, subtitle: string, sections: PdfSection[]) =>
    artifact(path, buildProfessionalPdf({ title, subtitle, model, sections }), "application/pdf");

  const evidenceRows = caseData.evidenceRegister.map((item) => [
    item.evidenceId,
    item.documentType,
    item.fileName,
    item.reviewStatus,
    item.supportStatus,
    item.malwareScanStatus,
    item.fileHash,
  ]);
  const methodRows = caseData.methodologyDecisions.map((item) => [
    item.topic,
    item.selectedMethod,
    item.reason,
    item.legalOrTechnicalBasis,
    item.reviewStatus,
    item.evidenceIds.join(" | "),
  ]);

  if (releaseVersion >= 5) {
    // V5 PDFs
    const sufficiency = runEvidenceSufficiency(caseData);
    const crosswalk = buildVerificationCrosswalk(caseData);
    const { findings, correctiveActions } = generateFindingsAndActions(caseData);
    const readiness = assessReadiness({ caseData, isDraft: false });

    const dossierModel: PremiumDossierViewModel = {
      schemaVersion: "CBAMVALID-DOSSIER-5.0",
      reportId: params.reportId,
      caseId: params.caseData.caseId || "",
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      documentTitle: "CBAMValid Verification Readiness & Evidence Assurance Dossier",
      legalBoundary: "This operator-prepared package supports preparation for independent CBAM review. It is not an independent verification opinion, a reasonable-assurance conclusion, a customs decision, an EU approval, a CBAM Registry submission, or a guarantee of acceptance.",
      identity: {
        importer: String(params.caseData.importerIdentity.legalName.value || ""),
        eori: String(params.caseData.importerIdentity.eoriNumber.value || ""),
        exporterOperator: String(params.caseData.exporterIdentity.legalName.value || ""),
        installation: String(params.caseData.installation.name.value || ""),
        country: String(params.caseData.installation.country.value || ""),
        productionRoute: String(params.caseData.installation.productionRoute.value || ""),
        reportingPeriod: `${params.caseData.reportingPeriod.year.value}-${params.caseData.reportingPeriod.quarter.value || "ANNUAL"}`,
        systemBoundary: params.caseData.installation.systemBoundaries || "",
      },
      scope: {
        sector: params.caseData.goods[0]?.sector || "UNKNOWN",
        processes: params.caseData.goods.map(g => g.sector),
        cnCodes: params.caseData.goods.map(g => String(g.cnCode.value || "")),
      },
      totals: model.totals,
      goods: model.goods as unknown as PremiumDossierViewModel["goods"],
      precursors: params.caseData.precursors.map(p => ({
        name: String(p.name.value || ""),
        quantity: String(p.quantity.value || ""),
        directEmissions: String(p.directEmissions.value || ""),
        indirectEmissions: String(p.indirectEmissions.value || ""),
        countryOfOrigin: String(p.countryOfOrigin.value || ""),
      })),
      readiness,
      findings,
      correctiveActions,
      evidenceSufficiency: sufficiency,
      requirementCrosswalk: crosswalk,
      calculationTrace: params.calculation.trace,
      manifestSummary: {
        totalFiles: 23,
        manifestHash: "",
        packageHash: "",
      },
    };

    return [
      pdfFile("Product Scope Assessment.pdf", "Product Scope Assessment", "Controlled scope, parties, reporting period and goods population", [
        { heading: "Controlled identity", table: identityTable(model) },
        { heading: "Goods population", table: goodsTable(model) },
        { heading: "Scope conclusion", callout: { label: "Automated readiness", value: model.automatedReadiness } },
        { heading: "Legal basis", table: legalSourceTable(model) },
      ]),
      pdfFile("CN Code Reasoning.pdf", "CN Code Reasoning", "CN-coded goods, sector mapping and customs-evidence traceability", [
        { heading: "Classification register", table: { headers: ["Good", "CN code", "Sector", "CN evidence", "Production evidence"], widths: [15, 28, 45, 46, 46], rows: caseData.goods.map((good, index) => [index + 1, good.cnCode.value, good.sector, good.cnCode.evidenceId || "MISSING", good.productionVolume.evidenceId || "MISSING"]) } },
        { heading: "Classification boundary", paragraphs: ["This document records the classification supplied in the sealed case. It does not replace a binding customs classification decision. Any disputed or uncertain CN code remains subject to customs review."] },
        { heading: "Definitive legal sources", table: legalSourceTable(model) },
      ]),
      pdfFile("Required Data Checklist.pdf", "Required Data Checklist", "Evidence request and gap-closure schedule for independent verification", [
        { heading: "Monitoring-plan requirements", table: monitoringTable(model) },
        { heading: "Automated control findings", table: qualityTable(model) },
        { heading: "Evidence coverage", table: { headers: ["Measure", "Result"], widths: [75, 105], rows: [["Registered evidence files", model.evidenceSummary.totalEvidenceFiles], ["Approved and malware-clean files", model.evidenceSummary.approvedCleanEvidenceFiles], ["Linked input fields", model.evidenceSummary.linkedInputCount], ["Linked calculation nodes", model.evidenceSummary.linkedCalculationCount], ["Coverage rate", `${model.evidenceSummary.coverageRate}%`], ["Duplicate hashes", model.evidenceSummary.duplicateHashCount]] } },
      ]),
      pdfFile("Installation Monitoring Plan.pdf", "Installation Monitoring Plan", "Definitive-period monitoring plan coverage and control-system evidence", [
        { heading: "Installation and boundary", paragraphs: [model.identity.systemBoundary, `Production route: ${model.identity.productionRoute}`] },
        { heading: "Minimum monitoring-plan elements", table: monitoringTable(model) },
        { heading: "Input hierarchy", table: { headers: ["Input", "Value", "Unit", "Source", "Evidence", "Method"], widths: [35, 24, 22, 25, 40, 34], rows: [["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "MISSING", caseData.directEmissions.measurementMethod || "NOT DOCUMENTED"], ["Electricity", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "MISSING", caseData.electricityConsumed.measurementMethod || "NOT DOCUMENTED"], ["Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "MISSING", caseData.gridEmissionFactor.measurementMethod || "NOT DOCUMENTED"]] } },
      ]),
      pdfFile("Production Process Map.pdf", "Production Process Map", "Controlled flow from source data to verifier review", [
        { heading: "End-to-end process", table: { headers: ["Stage", "Controlled activity", "Evidence / output"], widths: [20, 90, 70], rows: [["1", "Identify installation, operator, CN-coded goods and reporting period", "CASE and GOODS registers"], ["2", "Define production processes, source streams, boundaries and functional units", "Monitoring Plan and System Boundary"], ["3", "Capture direct, electricity and precursor data with approved evidence", "INPUTS, PRECURSORS and EVIDENCE"], ["4", "Apply unit conversions, allocation and embedded-emissions formulae", "CALCULATION_TRACE and root hash"], ["5", "Run evidence, methodology, reconciliation and integrity controls", "QUALITY_CONTROLS and MONITORING_PLAN"], ["6", "Apply per-good 5% materiality reference for verifier planning", "GOODS materiality columns"], ["7", "Freeze, hash, sign and commit immutable package", "Manifest, KMS signature and package hash"], ["8", "Independent accredited verifier performs review and records opinion", "VERIFIER_SIGN_OFF — initially NOT_REVIEWED"]] } },
        { heading: "Production-route context", paragraphs: model.sectorMethodologies.map((sector) => `${sector.displayName}: ${sector.defaultBoundaries}`) },
      ]),
      pdfFile("System Boundary Register.pdf", "System Boundary Register", "Installation boundary, sector methodology and included processes", [
        { heading: "Declared system boundary", callout: { label: "Boundary", value: model.identity.systemBoundary } },
        { heading: "Sector methodology", table: { headers: ["Sector", "Legal status", "Boundary", "Verification focus"], widths: [30, 24, 66, 60], rows: model.sectorMethodologies.map((sector) => [sector.displayName, sector.legalStatus, sector.defaultBoundaries, sector.verificationFocus.join("; ")]) } },
        { heading: "Boundary limitation", paragraphs: ["The sealed boundary is the operator-declared and evidence-linked preparation boundary. The independent verifier remains responsible for confirming conformity with the applicable sector-specific legal boundary."] },
      ]),
      pdfFile("Methodology Decision Log.pdf", "Methodology Decision Log", "Selected methods, rejected alternatives, legal basis and evidence", [
        { heading: "Decision register", table: { headers: ["Topic", "Selected method", "Reason", "Legal / technical basis", "Review", "Evidence"], widths: [26, 35, 38, 43, 18, 20], rows: methodRows.length ? methodRows : [["NO DECISION", "—", "No methodology decision recorded", "—", "GAP", "—"]] } },
        { heading: "Definitive legal basis", table: legalSourceTable(model) },
        { heading: "Review boundary", paragraphs: ["An ACCEPTED status means accepted within the operator preparation workflow. It is not an accredited verifier acceptance or legal approval."] },
      ]),
      pdfFile("Embedded Emissions Calculation Annex.pdf", "Embedded Emissions Calculation Annex", "Closed-form formula trace, units, precision and cryptographic provenance", [
        { heading: "Engine identity", table: { headers: ["Control", "Value"], widths: [48, 132], rows: [["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Calculation root hash", calculation.calculationRootHash], ["Allocation share total", calculation.allocationShareTotal], ["Allocation reconciliation delta", calculation.allocationReconciliationDelta]] } },
        { heading: "Formula trace", table: { headers: ["Formula", "Output", "Unit", "Calculation hash", "Warnings / assumptions"], widths: [43, 22, 20, 55, 40], rows: calculation.trace.map((item) => [item.formulaId, item.outputValue, item.outputUnit, item.calculationHash, [...item.warnings, ...item.assumptions].join("; ") || "None"] ) } },
        { heading: "Per-good reconciliation", table: goodsTable(model) },
      ]),
      artifact("Operator Emissions Report.pdf", buildPremiumDossierPdf(dossierModel), "application/pdf"),
    ];
  }

  return [
    pdfFile("Product and Scope Definition.pdf", "Product and Scope Definition", "Controlled scope, parties, reporting period and goods population", [
      { heading: "Controlled identity", table: identityTable(model) },
      { heading: "Goods population", table: goodsTable(model) },
      { heading: "Scope conclusion", callout: { label: "Automated readiness", value: model.automatedReadiness } },
      { heading: "Legal basis", table: legalSourceTable(model) },
    ]),
    pdfFile("CN Code Classification.pdf", "CN Code Classification", "CN-coded goods, sector mapping and customs-evidence traceability", [
      { heading: "Classification register", table: { headers: ["Good", "CN code", "Sector", "CN evidence", "Production evidence"], widths: [15, 28, 45, 46, 46], rows: caseData.goods.map((good, index) => [index + 1, good.cnCode.value, good.sector, good.cnCode.evidenceId || "MISSING", good.productionVolume.evidenceId || "MISSING"]) } },
      { heading: "Classification boundary", paragraphs: ["This document records the classification supplied in the sealed case. It does not replace a binding customs classification decision. Any disputed or uncertain CN code remains subject to customs review."] },
      { heading: "Definitive legal sources", table: legalSourceTable(model) },
    ]),
    pdfFile("Data Request Checklist.pdf", "Data Request Checklist", "Evidence request and gap-closure schedule for independent verification", [
      { heading: "Monitoring-plan requirements", table: monitoringTable(model) },
      { heading: "Automated control findings", table: qualityTable(model) },
      { heading: "Evidence coverage", table: { headers: ["Measure", "Result"], widths: [75, 105], rows: [["Registered evidence files", model.evidenceSummary.totalEvidenceFiles], ["Approved and malware-clean files", model.evidenceSummary.approvedCleanEvidenceFiles], ["Linked input fields", model.evidenceSummary.linkedInputCount], ["Linked calculation nodes", model.evidenceSummary.linkedCalculationCount], ["Coverage rate", `${model.evidenceSummary.coverageRate}%`], ["Duplicate hashes", model.evidenceSummary.duplicateHashCount]] } },
    ]),
    pdfFile("Monitoring Plan Summary.pdf", "Monitoring Plan Summary", "Definitive-period monitoring plan coverage and control-system evidence", [
      { heading: "Installation and boundary", paragraphs: [model.identity.systemBoundary, `Production route: ${model.identity.productionRoute}`] },
      { heading: "Minimum monitoring-plan elements", table: monitoringTable(model) },
      { heading: "Input hierarchy", table: { headers: ["Input", "Value", "Unit", "Source", "Evidence", "Method"], widths: [35, 24, 22, 25, 40, 34], rows: [["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId || "MISSING", caseData.directEmissions.measurementMethod || "NOT DOCUMENTED"], ["Electricity", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId || "MISSING", caseData.electricityConsumed.measurementMethod || "NOT DOCUMENTED"], ["Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId || "MISSING", caseData.gridEmissionFactor.measurementMethod || "NOT DOCUMENTED"]] } },
    ]),
    pdfFile("Process Map.pdf", "Process Map", "Controlled flow from source data to verifier review", [
      { heading: "End-to-end process", table: { headers: ["Stage", "Controlled activity", "Evidence / output"], widths: [20, 90, 70], rows: [["1", "Identify installation, operator, CN-coded goods and reporting period", "CASE and GOODS registers"], ["2", "Define production processes, source streams, boundaries and functional units", "Monitoring Plan and System Boundary"], ["3", "Capture direct, electricity and precursor data with approved evidence", "INPUTS, PRECURSORS and EVIDENCE"], ["4", "Apply unit conversions, allocation and embedded-emissions formulae", "CALCULATION_TRACE and root hash"], ["5", "Run evidence, methodology, reconciliation and integrity controls", "QUALITY_CONTROLS and MONITORING_PLAN"], ["6", "Apply per-good 5% materiality reference for verifier planning", "GOODS materiality columns"], ["7", "Freeze, hash, sign and commit immutable package", "Manifest, KMS signature and package hash"], ["8", "Independent accredited verifier performs review and records opinion", "VERIFIER_SIGN_OFF — initially NOT_REVIEWED"]] } },
      { heading: "Production-route context", paragraphs: model.sectorMethodologies.map((sector) => `${sector.displayName}: ${sector.defaultBoundaries}`) },
    ]),
    pdfFile("System Boundary.pdf", "System Boundary", "Installation boundary, sector methodology and included processes", [
      { heading: "Declared system boundary", callout: { label: "Boundary", value: model.identity.systemBoundary } },
      { heading: "Sector methodology", table: { headers: ["Sector", "Legal status", "Boundary", "Verification focus"], widths: [30, 24, 66, 60], rows: model.sectorMethodologies.map((sector) => [sector.displayName, sector.legalStatus, sector.defaultBoundaries, sector.verificationFocus.join("; ")]) } },
      { heading: "Boundary limitation", paragraphs: ["The sealed boundary is the operator-declared and evidence-linked preparation boundary. The independent verifier remains responsible for confirming conformity with the applicable sector-specific legal boundary."] },
    ]),
    pdfFile("Methodology Decision Log.pdf", "Methodology Decision Log", "Selected methods, rejected alternatives, legal basis and evidence", [
      { heading: "Decision register", table: { headers: ["Topic", "Selected method", "Reason", "Legal / technical basis", "Review", "Evidence"], widths: [26, 35, 38, 43, 18, 20], rows: methodRows.length ? methodRows : [["NO DECISION", "—", "No methodology decision recorded", "—", "GAP", "—"]] } },
      { heading: "Definitive legal basis", table: legalSourceTable(model) },
      { heading: "Review boundary", paragraphs: ["An ACCEPTED status means accepted within the operator preparation workflow. It is not an accredited verifier acceptance or legal approval."] },
    ]),
    pdfFile("Calculation Annex.pdf", "Calculation Annex", "Closed-form formula trace, units, precision and cryptographic provenance", [
      { heading: "Engine identity", table: { headers: ["Control", "Value"], widths: [48, 132], rows: [["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Calculation root hash", calculation.calculationRootHash], ["Allocation share total", calculation.allocationShareTotal], ["Allocation reconciliation delta", calculation.allocationReconciliationDelta]] } },
      { heading: "Formula trace", table: { headers: ["Formula", "Output", "Unit", "Calculation hash", "Warnings / assumptions"], widths: [43, 22, 20, 55, 40], rows: calculation.trace.map((item) => [item.formulaId, item.outputValue, item.outputUnit, item.calculationHash, [...item.warnings, ...item.assumptions].join("; ") || "None"] ) } },
      { heading: "Per-good reconciliation", table: goodsTable(model) },
    ]),
    pdfFile("Operator Emissions Report.pdf", "Operator Emissions Report", "Definitive-period emissions statement prepared for independent verification review", [
      { heading: "Operator and installation", table: identityTable(model) },
      { heading: "Installation totals", table: { headers: ["Metric", "Value", "Unit"], widths: [90, 45, 45], rows: [["Installation direct emissions", model.totals.installationDirectEmissions, "tCO2e"], ["Electricity indirect emissions", model.totals.electricityIndirectEmissions, "tCO2e"], ["Precursor direct emissions", model.totals.precursorDirectEmissions, "tCO2e"], ["Precursor indirect emissions", model.totals.precursorIndirectEmissions, "tCO2e"], ["Total direct emissions", model.totals.totalDirectEmissions, "tCO2e"], ["Total indirect emissions", model.totals.totalIndirectEmissions, "tCO2e"], ["Total embedded emissions", model.totals.totalEmbeddedEmissions, "tCO2e"], ["Aggregate production", model.totals.productionVolume, "t"], ["Aggregate specific embedded emissions", model.totals.aggregateSpecificEmbeddedEmissions, "tCO2e/t"]] } },
      { heading: "Per-good emissions and materiality", table: goodsTable(model) },
      { heading: "Evidence and controls", table: { headers: ["Measure", "Result"], widths: [90, 90], rows: [["Automated readiness", model.automatedReadiness], ["Quality-control blockers", model.qualitySummary.blockers], ["Approved clean evidence", model.evidenceSummary.approvedCleanEvidenceFiles], ["Calculation trace nodes", model.calculationTraceCount], ["Independent verifier status", model.independentVerifierStatus]] } },
      { heading: "Legal boundary", callout: { label: "Important", value: model.disclaimer } },
    ]),
    pdfFile("Operator Summary Statement.pdf", "Operator Summary Statement", "Executive control statement for the sealed verifier-preparation package", [
      { heading: "Executive statement", paragraphs: [`Release ${releaseVersion} for case ${model.caseId} contains ${model.goods.length} CN-coded good(s), ${model.evidenceSummary.totalEvidenceFiles} evidence file(s), ${model.methodologyDecisionCount} methodology decision(s) and ${model.calculationTraceCount} cryptographically linked calculation node(s).`, `Automated preparation status: ${model.automatedReadiness}. Independent verifier status: ${model.independentVerifierStatus}.`] },
      { heading: "Key totals", table: { headers: ["Total embedded tCO2e", "Production t", "Specific tCO2e/t", "Evidence coverage", "QC blockers"], widths: [38, 32, 38, 34, 38], rows: [[model.totals.totalEmbeddedEmissions, model.totals.productionVolume, model.totals.aggregateSpecificEmbeddedEmissions, `${model.evidenceSummary.coverageRate}%`, model.qualitySummary.blockers]] } },
      { heading: "Trust chain", table: { headers: ["Control", "Value"], widths: [48, 132], rows: [["Calculation root", model.calculationRootHash], ["Legal source registry", model.ruleset.sourceHash], ["Report ID", reportId], ["Generated", generatedAt]] } },
      { heading: "Boundary", callout: { label: "No verification opinion", value: model.disclaimer } },
    ]),
    pdfFile("Verification Readiness Assessment.pdf", "Verification Readiness Assessment", "Risk-based automated readiness assessment and independent-verifier handoff", [
      { heading: "Readiness conclusion", callout: { label: "Automated status", value: `${model.automatedReadiness}. Passed ${model.qualitySummary.passed}; blockers ${model.qualitySummary.blockers}; warnings ${model.qualitySummary.warnings}; monitoring-plan gaps ${model.monitoringPlan.filter((item) => item.status === "GAP").length}.` } },
      { heading: "Quality controls", table: qualityTable(model) },
      { heading: "Monitoring-plan coverage", table: monitoringTable(model) },
      { heading: "Evidence register", table: { headers: ["Evidence ID", "Type", "File", "Review", "Support", "Malware", "SHA-256"], widths: [30, 28, 32, 18, 20, 18, 34], rows: evidenceRows.length ? evidenceRows : [["NONE", "—", "No evidence registered", "GAP", "GAP", "GAP", "—"]] } },
      { heading: "Materiality reference", paragraphs: [`For each tonne of each relevant good identified by CN code, the verifier applies a quantitative materiality level of ${model.ruleset.materialityRate}% of total specific embedded emissions. Expert judgement remains applicable below that threshold and for parameters outside the quantitative threshold.`] },
      { heading: "Independent-verifier handoff", paragraphs: ["The VERIFIER_SIGN_OFF worksheet is intentionally NOT_REVIEWED. Only the independent accredited verifier may complete verifier identity, accreditation, site-visit, reasonable-assurance, opinion and findings-closure fields."] },
    ]),
  ];
}

function buildCsvArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  model: VerifierPackageModel;
}): PackageArtifact[] {
  const { caseData, calculation, controls, model } = params;

  if (model.releaseVersion >= 5) {
    // V5 CSVs
    return [
      artifact("Source Stream Register.csv", csv([["Stream ID", "Name", "Country", "Quantity", "Quantity unit", "Direct tCO2e", "Indirect tCO2e", "Quantity evidence", "Direct evidence", "Indirect evidence"], ...caseData.precursors.map((item, index) => [`P${index + 1}`, item.name.value, item.countryOfOrigin.value, item.quantity.value, item.quantity.canonicalUnit, item.directEmissions.value, item.indirectEmissions.value, item.quantity.evidenceId, item.directEmissions.evidenceId, item.indirectEmissions.evidenceId])]), "text/csv"),
      artifact("Emission Source Register.csv", csv([["Source", "Value", "Unit", "Source type", "Evidence ID", "Measurement method", "Responsible person"], ["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId, caseData.directEmissions.measurementMethod, caseData.directEmissions.responsiblePerson], ["Electricity", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId, caseData.electricityConsumed.measurementMethod, caseData.electricityConsumed.responsiblePerson], ["Grid factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId, caseData.gridEmissionFactor.measurementMethod, caseData.gridEmissionFactor.responsiblePerson]]), "text/csv"),
      artifact("Measurement and Meter Register.csv", csv([["Input", "Measurement method", "Document reference", "Responsible person", "Evidence ID"], ["Direct emissions", caseData.directEmissions.measurementMethod, caseData.directEmissions.documentReference, caseData.directEmissions.responsiblePerson, caseData.directEmissions.evidenceId], ["Electricity", caseData.electricityConsumed.measurementMethod, caseData.electricityConsumed.documentReference, caseData.electricityConsumed.responsiblePerson, caseData.electricityConsumed.evidenceId], ["Grid emission factor", caseData.gridEmissionFactor.measurementMethod, caseData.gridEmissionFactor.documentReference, caseData.gridEmissionFactor.responsiblePerson, caseData.gridEmissionFactor.evidenceId]]), "text/csv"),
      artifact("Activity Data Ledger.csv", csv([["Good", "CN", "Sector", "Production t", "Allocation share", "Allocated direct tCO2e", "Allocated indirect tCO2e", "Allocated precursor tCO2e", "Allocated embedded tCO2e", "Specific tCO2e/t", "5% materiality tCO2e/t", "Trace ID"], ...model.goods.map((good) => { const result = calculation.goods[good.goodIndex - 1]; return [good.goodIndex, good.cnCode, good.sector, good.productionVolume, good.allocationShare, result.allocatedDirectEmissions, result.allocatedIndirectEmissions, result.allocatedPrecursorEmissions, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions, good.materialityThresholdSpecific, good.traceCalculationId]; })]), "text/csv"),
      artifact("Evidence Register.csv", csv([["Evidence ID", "Type", "File", "Storage path", "Issuer", "Issue date", "Reporting period", "SHA-256", "Bytes", "Review", "Support", "Malware", "Confidentiality", "Reviewer notes"], ...caseData.evidenceRegister.map((item) => [item.evidenceId, item.documentType, item.fileName, item.storagePath, item.issuer, item.issueDate, item.reportingPeriod, item.fileHash, item.sizeBytes, item.reviewStatus, item.supportStatus, item.malwareScanStatus, item.confidentiality, item.reviewerNotes])]), "text/csv"),
      artifact("Field-to-Evidence Matrix.csv", csv([["Evidence ID", "Linked input", "Linked calculations", "Review", "Support", "Malware"], ...caseData.evidenceRegister.flatMap((item) => item.linkedInputs.map((input) => [item.evidenceId, input, item.linkedCalculations.join(" | "), item.reviewStatus, item.supportStatus, item.malwareScanStatus]))]), "text/csv"),
      artifact("Misstatement and Non-Conformity Register.csv", csv([["Rule", "Issue", "Status", "Message", "Materiality reference"], ...controls.filter((item) => item.status !== "PASS" && item.status !== "NOT_APPLICABLE").map((item) => [item.ruleId, item.name, item.status, item.message, `${model.ruleset.materialityRate}% per-good specific emissions plus expert judgement`])]), "text/csv"),
      artifact("Corrective Action Log.csv", csv([["Rule", "Remediation code", "Required action", "State", "Responsible party", "Target date", "Closure evidence"], ...controls.filter((item) => item.status === "BLOCKER" || item.status === "WARNING").map((item) => [item.ruleId, item.remediationCode, item.message, "OPEN", "OPERATOR", "", ""])]), "text/csv"),
      artifact("O3CI Field Mapping.csv", csv([["Dossier field", "O3CI concept", "Value / reference"], ["caseId", "CASE_IDENTIFIER", caseData.caseId], ["reportingPeriod", "REPORTING_PERIOD", model.identity.reportingPeriod], ["installation", "INSTALLATION", model.identity.installation], ["goods[].cnCode", "GOODS_CLASSIFICATION", model.goods.map((item) => item.cnCode).join(" | ")], ["totalEmbeddedEmissions", "TOTAL_EMBEDDED_EMISSIONS", model.totals.totalEmbeddedEmissions], ["calculationRootHash", "CALCULATION_PROVENANCE", calculation.calculationRootHash], ["legalSourceRegistryHash", "LEGAL_SOURCE_PROVENANCE", model.ruleset.sourceHash]]), "text/csv"),
    ];
  }

  return [
    artifact("Source Stream Register.csv", csv([["Stream ID", "Name", "Country", "Quantity", "Quantity unit", "Direct tCO2e", "Indirect tCO2e", "Quantity evidence", "Direct evidence", "Indirect evidence"], ...caseData.precursors.map((item, index) => [`P${index + 1}`, item.name.value, item.countryOfOrigin.value, item.quantity.value, item.quantity.canonicalUnit, item.directEmissions.value, item.indirectEmissions.value, item.quantity.evidenceId, item.directEmissions.evidenceId, item.indirectEmissions.evidenceId])]), "text/csv"),
    artifact("Emission Source Register.csv", csv([["Source", "Value", "Unit", "Source type", "Evidence ID", "Measurement method", "Responsible person"], ["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId, caseData.directEmissions.measurementMethod, caseData.directEmissions.responsiblePerson], ["Electricity", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId, caseData.electricityConsumed.measurementMethod, caseData.electricityConsumed.responsiblePerson], ["Grid factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId, caseData.gridEmissionFactor.measurementMethod, caseData.gridEmissionFactor.responsiblePerson]]), "text/csv"),
    artifact("Meter Register.csv", csv([["Input", "Measurement method", "Document reference", "Responsible person", "Evidence ID"], ["Direct emissions", caseData.directEmissions.measurementMethod, caseData.directEmissions.documentReference, caseData.directEmissions.responsiblePerson, caseData.directEmissions.evidenceId], ["Electricity", caseData.electricityConsumed.measurementMethod, caseData.electricityConsumed.documentReference, caseData.electricityConsumed.responsiblePerson, caseData.electricityConsumed.evidenceId], ["Grid emission factor", caseData.gridEmissionFactor.measurementMethod, caseData.gridEmissionFactor.documentReference, caseData.gridEmissionFactor.responsiblePerson, caseData.gridEmissionFactor.evidenceId]]), "text/csv"),
    artifact("Activity Data Ledger.csv", csv([["Good", "CN", "Sector", "Production t", "Allocation share", "Allocated direct tCO2e", "Allocated indirect tCO2e", "Allocated precursor tCO2e", "Allocated embedded tCO2e", "Specific tCO2e/t", "5% materiality tCO2e/t", "Trace ID"], ...model.goods.map((good) => { const result = calculation.goods[good.goodIndex - 1]; return [good.goodIndex, good.cnCode, good.sector, good.productionVolume, good.allocationShare, result.allocatedDirectEmissions, result.allocatedIndirectEmissions, result.allocatedPrecursorEmissions, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions, good.materialityThresholdSpecific, good.traceCalculationId]; })]), "text/csv"),
    artifact("Evidence Register.csv", csv([["Evidence ID", "Type", "File", "Storage path", "Issuer", "Issue date", "Reporting period", "SHA-256", "Bytes", "Review", "Support", "Malware", "Confidentiality", "Reviewer notes"], ...caseData.evidenceRegister.map((item) => [item.evidenceId, item.documentType, item.fileName, item.storagePath, item.issuer, item.issueDate, item.reportingPeriod, item.fileHash, item.sizeBytes, item.reviewStatus, item.supportStatus, item.malwareScanStatus, item.confidentiality, item.reviewerNotes])]), "text/csv"),
    artifact("Field Evidence Matrix.csv", csv([["Evidence ID", "Linked input", "Linked calculations", "Review", "Support", "Malware"], ...caseData.evidenceRegister.flatMap((item) => item.linkedInputs.map((input) => [item.evidenceId, input, item.linkedCalculations.join(" | "), item.reviewStatus, item.supportStatus, item.malwareScanStatus]))]), "text/csv"),
    artifact("Misstatement Register.csv", csv([["Rule", "Issue", "Status", "Message", "Materiality reference"], ...controls.filter((item) => item.status !== "PASS" && item.status !== "NOT_APPLICABLE").map((item) => [item.ruleId, item.name, item.status, item.message, `${model.ruleset.materialityRate}% per-good specific emissions plus expert judgement`])]), "text/csv"),
    artifact("Corrective Action Log.csv", csv([["Rule", "Remediation code", "Required action", "State", "Responsible party", "Target date", "Closure evidence"], ...controls.filter((item) => item.status === "BLOCKER" || item.status === "WARNING").map((item) => [item.ruleId, item.remediationCode, item.message, "OPEN", "OPERATOR", "", ""])]), "text/csv"),
    artifact("O3CI Field Mapping.csv", csv([["Dossier field", "O3CI concept", "Value / reference"], ["caseId", "CASE_IDENTIFIER", caseData.caseId], ["reportingPeriod", "REPORTING_PERIOD", model.identity.reportingPeriod], ["installation", "INSTALLATION", model.identity.installation], ["goods[].cnCode", "GOODS_CLASSIFICATION", model.goods.map((item) => item.cnCode).join(" | ")], ["totalEmbeddedEmissions", "TOTAL_EMBEDDED_EMISSIONS", model.totals.totalEmbeddedEmissions], ["calculationRootHash", "CALCULATION_PROVENANCE", calculation.calculationRootHash], ["legalSourceRegistryHash", "LEGAL_SOURCE_PROVENANCE", model.ruleset.sourceHash]]), "text/csv"),
    artifact("Units and Conversions Register.csv", csv([["Field", "Raw unit", "Canonical unit", "Conversion", "Precision policy"], ...caseData.goods.map((good, index) => [`goods.${index}.productionVolume`, good.productionVolume.rawUnit, good.productionVolume.canonicalUnit, good.productionVolume.rawUnit === "kg" ? "divide by 1000" : "identity", "Decimal.js precision 34; presentation rounding only except per-good six decimals" ]), ["directEmissions", caseData.directEmissions.rawUnit, caseData.directEmissions.canonicalUnit, "identity", "No intermediate binary floating-point arithmetic"], ["electricityConsumed", caseData.electricityConsumed.rawUnit, caseData.electricityConsumed.canonicalUnit, "identity", "No intermediate binary floating-point arithmetic"], ["gridEmissionFactor", caseData.gridEmissionFactor.rawUnit, caseData.gridEmissionFactor.canonicalUnit, "identity", "No intermediate binary floating-point arithmetic"]]), "text/csv"),
    artifact("Carbon Price Register.csv", csv([["ID", "Amount paid", "Applicable emissions", "Currency", "Period", "Legislation", "Payment evidence", "Certification evidence", "Conversion method", "Eligible reduction"], ...caseData.carbonPriceRecords.map((item) => [item.id, item.amountPaid, item.applicableEmissions, item.currency, item.paymentPeriod, item.legislationReference, item.proofOfPaymentEvidenceId, item.independentCertificationEvidenceId, item.conversionMethod, item.eligibleCertificateReduction])]), "text/csv"),
  ];
}

export async function buildUnsignedVerifierArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  evidenceFiles: EvidenceBinary[];
}): Promise<PackageArtifact[]> {
  const model = buildVerifierPackageModel(params);
  const workbook = await buildVerifierWorkbook({ ...params, model });

  const artifacts = [
    ...buildPdfArtifacts({ ...params, model }),
    ...buildCsvArtifacts({ ...params, model }),
    artifact("Calculation Trace.json", Buffer.from(canonical({ reportId: params.reportId, caseId: params.caseData.caseId, generatedAt: params.generatedAt, verifierModel: model, calculation: params.calculation }), "utf8"), "application/json"),
    artifact("Verifier Workspace.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    artifact("Supporting_Evidence/README.txt", Buffer.from(`CBAMValid immutable evidence copies\r\nReport: ${params.reportId}\r\nCase: ${params.caseData.caseId}\r\nEvidence count: ${params.evidenceFiles.length}\r\nEach binary is verified against Evidence Register.csv and Data Integrity Manifest.json.\r\n`, "utf8"), "text/plain"),
    ...params.evidenceFiles.map((item) => artifact(supportedEvidencePath(item), item.bytes, "application/octet-stream")),
  ];
  const paths = artifacts.map((item) => item.path);
  if (new Set(paths).size !== paths.length) throw new Error("PACKAGE_DUPLICATE_PATH");
  return artifacts;
}

export function buildDataIntegrityManifest(params: {
  artifacts: PackageArtifact[];
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  evidenceCount: number;
}): { manifest: DataIntegrityManifest; bytes: Buffer } {
  const isV5 = params.releaseVersion >= 5;
  const manifest: DataIntegrityManifest = {
    schemaVersion: isV5 ? "CBAMVALID-DOSSIER-5.0" : "CBAMVALID-DOSSIER-4.0",
    reportId: params.reportId,
    caseId: params.caseData.caseId || "",
    releaseVersion: params.releaseVersion,
    generatedAt: params.generatedAt,
    ruleset: params.calculation.ruleset,
    engineVersion: params.calculation.engineVersion,
    calculationRootHash: params.calculation.calculationRootHash,
    legalSourceRegistryHash: DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT,
    componentContract: {
      requiredTopLevelComponents: isV5 ? REQUIRED_TOP_LEVEL_COMPONENTS_V5 : REQUIRED_TOP_LEVEL_COMPONENTS,
      requiredCount: isV5 ? 23 : 27,
    },
    files: params.artifacts.map((item) => ({ path: item.path, sha256: hash(item.bytes), sizeBytes: item.bytes.byteLength, mediaType: item.mediaType })).sort((left, right) => left.path.localeCompare(right.path)),
    evidenceCount: params.evidenceCount,
    signatureScope: "EXACT_UTF8_BYTES_OF_THIS_MANIFEST",
  };
  return { manifest, bytes: Buffer.from(canonical(manifest), "utf8") };
}

function topLevelComponents(paths: string[]): string[] {
  const components = new Set<string>();
  for (const path of paths) {
    const slash = path.indexOf("/");
    components.add(slash >= 0 ? `${path.slice(0, slash)}/` : path);
  }
  return [...components].sort();
}

export async function finalizeVerifierPackage(params: {
  artifacts: PackageArtifact[];
  manifestBytes: Buffer;
  signature: KmsSignatureResult;
  generatedAt: string;
}): Promise<{ zip: Buffer; zipHash: string; primaryPdf: Buffer; workbook: Buffer; signatureBytes: Buffer }> {
  if (hash(params.manifestBytes) !== params.signature.manifestHash) throw new Error("PACKAGE_MANIFEST_SIGNATURE_HASH_MISMATCH");
  const signatureBuffer = Buffer.from(canonical(params.signature), "utf8");
  if (!crypto.verify("sha256", params.manifestBytes, params.signature.publicKeyPem, Buffer.from(params.signature.signatureBase64, "base64"))) throw new Error("PACKAGE_SIGNATURE_VERIFICATION_FAILED");

  const allArtifacts = [
    ...params.artifacts,
    artifact("Data Integrity Manifest.json", params.manifestBytes, "application/json"),
    artifact("Manifest Signature.sig", signatureBuffer, "application/vnd.cbamvalid.kms-signature+json"),
  ];
  const manifest = JSON.parse(params.manifestBytes.toString("utf8")) as DataIntegrityManifest;
  const isV5 = manifest.schemaVersion === "CBAMVALID-DOSSIER-5.0";

  const topLevel = topLevelComponents(allArtifacts.map((item) => item.path));
  const expected = isV5 ? [...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort() : [...REQUIRED_TOP_LEVEL_COMPONENTS].sort();
  const targetCount = isV5 ? 23 : 27;

  if (topLevel.length !== targetCount || canonical(topLevel) !== canonical(expected)) {
    throw new Error(`PACKAGE_COMPONENT_CONTRACT_FAILED:${topLevel.join("|")}`);
  }

  const zip = new JSZip();
  const date = new Date(params.generatedAt);
  zip.folder("Supporting_Evidence");
  for (const item of allArtifacts) zip.file(item.path, item.bytes, { date, createFolders: true });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });

  const reopened = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const reopenedTopLevel = topLevelComponents(Object.keys(reopened.files).filter((path) => !reopened.files[path].dir || path === "Supporting_Evidence/"));
  if (canonical(reopenedTopLevel) !== canonical(expected)) throw new Error("PACKAGE_REOPEN_COMPONENT_CONTRACT_FAILED");
  
  if (manifest.schemaVersion !== (isV5 ? "CBAMVALID-DOSSIER-5.0" : "CBAMVALID-DOSSIER-4.0") || manifest.legalSourceRegistryHash !== DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT) {
    throw new Error("PACKAGE_MANIFEST_REGULATORY_PROVENANCE_INVALID");
  }
  for (const file of manifest.files) {
    const entry = reopened.file(file.path);
    if (!entry) throw new Error(`PACKAGE_REOPEN_FILE_MISSING:${file.path}`);
    const bytes = await entry.async("nodebuffer");
    if (bytes.byteLength !== file.sizeBytes || hash(bytes) !== file.sha256) throw new Error(`PACKAGE_REOPEN_HASH_MISMATCH:${file.path}`);
  }
  const reopenedManifest = await reopened.file("Data Integrity Manifest.json")?.async("nodebuffer");
  const reopenedSignature = await reopened.file("Manifest Signature.sig")?.async("nodebuffer");
  if (!reopenedManifest || !reopenedSignature || !reopenedManifest.equals(params.manifestBytes) || !reopenedSignature.equals(signatureBuffer)) throw new Error("PACKAGE_REOPEN_TRUST_COMPONENT_MISMATCH");
  if (!crypto.verify("sha256", reopenedManifest, params.signature.publicKeyPem, Buffer.from(params.signature.signatureBase64, "base64"))) throw new Error("PACKAGE_REOPEN_SIGNATURE_INVALID");

  const primaryPdf = allArtifacts.find((item) => item.path === "Operator Emissions Report.pdf")?.bytes;
  const workbook = allArtifacts.find((item) => item.path === "Verifier Workspace.xlsx")?.bytes;
  if (!primaryPdf || !workbook || primaryPdf.byteLength < 5000 || workbook.byteLength < 5000) throw new Error("PACKAGE_PRIMARY_ARTIFACT_MISSING_OR_TRIVIAL");
  return { zip: buffer, zipHash: hash(buffer), primaryPdf, workbook, signatureBytes: signatureBuffer };
}
