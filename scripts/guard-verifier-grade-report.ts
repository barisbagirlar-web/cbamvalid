import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildVerifierPreparationPackage } from "../functions/src/cbam/report/verifier-package-builder";
import { performDossierCalculations } from "../functions/src/cbam/calculator";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls";
import { validatePackageContract } from "../functions/src/cbam/report/package-contract-validator";
import type { AuditReadyCase } from "../functions/src/cbam/schema";

const root = process.cwd();
const failures: string[] = [];

function read(relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing verifier-grade component: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source: string, expected: string, message: string) {
  if (!source.includes(expected)) failures.push(message);
}

function requirePattern(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(source)) failures.push(message);
}

const serverSchema = read("functions/src/cbam/schema.ts");
const clientSchema = read("lib/cbam/schema.ts");
const serverCalculator = read("functions/src/cbam/calculator.ts");
const clientCalculator = read("lib/cbam/calculator.ts");
const serverQc = read("functions/src/cbam/validation/quality-controls.ts");
const clientQc = read("lib/cbam/validation/quality-controls.ts");
const qualityContract = read("functions/src/cbam/report/report-quality-contract.ts");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const sealService = read("functions/src/cbam/report/seal-service.ts");
const wizard = read("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
const reportTest = read("tests/reports/verifier-package.test.ts");
const calculationTest = read("tests/cbam-engine/verifier-grade-calculation.test.ts");

for (const [source, name] of [[serverSchema, "server"], [clientSchema, "client"]]) {
  requireText(source, "allocationShare", `${name} dossier schema does not expose per-good allocationShare`);
}
requireText(clientSchema, '"fraction"', "Client schema does not define the canonical allocation fraction unit");

for (const [source, name] of [[serverCalculator, "server"], [clientCalculator, "client preview"]]) {
  requireText(source, "allocationReconciliationDelta", `${name} calculation does not expose allocation reconciliation`);
  requireText(source, "specificEmbeddedEmissions", `${name} calculation does not expose per-good intensity`);
  requireText(source, "goods", `${name} calculation does not expose per-good results`);
}
requireText(serverCalculator, "CALCULATION_INPUT_REQUIRED", "Server calculation does not fail closed on missing material inputs");
requireText(serverCalculator, "CBAM_GOODS_ALLOCATION_RECONCILIATION", "Server calculation trace lacks goods-allocation reconciliation node");
requireText(serverCalculator, "ROUND_HALF_UP", "Server calculation rounding policy is not explicit");
requireText(serverCalculator, "kg", "Server calculation lacks kg-to-tonne conversion support");

for (const [source, name] of [[serverQc, "server"], [clientQc, "client"]]) {
  requireText(source, 'reviewStatus === "APPROVED"', `${name} quality controls do not require internal evidence approval`);
  requireText(source, "GOODS_EMISSIONS_ALLOCATION", `${name} quality controls do not govern allocation methodology`);
  requireText(source, "PRECURSOR_SCOPE", `${name} quality controls do not govern precursor scope`);
  requireText(source, "ALLOCATION_TOLERANCE", `${name} quality controls do not reconcile allocation shares`);
}

requireText(qualityContract, 'REPORT_STANDARD_VERSION = "CBAMVALID-VGRS-1.0"', "Verifier-grade report standard version is missing");
requireText(qualityContract, "REPORT_EVIDENCE_COVERAGE_INCOMPLETE", "Report quality contract lacks evidence coverage gate");
requireText(qualityContract, "REPORT_CALCULATION_TRACE_INCOMPLETE", "Report quality contract lacks calculation trace gate");
requireText(qualityContract, "REPORT_ALLOCATION_NOT_RECONCILED", "Report quality contract lacks allocation reconciliation gate");
requireText(qualityContract, "REPORT_MATERIAL_FINDINGS_OPEN", "Report quality contract lacks open-material-finding gate");

requireText(packageBuilder, "assessVerifierGradeReport", "Package builder is not connected to the report quality contract");
requirePattern(
  packageBuilder,
  /reportQualityAssessment\.status\s*!==\s*["']PASS["'][\s\S]{0,300}?throw\s+new\s+Error\s*\(/,
  "Package builder does not fail closed on report-quality failure"
);
requireText(packageBuilder, "Executive Verification Readiness Summary", "Executive verification readiness summary is missing");
requireText(packageBuilder, "Operator Emissions Report", "Operator emissions report is missing");
requirePattern(
  packageBuilder,
  /OPERATOR PREPARATION\s+—\s+VERIFIER COMPLETION REQUIRED[\s\S]{0,5000}?independent accredited verifier/i,
  "Operator report lacks an explicit accredited-verifier completion boundary"
);
requireText(packageBuilder, "Per-Good Embedded Emissions Schedule", "Dedicated per-good embedded emissions schedule is missing");
requireText(packageBuilder, "Carbon Price Paid Schedule", "Carbon price paid schedule is missing");
requireText(packageBuilder, "Read-Me and Verifier Navigation Guide", "Verifier navigation guide is missing");
requirePattern(
  packageBuilder,
  /Verification Readiness Assessment[\s\S]{0,2500}?(?:Quality controls|Report-quality issues)[\s\S]{0,2500}?(?:Remediation|Required remediation)/i,
  "Readiness report lacks a structured external-verifier challenge and remediation frame"
);
requireText(packageBuilder, "topLevelComponentCount: PACKAGE_COMPONENTS.length", "Manifest does not lock topLevelComponentCount to PACKAGE_COMPONENTS.length");
requireText(packageBuilder, "reportQualityAssessment.status", "Package verification does not require report-quality PASS");

requireText(sealService, "buildVerifierPreparationPackage", "Seal service is not integrated with the verifier package builder");
requireText(sealService, "CALCULATION_TRACE_INCOMPLETE", "Seal service does not validate calculation trace completeness");
requireText(sealService, "packageTopLevelComponentCount: 27", "Seal metadata does not record the 27-component package contract");

requireText(wizard, "Emissions allocation share", "User workflow does not expose per-good allocation shares");
requireText(wizard, "Approve for Internal Dossier Use", "User workflow lacks explicit evidence review and approval");
requireText(wizard, "Methodology decision register", "User workflow lacks methodology decision capture");
requireText(wizard, "allocationReconciliationDelta", "User workflow lacks allocation reconciliation feedback");
requireText(wizard, "per-good results", "User workflow lacks per-good result framing");

requireText(reportTest, "reportQualityAssessment.status", "Report tests do not assert report-quality PASS");
requireText(reportTest, "27", "Report tests do not assert the 27-component contract");

requireText(calculationTest, "CALCULATION_ALLOCATION_NOT_RECONCILED", "Calculation tests do not cover allocation mismatch");
requireText(calculationTest, "exactly once", "Calculation tests do not document double-counting protection");
requireText(calculationTest, "deterministic", "Calculation tests do not cover deterministic hashes");

const prohibitedPositiveClaims = [
  /CBAMValid\s+(?:is|acts as)\s+an?\s+accredited verifier/i,
  /guarantees?\s+(?:EU|customs|Registry)\s+approval/i,
  /official\s+CBAM\s+Registry\s+(?:XML|submission)/i,
];
for (const [file, content] of [
  ["functions/src/cbam/report/verifier-package-builder.ts", packageBuilder],
  ["app/(workspace)/cases/[caseId]/CaseWizardClient.tsx", wizard],
]) {
  for (const pattern of prohibitedPositiveClaims) {
    if (pattern.test(content)) failures.push(`${file}: prohibited compliance claim matched ${pattern}`);
  }
}

// Runtime check utilizing our steel case fixture to verify builder + validator pipeline
const EVIDENCE_BYTES = Buffer.concat([
  Buffer.from("%PDF-1.4\nmock-evidence-content"),
  Buffer.alloc(200, 32)
]);
const EVIDENCE_HASH = crypto.createHash("sha256").update(EVIDENCE_BYTES).digest("hex");

function input(value: string, unit?: string, evidenceId?: string) {
  return {
    value,
    canonicalUnit: unit,
    sourceType: evidenceId ? ("PRIMARY" as const) : ("REGULATORY" as const),
    confidenceStatus: evidenceId ? ("HIGH_VERIFIED" as const) : ("MEDIUM_DOCUMENTED" as const),
    evidenceId,
  };
}

function fixture(): AuditReadyCase {
  const evidenceId = "d81bb1d1-7f34-4ec9-a168-0cbe184cb037";
  const linkedInputs = [
    "importerIdentity.eoriNumber",
    "goods.0.cnCode",
    "goods.0.productionVolume",
    "directEmissions",
    "electricityConsumed",
    "gridEmissionFactor",
  ];
  return {
    caseId: "case_fixture_001",
    status: "VERIFICATION_READY",
    version: 1,
    ownerId: "user_fixture_001",
    importerIdentity: {
      legalName: input("Example EU Importer"),
      eoriNumber: input("DE12345678901234", undefined, evidenceId),
    },
    exporterIdentity: { legalName: input("Example Exporter") },
    reportingPeriod: { year: input("2026"), quarter: input("Annual") },
    goods: [{
      cnCode: input("72081000", undefined, evidenceId),
      sector: "IRON_AND_STEEL",
      productionVolume: input("100", "t", evidenceId),
      shipmentRecords: input("100", "t", evidenceId),
    }],
    installation: {
      name: input("Example Mill"),
      country: input("TR"),
      productionRoute: input("Electric Arc Furnace Route"),
      systemBoundaries: "Scrap receipt, melting, refining, casting and rolling; external transport excluded.",
    },
    directEmissions: input("40", "tCO2e", evidenceId),
    electricityConsumed: input("100", "MWh", evidenceId),
    gridEmissionFactor: input("0.4", "tCO2e/MWh", evidenceId),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [{
      evidenceId,
      documentType: "CONSOLIDATED_MONITORING_EVIDENCE",
      fileName: "monitoring-evidence.pdf",
      storagePath: `evidence/user_fixture_001/case_fixture_001/${evidenceId}/monitoring-evidence.pdf`,
      mimeType: "application/pdf",
      sizeBytes: EVIDENCE_BYTES.byteLength,
      issuer: "Example Installation",
      issueDate: "2026-12-31",
      reportingPeriod: "2026",
      pageReference: "Controlled evidence set",
      fileHash: EVIDENCE_HASH,
      uploadTimestamp: "2026-12-31T00:00:00.000Z",
      uploader: "user_fixture_001",
      reviewStatus: "APPROVED",
      supportStatus: "SUPPORTED",
      confidentiality: "CONFIDENTIAL",
      linkedInputs,
      linkedCalculations: [],
      reviewerNotes: "Issuer, period, field linkage, hash and completeness checked by the data owner.",
    }],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [{
      decisionId: "decision_precursor_scope",
      topic: "PRECURSOR_SCOPE",
      selectedMethod: "No separate precursor input applies to this single-stage fixture route",
      reason: "The controlled fixture represents a single installation process without purchased covered precursors.",
      legalOrTechnicalBasis: "Installation process map and system-boundary assessment",
      evidenceIds: [],
      reviewStatus: "ACCEPTED",
      rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    }],
    auditEvents: [],
  };
}

async function runRuntimeCheck() {
  try {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);

    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_001",
      caseData,
      calculation,
      qualityControls,
      evidenceFiles: [{
        evidenceId: caseData.evidenceRegister[0].evidenceId,
        fileName: caseData.evidenceRegister[0].fileName,
        mimeType: "application/pdf",
        sourceHash: EVIDENCE_HASH,
        buffer: EVIDENCE_BYTES,
      }],
    });

    const validation = await validatePackageContract(result.zipBuffer, result.manifest);
    if (!validation.success) {
      failures.push(`RUNTIME_CHECK_FAILED: ${validation.failures.join(", ")}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`RUNTIME_CHECK_ERROR: ${msg}`);
  }
}

async function main() {
  await runRuntimeCheck();

  if (failures.length > 0) {
    console.error("VERIFIER_GRADE_REPORT_GUARD=FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("VERIFIER_GRADE_REPORT_GUARD=PASS");
  console.log("REPORT_STANDARD=CBAMVALID-VGRS-1.0");
  console.log("PER_GOOD_ALLOCATION=PASS");
  console.log("EVIDENCE_APPROVAL_GATE=PASS");
  console.log("METHODOLOGY_GOVERNANCE=PASS");
  console.log("CALCULATION_RECONCILIATION=PASS");
  console.log("PREMIUM_27_COMPONENT_DOSSIER=PASS");
  console.log("ACCREDITED_VERIFIER_BOUNDARY=PASS");
}

main().catch((err) => {
  console.error("Fatal guard error:", err);
  process.exit(1);
});
