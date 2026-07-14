import { describe, it, expect } from "vitest";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";
import { AuditReadyCase, createEmptyInput } from "../../lib/cbam/schema";

describe("CBAM Quality Controls Traceability", () => {
  const createBaseCase = (): AuditReadyCase => ({
    status: "DRAFT",
    version: 1,
    ownerId: "user123",
    importerIdentity: {
      legalName: { value: "Test Importer", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      eoriNumber: { value: "NL123456789", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
    },
    exporterIdentity: {
      legalName: { value: "Test Exporter", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
    },
    reportingPeriod: {
      year: { value: "2024", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
      quarter: createEmptyInput(),
    },
    goods: [
      {
        sector: "STEEL",
        cnCode: { value: "72011011", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
        productionVolume: { value: "100", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
        shipmentRecords: createEmptyInput(),
      }
    ],
    installation: {
      name: createEmptyInput(),
      country: createEmptyInput(),
      productionRoute: createEmptyInput(),
    },
    directEmissions: { value: "50", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
    electricityConsumed: createEmptyInput("MWh"),
    gridEmissionFactor: createEmptyInput("tCO2e/MWh"),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [
      {
        evidenceId: "ev1",
        fileName: "proof.pdf",
        documentType: "PRIMARY_MONITORING",
        uploadTimestamp: "2024-01-01T00:00:00Z",
        fileHash: "hash123",
        reviewStatus: "PENDING",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        issuer: "Auditor",
        issueDate: "2024-01-01",
        reportingPeriod: "2024",
        uploader: "user123",
        linkedInputs: [],
        linkedCalculations: []
      }
    ],
    calculationTrace: [],
    gapAssessment: [],
    auditEvents: []
  });

  it("should yield APPLICABLE_PASS for a valid case", () => {
    const caseData = createBaseCase();
    const results = runQualityControls(caseData);
    
    const eoriResult = results.find(r => r.ruleId === "QC_01");
    expect(eoriResult?.status).toBe("PASS");

    const blockages = results.filter(r => r.status === "BLOCKER");
    expect(blockages.length).toBe(0);
  });

  it("should yield APPLICABLE_FAIL for an invalid case", () => {
    const caseData = createBaseCase();
    caseData.importerIdentity.eoriNumber.value = "123"; // Too short
    
    const results = runQualityControls(caseData);
    const eoriResult = results.find(r => r.ruleId === "QC_01");
    expect(eoriResult?.status).toBe("BLOCKER");
    expect(eoriResult?.remediationCode).toBe("REM_CORRECT_EORI_FORMAT");
  });

  it("should yield NOT_APPLICABLE when rule context does not apply", () => {
    const caseData = createBaseCase();
    // No carbon price records means QC_10 shouldn't apply
    caseData.carbonPriceRecords = [];
    
    const results = runQualityControls(caseData);
    const priceResult = results.find(r => r.ruleId === "QC_10");
    expect(priceResult?.status).toBe("NOT_APPLICABLE");
  });
});
