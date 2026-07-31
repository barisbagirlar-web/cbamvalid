/**
 * FAZ P0 (I) — Wizard step validation mandatory tests.
 *
 * Covers:
 *   - empty EORI blocks Step 1
 *   - missing CN blocks Step 2
 *   - missing production quantity is surfaced inline with guidance
 *   - missing system boundary is clearly guided
 *   - dynamic evidence-link options cover every material path
 *   - material evidence hard-blocks the evidence and seal stages
 *   - early steps stay navigable when evidence is missing (NEEDS_EVIDENCE)
 *   - stepper state derivation (NOT_STARTED / IN_PROGRESS / NEEDS_ATTENTION /
 *     NEEDS_EVIDENCE / COMPLETE)
 */

import { describe, expect, it } from "vitest";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import {
  buildEvidenceLinkOptions,
  getUnblockedStepRange,
  HARD_BLOCK_START_STEP,
  summarizeWizardCompletion,
  validateWizardStep,
  WIZARD_STEP_HEADERS,
  wizardStepTotalFields,
} from "@/lib/cbam/wizard-validation";

const EV_EORI = "11111111-1111-4111-8111-111111111111";
const EV_CN = "22222222-2222-4222-8222-222222222222";
const EV_VOL = "33333333-3333-4333-8333-333333333333";
const EV_BOUNDARY = "44444444-4444-4444-8444-444444444444";

function datum(value: string | number | null, evidenceId?: string) {
  return {
    value,
    ...(evidenceId ? { evidenceId } : {}),
    sourceType: "PRIMARY" as const,
    confidenceStatus: "HIGH_VERIFIED" as const,
    documentReference: "Controlled wizard test record",
    measurementMethod: "Documented direct measurement",
    responsiblePerson: "Test monitoring manager",
  };
}

function baseCase(): AuditReadyCase {
  return {
    caseId: "case_wizard_test_2026",
    status: "DRAFT",
    version: 1,
    ownerId: "wizard-test-owner",
    importerIdentity: {
      legalName: datum("CBAMValid Importer B.V."),
      eoriNumber: datum("NL123456789AB"),
      address: datum("Rotterdam, Netherlands"),
    },
    exporterIdentity: {
      legalName: datum("Test Operator Ltd"),
      address: datum("Test City, Country"),
      exporterCountry: datum("IN"),
    },
    reportingPeriod: {
      year: datum("2026"),
      quarter: datum("ANNUAL"),
      startDate: datum("2026-01-01"),
      endDate: datum("2026-12-31"),
    },
    goods: [
      {
        cnCode: datum("72011011"),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("1000", "t"),
        shipmentRecords: datum("1000", "t"),
        allocationShare: datum("1", "fraction"),
      },
    ],
    installation: {
      name: datum("Test Steel Works"),
      unloCode: datum("INJSR"),
      address: datum("Test City — Test Steel Works"),
      latitude: datum("22.791111", "degrees"),
      longitude: datum("86.181111", "degrees"),
      country: datum("IN"),
      productionRoute: datum("Blast furnace - basic oxygen furnace"),
      systemBoundaries: "Coke ovens, blast furnace, BOF, casting and dispatch inside the controlled boundary.",
      monitoringPlanId: datum("MP-TEST-2026-v1"),
      monitoringPlanVersion: datum("v1"),
      monitoringPlanEffectiveDate: datum("2026-01-01"),
    },
    directEmissions: datum("120000", "tCO2e"),
    electricityConsumed: datum("50000", "MWh"),
    gridEmissionFactor: datum("0.5810", "tCO2e/MWh"),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    operatorSignOffs: [],
    auditEvents: [],
  };
}

