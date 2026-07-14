import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import crypto from "crypto";
import {
  buildVerifierPreparationPackage,
  REQUIRED_TOP_LEVEL_COMPONENTS,
} from "../../functions/src/cbam/report/verifier-package-builder";
import { verifyVerifierPreparationPackage } from "../../functions/src/cbam/report/verifier-package-verifier";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { assessVerifierGradeReport, REPORT_STANDARD_VERSION } from "../../functions/src/cbam/report/report-quality-contract";
import { validatePackageContract } from "../../functions/src/cbam/report/package-contract-validator";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";

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

describe("verifier-grade preparation package", () => {
  it("generates and independently verifies all 27 top-level components under a PASS quality contract", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);
    const quality = assessVerifierGradeReport({ caseData, calculation, qualityControls });

    expect(quality.status).toBe("PASS");
    expect(quality.evidenceCoverage.percentage).toBe(100);
    expect(quality.calculationIntegrity.hashCoveragePercentage).toBe(100);

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

    const verified = await verifyVerifierPreparationPackage(result.zipBuffer);
    expect(REQUIRED_TOP_LEVEL_COMPONENTS).toHaveLength(27);
    expect(verified.topLevelComponentCount).toBe(27);
    expect(verified.verifiedFileCount).toBe(verified.manifest.files.length);
    expect(verified.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifest.reportStandardVersion).toBe(REPORT_STANDARD_VERSION);
    expect(result.manifest.reportQualityAssessment.status).toBe("PASS");
    expect(result.manifest.files.some((file) => file.filename.startsWith("23_Supporting_Evidence/"))).toBe(true);

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const operatorReport = zip.file("15_Operator_Emissions_Report.pdf");
    const calculationTrace = zip.file("21_Calculation_Trace.json");
    expect(operatorReport).not.toBeNull();
    expect((await operatorReport!.async("nodebuffer")).byteLength).toBeGreaterThan(4_000);
    const tracePayload = JSON.parse(await calculationTrace!.async("string"));
    expect(tracePayload.ruleset).toBe(calculation.ruleset);
    expect(tracePayload.perGoodResults).toHaveLength(1);
    expect(tracePayload.reconciliation.allocationShareTotal).toBe("1");
    expect(tracePayload.reconciliation.allocationReconciliationDelta).toBe("0");
  });

  it("rejects an evidence file whose bytes do not match the registered hash", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);

    await expect(buildVerifierPreparationPackage({
      releaseId: "rel_fixture_002",
      caseData,
      calculation,
      qualityControls,
      evidenceFiles: [{
        evidenceId: caseData.evidenceRegister[0].evidenceId,
        fileName: caseData.evidenceRegister[0].fileName,
        mimeType: "application/pdf",
        sourceHash: EVIDENCE_HASH,
        buffer: Buffer.from("tampered"),
      }],
    })).rejects.toThrow("EVIDENCE_HASH_MISMATCH");
  });

  it("blocks package generation when evidence is pending internal review", async () => {
    const caseData = fixture();
    caseData.evidenceRegister[0].reviewStatus = "PENDING";
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);

    await expect(buildVerifierPreparationPackage({
      releaseId: "rel_fixture_003",
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
    })).rejects.toThrow("REPORT_QUALITY_BLOCKED");
  });

  // Regression: Deterministic 2x build verification
  it("produces byte-identical ZIP output from two runs with identical inputs", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);

    const run1 = await buildVerifierPreparationPackage({
      releaseId: "rel_deterministic_001",
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

    const run2 = await buildVerifierPreparationPackage({
      releaseId: "rel_deterministic_001",
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

    expect(run1.zipBuffer.equals(run2.zipBuffer)).toBe(true);
  });

  // Regression: Unknown extra files in zip
  it("fails contract validation if there are unknown files in the zip", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);
    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_extra",
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

    const zip = await JSZip.loadAsync(result.zipBuffer);
    zip.file("99_Hack_Attempt.txt", "unauthorized content");
    const tamperedBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const validation = await validatePackageContract(tamperedBuffer, result.manifest);
    expect(validation.success).toBe(false);
    expect(validation.failures.some(f => f.includes("PACKAGE_COMPONENT_UNKNOWN"))).toBe(true);
  });

  // Regression: Empty required components
  it("fails contract validation if a required component is empty", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);
    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_empty",
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

    const zip = await JSZip.loadAsync(result.zipBuffer);
    zip.file("07_Source_Stream_Register.csv", ""); // Overwrite with empty
    const tamperedBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const validation = await validatePackageContract(tamperedBuffer, result.manifest);
    expect(validation.success).toBe(false);
    expect(validation.failures.some(f => f.includes("PACKAGE_COMPONENT_EMPTY") || f.includes("PACKAGE_COMPONENT_SIZE_MISMATCH"))).toBe(true);
  });

  // Regression: Manifest hash mutations / tampered manifest
  it("fails contract validation if a file's content hash is tampered with", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);
    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_tamper",
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

    const zip = await JSZip.loadAsync(result.zipBuffer);
    zip.file("07_Source_Stream_Register.csv", "tampered,data\n");
    const tamperedBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const validation = await validatePackageContract(tamperedBuffer, result.manifest);
    expect(validation.success).toBe(false);
    expect(validation.failures.some(f => f.includes("PACKAGE_COMPONENT_HASH_MISMATCH"))).toBe(true);
  });

  // Regression: Manifest/physical file parity mismatches
  it("fails contract validation if manifest entries do not match physical files", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const qualityControls = runQualityControls(caseData);
    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_parity",
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

    const zip = await JSZip.loadAsync(result.zipBuffer);
    zip.remove("07_Source_Stream_Register.csv");
    const tamperedBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const validation = await validatePackageContract(tamperedBuffer, result.manifest);
    expect(validation.success).toBe(false);
    expect(validation.failures.some(f => f.includes("PHYSICAL_MANIFEST_PARITY_ERROR") || f.includes("PACKAGE_COMPONENT_MISSING"))).toBe(true);
  });
});
