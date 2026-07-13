import { describe, it, expect } from "vitest";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";
import { AuditReadyCase, createEmptyInput } from "../../lib/cbam/schema";

const EVIDENCE_ID = "d81bb1d1-7f34-4ec9-a168-0cbe184cb037";

function createBaseCase(): AuditReadyCase {
  return {
    caseId: "case_quality_fixture",
    status: "DRAFT",
    version: 1,
    ownerId: "user123",
    importerIdentity: {
      legalName: { value: "Test Importer", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      eoriNumber: { value: "NL123456789", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
    },
    exporterIdentity: {
      legalName: { value: "Test Exporter", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
    },
    reportingPeriod: {
      year: { value: "2026", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      quarter: { value: "Annual", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
    },
    goods: [
      {
        sector: "IRON_AND_STEEL",
        cnCode: { value: "72011011", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
        productionVolume: { value: "100", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
        shipmentRecords: { value: "100", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
      }
    ],
    installation: {
      name: { value: "Test Mill", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      country: { value: "NL", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      productionRoute: { value: "Electric arc furnace", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      systemBoundaries: "Melting, casting and rolling",
    },
    directEmissions: { value: "50", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
    electricityConsumed: { value: "100", canonicalUnit: "MWh", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
    gridEmissionFactor: { value: "0.4", canonicalUnit: "tCO2e/MWh", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: EVIDENCE_ID },
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [
      {
        evidenceId: EVIDENCE_ID,
        fileName: "proof.pdf",
        documentType: "PRIMARY_MONITORING",
        storagePath: `evidence/user123/case_quality_fixture/${EVIDENCE_ID}/proof.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 123,
        uploadTimestamp: "2026-01-01T00:00:00.000Z",
        fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        reviewStatus: "PENDING",
        supportStatus: "SUPPORTED",
        confidentiality: "CONFIDENTIAL",
        issuer: "Auditor",
        issueDate: "2026-01-01",
        reportingPeriod: "2026",
        uploader: "user123",
        linkedInputs: ["directEmissions"],
        linkedCalculations: []
      }
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: []
  };
}

describe("CBAM Quality Controls Traceability", () => {
  it("should yield APPLICABLE_PASS for a valid case", () => {
    const caseData = createBaseCase();
    const results = runQualityControls(caseData);
    expect(results.find((result) => result.ruleId === "QC_01")?.status).toBe("PASS");
    expect(results.filter((result) => result.status === "BLOCKER")).toHaveLength(0);
  });

  it("should yield APPLICABLE_FAIL for an invalid case", () => {
    const caseData = createBaseCase();
    caseData.importerIdentity.eoriNumber.value = "123";
    const results = runQualityControls(caseData);
    const eoriResult = results.find((result) => result.ruleId === "QC_01");
    expect(eoriResult?.status).toBe("BLOCKER");
    expect(eoriResult?.remediationCode).toBe("REM_CORRECT_EORI_FORMAT");
  });

  it("should yield NOT_APPLICABLE when rule context does not apply", () => {
    const caseData = createBaseCase();
    caseData.carbonPriceRecords = [];
    expect(runQualityControls(caseData).find((result) => result.ruleId === "QC_10")?.status).toBe("NOT_APPLICABLE");
  });
});