/** Approve a material requirement by linking evidence. */
function linkEvidence(caseData: AuditReadyCase, evidenceId: string, path: string, documentType = "CUSTOMS_DECLARATION") {
  caseData.evidenceRegister.push({
    evidenceId,
    documentType,
    fileName: `${evidenceId}.pdf`,
    storagePath: `evidence/wizard-test-owner/${caseData.caseId}/${evidenceId}/${evidenceId}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 120,
    issuer: "Customs Authority",
    issueDate: "2026-06-01",
    reportingPeriod: "2026 ANNUAL",
    pageReference: "Page 1",
    fileHash: "a".repeat(64),
    uploadTimestamp: "2026-12-15T00:00:00.000Z",
    uploader: "wizard-test-owner",
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs: [path],
    linkedCalculations: [],
    reviewerNotes: "Server review approved the linked input for wizard validation tests.",
    issuerCategory: "CUSTOMS_AUTHORITY",
    documentAuthority: "OFFICIAL",
    qualityGrade: "A",
    qualityAssessmentBasis: "Official customs authority record.",
    qualityAssessedBy: "Server Review Engine",
    qualityAssessedAt: "2027-01-15T00:00:00.000Z",
  });
  return caseData;
}

describe("wizard step validation", () => {
  it("blocks Step 1 when the EORI number is empty", () => {
    const caseData = baseCase();
    caseData.importerIdentity.eoriNumber = datum("");

    const validation = validateWizardStep(1, caseData);

    expect(validation.valid).toBe(false);
    const issue = validation.dataIssues.find((i) => i.fieldPath === "importerIdentity.eoriNumber");
    expect(issue).toBeDefined();
    expect(issue!.kind).toBe("MISSING");
    expect(issue!.message).toContain("EORI");
    expect(validation.state).toBe("NEEDS_ATTENTION");
  });

  it("blocks Step 2 when a CN code is missing", () => {
    const caseData = baseCase();
    caseData.goods[0]!.cnCode = datum(null);

    const validation = validateWizardStep(2, caseData);

    expect(validation.valid).toBe(false);
    const issue = validation.dataIssues.find((i) => i.fieldPath === "goods.0.cnCode");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/Combined Nomenclature|Format:/);
  });

  it("surfaces a missing production quantity inline with guidance", () => {
    const caseData = baseCase();
    caseData.goods[0]!.productionVolume = datum(null);

    const validation = validateWizardStep(2, caseData);

    const issue = validation.dataIssues.find((i) => i.fieldPath === "goods.0.productionVolume");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/Production quantity|Format:/);
  });

  it("clearly guides a missing system-boundary statement", () => {
    const caseData = baseCase();
    caseData.installation.systemBoundaries = null;

    const validation = validateWizardStep(3, caseData);

    const boundaryIssue = validation.issues.find((i) => i.fieldPath === "installation.systemBoundaries");
    expect(boundaryIssue).toBeDefined();
    expect(boundaryIssue!.message).toMatch(/statement|system boundary/i);
  });

  it("keeps early steps navigable when evidence is missing but flags NEEDS_EVIDENCE", () => {
    const caseData = baseCase();
    // Full data, no evidence linked.
    const validation = validateWizardStep(1, caseData);

    // Data is complete so the step is valid; the evidence gap is advisory.
    expect(validation.valid).toBe(true);
    expect(validation.missingEvidenceCount).toBeGreaterThan(0);
    expect(validation.state).toBe("NEEDS_EVIDENCE");
  });

  it("hard-blocks the evidence and seal steps on missing material evidence", () => {
    const caseData = baseCase();
    caseData.evidenceRegister = [];
    caseData.methodologyDecisions = [];

    expect(HARD_BLOCK_START_STEP).toBe(7);

    const sealValidation = validateWizardStep(8, caseData);
    expect(sealValidation.valid).toBe(false);
    expect(sealValidation.evidenceIssues.length).toBeGreaterThan(0);
    expect(sealValidation.state).toBe("NEEDS_EVIDENCE");

    const evidenceStep = validateWizardStep(7, caseData);
    expect(evidenceStep.valid).toBe(false);
    expect(evidenceStep.evidenceIssues.some((i) => i.kind === "EVIDENCE")).toBe(true);

    // A fully evidence-linked case unblocks the seal step.
    const complete = baseCase();
    linkEvidence(complete, EV_EORI, "importerIdentity.eoriNumber", "EORI_REGISTRATION_RECORD");
    linkEvidence(complete, EV_EORI, "importerIdentity.legalName", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "exporterIdentity.legalName", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "exporterIdentity.address", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "reportingPeriod.year", "SIGNED_PERIOD_CLOSURE_SHEET");
    linkEvidence(complete, EV_EORI, "installation.name", "MONITORING_PLAN");
    linkEvidence(complete, EV_EORI, "installation.country", "MONITORING_PLAN");
    linkEvidence(complete, EV_EORI, "installation.productionRoute", "MONITORING_PLAN");
    linkEvidence(complete, EV_BOUNDARY, "installation.systemBoundaries", "MONITORING_PLAN");
    linkEvidence(complete, EV_CN, "goods.0.cnCode", "CUSTOMS_DECLARATION");
    linkEvidence(complete, EV_VOL, "goods.0.productionVolume", "SIGNED_PRODUCTION_LEDGER");
    linkEvidence(complete, EV_VOL, "directEmissions", "DIRECT_EMISSIONS_CALCULATION_WORKBOOK");
    linkEvidence(complete, EV_VOL, "electricityConsumed", "ELECTRICITY_METER_RECORD");
    linkEvidence(complete, EV_VOL, "gridEmissionFactor", "OFFICIAL_GRID_OPERATOR_PUBLICATION");

    const unblockedSeal = validateWizardStep(8, complete);
    expect(unblockedSeal.valid).toBe(true);
  });

  it("reports the unblocked step range with the hard block at the evidence stage", () => {
    expect(getUnblockedStepRange()).toEqual({ hardBlockStartStep: 7 });
  });

  it("summarizes completion across all data steps", () => {
    const caseData = baseCase();
    caseData.evidenceRegister = [];
    const summary = summarizeWizardCompletion(caseData);
    expect(summary.completedFields).toBeGreaterThan(0);
    expect(summary.missingFields).toBe(0);
    expect(summary.missingEvidence).toBeGreaterThan(0);
  });

  it("exposes step headers and per-step field counts", () => {
    expect(WIZARD_STEP_HEADERS[2]!.shortTitle).toBe("Goods");
    expect(wizardStepTotalFields(2)).toBe(5);
    expect(Object.keys(WIZARD_STEP_HEADERS)).toHaveLength(8);
  });

  it("derives stepper states across the full lifecycle", () => {
    const empty = baseCase();
    empty.goods = [];
    empty.installation.systemBoundaries = null;
    empty.evidenceRegister = [];
    empty.methodologyDecisions = [];

    const step2Empty = validateWizardStep(2, empty);
    expect(step2Empty.state).toBe("NEEDS_ATTENTION");
    expect(step2Empty.missingFieldCount).toBeGreaterThan(0);

    const step8Empty = validateWizardStep(8, empty);
    expect(step8Empty.state).toBe("NEEDS_EVIDENCE");

    const complete = baseCase();
    linkEvidence(complete, EV_EORI, "importerIdentity.eoriNumber", "EORI_REGISTRATION_RECORD");
    linkEvidence(complete, EV_EORI, "importerIdentity.legalName", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "exporterIdentity.legalName", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "exporterIdentity.address", "COMMERCIAL_REGISTRY_EXTRACT");
    linkEvidence(complete, EV_EORI, "reportingPeriod.year", "SIGNED_PERIOD_CLOSURE_SHEET");
    linkEvidence(complete, EV_EORI, "installation.name", "MONITORING_PLAN");
    linkEvidence(complete, EV_EORI, "installation.country", "MONITORING_PLAN");
    linkEvidence(complete, EV_EORI, "installation.productionRoute", "MONITORING_PLAN");
    linkEvidence(complete, EV_BOUNDARY, "installation.systemBoundaries", "MONITORING_PLAN");
    linkEvidence(complete, EV_CN, "goods.0.cnCode", "CUSTOMS_DECLARATION");
    linkEvidence(complete, EV_VOL, "goods.0.productionVolume", "SIGNED_PRODUCTION_LEDGER");
    linkEvidence(complete, EV_VOL, "directEmissions", "DIRECT_EMISSIONS_CALCULATION_WORKBOOK");
    linkEvidence(complete, EV_VOL, "electricityConsumed", "ELECTRICITY_METER_RECORD");
    linkEvidence(complete, EV_VOL, "gridEmissionFactor", "OFFICIAL_GRID_OPERATOR_PUBLICATION");

    expect(validateWizardStep(8, complete).state).toBe("COMPLETE");
  });

  it("builds dynamic evidence-link options covering every material path", () => {
    const caseData = baseCase();
    caseData.precursors.push({
      name: datum("Hot briquetted iron (HBI)"),
      quantity: datum("12000", "t"),
      directEmissions: datum("8000", "tCO2e"),
      indirectEmissions: datum("900", "tCO2e"),
      countryOfOrigin: datum("IN"),
    });
    caseData.carbonPriceRecords.push({
      id: "99999999-9999-4999-8999-999999999999",
      amountPaid: "450000",
      applicableEmissions: "8000",
      currency: "USD",
      paymentPeriod: "2026",
      legislationReference: "India Carbon Law 2024",
      proofOfPaymentEvidenceId: EV_EORI,
      rebateInformation: "",
      eligibleCertificateReduction: "0",
    });

    const options = buildEvidenceLinkOptions(caseData);
    const values = options.map((o) => o.value);

    for (const required of [
      "importerIdentity.eoriNumber",
      "exporterIdentity.legalName",
      "reportingPeriod.year",
      "installation.systemBoundaries",
      "installation.monitoringPlanId",
      "goods.0.cnCode",
      "goods.0.productionVolume",
      "directEmissions",
      "electricityConsumed",
      "gridEmissionFactor",
      "precursors.0.name",
      "precursors.0.quantity",
      "precursors.0.directEmissions",
      "precursors.0.indirectEmissions",
      "carbonPriceRecords.0.amountPaid",
      "carbonPriceRecords.0.applicableEmissions",
    ]) {
      expect(values).toContain(required);
    }

    // Every option carries guidance content from the registry.
    for (const option of options) {
      expect(Array.isArray(option.acceptedEvidenceTypes)).toBe(true);
      expect(Array.isArray(option.preferredIssuerCategories)).toBe(true);
    }
  });

  it("marks a multi-good allocation share as required in link options", () => {
    const caseData = baseCase();
    caseData.goods.push({
      cnCode: datum("72011019"),
      sector: "IRON_AND_STEEL",
      productionVolume: datum("500", "t"),
      shipmentRecords: datum("500", "t"),
      allocationShare: datum("0.5", "fraction"),
    });
    const options = buildEvidenceLinkOptions(caseData);
    const allocOption = options.find((o) => o.value === "goods.1.allocationShare");
    expect(allocOption).toBeDefined();
    expect(allocOption!.required).toBe(true);
  });
});
