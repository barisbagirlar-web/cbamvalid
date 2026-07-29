import { describe, expect, it } from "vitest";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";
import { runQualityControls as runServerQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import type { AuditReadyCase } from "../../lib/cbam/schema";

const OWNER_ID = "user123";
const CASE_ID = "case_quality_fixture";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const METHODOLOGY_DECISION_ID = "22222222-2222-4222-8222-222222222222";

const linkedEvidenceInput = (value: string, canonicalUnit?: AuditReadyCase["directEmissions"]["canonicalUnit"]) => ({
  value,
  ...(canonicalUnit ? { canonicalUnit } : {}),
  sourceType: "PRIMARY" as const,
  confidenceStatus: "HIGH_VERIFIED" as const,
  evidenceId: EVIDENCE_ID,
});

describe("CBAM Quality Controls Traceability", () => {
  const createValidCase = (): AuditReadyCase => ({
    caseId: CASE_ID,
    status: "DRAFT",
    version: 1,
    ownerId: OWNER_ID,
    importerIdentity: {
      legalName: {
        value: "Test Importer B.V.",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
      eoriNumber: linkedEvidenceInput("NL123456789AB"),
    },
    exporterIdentity: {
      legalName: {
        value: "Test Exporter GmbH",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
    },
    reportingPeriod: {
      year: {
        value: "2026",
        sourceType: "REGULATORY",
        confidenceStatus: "HIGH_VERIFIED",
      },
      quarter: {
        value: "Q1",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
    },
    goods: [
      {
        sector: "IRON_AND_STEEL",
        cnCode: linkedEvidenceInput("72011011"),
        productionVolume: linkedEvidenceInput("100", "t"),
        shipmentRecords: {
          value: "100",
          canonicalUnit: "t",
          sourceType: "PRIMARY",
          confidenceStatus: "HIGH_VERIFIED",
        },
      },
    ],
    installation: {
      name: {
        value: "Rotterdam Steel Installation",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
      country: {
        value: "TR",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
      productionRoute: {
        value: "Blast Furnace / Basic Oxygen Furnace",
        sourceType: "PRIMARY",
        confidenceStatus: "HIGH_VERIFIED",
      },
      systemBoundaries: "Cradle-to-gate installation boundary including direct and electricity emissions.",
    },
    directEmissions: linkedEvidenceInput("50", "tCO2e"),
    electricityConsumed: linkedEvidenceInput("20", "MWh"),
    gridEmissionFactor: linkedEvidenceInput("0.5", "tCO2e/MWh"),
    precursors: [],
    productionProcesses: [
      {
        processId: "PROC-TEST-001",
        name: "Primary steelmaking process",
        producedGoodIndexes: [0],
        attributedDirectTco2e: "50",
        attributedIndirectTco2e: "10",
      },
    ],
    sourceStreamRegister: [
      {
        streamId: "STREAM-TEST-FUEL",
        name: "Process fuel stream",
        category: "MAJOR",
        instrumentId: "METER-TEST-FUEL",
        calibrationEvidenceId: EVIDENCE_ID,
        calibrationDate: "2025-12-01",
        calibrationValidityEnd: "2026-12-31",
        maximumPermissibleUncertaintyPercent: "2.0",
        achievedUncertaintyPercent: "1.5",
        appliedTier: "2",
      },
    ],
    emissionSourceRegister: [
      {
        sourceId: "ES-TEST-001",
        name: "Process stack",
        gas: "CO2",
        linkedProcessId: "PROC-TEST-001",
        linkedStreamId: "STREAM-TEST-FUEL",
      },
    ],
    meterRegister: [
      {
        meterId: "METER-TEST-FUEL",
        description: "Fuel flow meter",
        meterType: "FUEL",
        calibrationDate: "2025-12-01",
        calibrationValidityEnd: "2026-12-31",
        calibrationEvidenceId: EVIDENCE_ID,
        maximumPermissibleUncertaintyPercent: "2.0",
        achievedUncertaintyPercent: "1.5",
      },
    ],
    carbonPriceRecords: [],
    evidenceRegister: [
      {
        evidenceId: EVIDENCE_ID,
        fileName: "verified-monitoring-package.pdf",
        storagePath: `evidence/${OWNER_ID}/${CASE_ID}/${EVIDENCE_ID}/verified-monitoring-package.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 4096,
        documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        reviewStatus: "APPROVED",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        confidentiality: "INTERNAL",
        issuer: "Independent Monitoring Auditor",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        uploader: OWNER_ID,
        linkedInputs: [
          "importerIdentity.eoriNumber",
          "goods.0.cnCode",
          "goods.0.productionVolume",
          "directEmissions",
          "electricityConsumed",
          "gridEmissionFactor",
          "meterRegister.0",
          "sourceStreamRegister.0",
        ],
        linkedCalculations: [
          "CBAM_INDIRECT_EMISSIONS",
          "CBAM_TOTAL_EMBEDDED_EMISSIONS",
        ],
        reviewerNotes: "Evidence package reviewed and accepted for the stated reporting period.",
      },
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: METHODOLOGY_DECISION_ID,
        topic: "PRECURSOR_SCOPE",
        selectedMethod: "No precursor emissions apply to the declared simple good and route.",
        reason: "The production route and bill of materials contain no qualifying precursor goods.",
        legalOrTechnicalBasis: "EU CBAM definitive-period methodology and installation process records.",
        evidenceIds: [EVIDENCE_ID],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    operatorSignOffs: [],
    auditEvents: [],
  });

  it("passes every blocking quality control for a complete evidence-linked case", () => {
    const results = runQualityControls(createValidCase());
    const blockers = results.filter((result) => result.status === "BLOCKER");

    expect(results.find((result) => result.ruleId === "QC_00")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_01")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_02")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_03_0")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_04_0")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_06")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_07")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_08")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_09")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_10")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_13")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_14")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_15")?.status).toBe("PASS");
    expect(results.find((result) => result.ruleId === "QC_16")?.status).toBe("PASS");
    expect(blockers).toEqual([]);
  });

  it("blocks sealing when monitoring registers are missing", () => {
    const caseData = createValidCase();
    caseData.productionProcesses = [];
    caseData.sourceStreamRegister = [];
    caseData.emissionSourceRegister = [];
    caseData.meterRegister = [];

    const results = runQualityControls(caseData);
    expect(results.find((result) => result.ruleId === "QC_13")?.status).toBe("BLOCKER");
    expect(results.find((result) => result.ruleId === "QC_14")?.status).toBe("BLOCKER");
    expect(results.find((result) => result.ruleId === "QC_15")?.status).toBe("BLOCKER");
    expect(results.find((result) => result.ruleId === "QC_16")?.status).toBe("BLOCKER");
  });

  it("blocks invalid uncertainty, calibration coverage and unresolved instrument links", () => {
    const caseData = createValidCase();
    caseData.sourceStreamRegister[0].achievedUncertaintyPercent = "3.5";
    caseData.sourceStreamRegister[0].instrumentId = "MISSING-METER";
    caseData.meterRegister[0].calibrationValidityEnd = "2026-01-15";
    caseData.meterRegister[0].calibrationEvidenceId = undefined;

    const results = runQualityControls(caseData);
    expect(results.some((result) => result.ruleId.startsWith("QC_14") && result.status === "BLOCKER")).toBe(true);
    expect(results.some((result) => result.ruleId.startsWith("QC_16") && result.status === "BLOCKER")).toBe(true);
  });

  it("blocks a grid factor entered at an incompatible scale in both runtimes", () => {
    const caseData = createValidCase();
    caseData.gridEmissionFactor.value = "4344";

    for (const controls of [
      runQualityControls(caseData),
      runServerQualityControls(caseData),
    ]) {
      const factorControl = controls.find((result) => result.ruleId === "QC_08");
      expect(factorControl?.status).toBe("BLOCKER");
      expect(factorControl?.message).toContain("decimal separator");
    }
  });

  it("does not treat partially supported evidence as seal-ready", () => {
    const caseData = createValidCase();
    caseData.evidenceRegister[0].supportStatus = "PARTIALLY_SUPPORTED";

    for (const controls of [
      runQualityControls(caseData),
      runServerQualityControls(caseData),
    ]) {
      expect(controls.find((result) => result.ruleId === "QC_06")?.status).toBe("BLOCKER");
      expect(controls.find((result) => result.ruleId === "QC_10")?.status).toBe("BLOCKER");
    }
  });
});
