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
  clampWizardStep,
  evaluateSealAttempt,
  firstDataIssuePath,
  getUnblockedStepRange,
  HARD_BLOCK_START_STEP,
  parseStepFromQuery,
  shouldBlockNext,
  summarizeStep8Actions,
  summarizeWizardCompletion,
  translateSealError,
  validateWizardStep,
  wizardStepShortTitle,
  wizardStepTitle,
  wizardStepTotalFields,
} from "@/lib/cbam/wizard-validation";
import { CBAM_WORKFLOW_STEPS } from "@/lib/cbam/workflow-definition";

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
    expect(validation.state).toBe("NEEDS_INFORMATION");
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

  it("keeps early steps navigable when evidence is missing but flags NEEDS_DOCUMENTS", () => {
    const caseData = baseCase();
    // Full data, no evidence linked.
    const validation = validateWizardStep(1, caseData);

    // Data is complete so the step is valid; the evidence gap is advisory.
    expect(validation.valid).toBe(true);
    expect(validation.missingEvidenceCount).toBeGreaterThan(0);
    expect(validation.state).toBe("NEEDS_DOCUMENTS");
  });

  it("hard-blocks the evidence and seal steps on missing material evidence", () => {
    const caseData = baseCase();
    caseData.evidenceRegister = [];
    caseData.methodologyDecisions = [];

    expect(HARD_BLOCK_START_STEP).toBe(7);

    const sealValidation = validateWizardStep(8, caseData);
    expect(sealValidation.valid).toBe(false);
    expect(sealValidation.evidenceIssues.length).toBeGreaterThan(0);
    expect(sealValidation.state).toBe("NEEDS_DOCUMENTS");

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

  it("exposes SSOT-derived step titles and per-step field counts", () => {
    expect(wizardStepShortTitle(2)).toBe("Goods");
    expect(wizardStepTitle(2)).toBe("Goods and CN codes");
    expect(wizardStepTotalFields(2)).toBe(5);
    expect(CBAM_WORKFLOW_STEPS).toHaveLength(8);
  });

  it("derives stepper states across the full lifecycle", () => {
    const empty = baseCase();
    empty.goods = [];
    empty.installation.systemBoundaries = null;
    empty.evidenceRegister = [];
    empty.methodologyDecisions = [];

    const step2Empty = validateWizardStep(2, empty);
    expect(step2Empty.state).toBe("NEEDS_INFORMATION");
    expect(step2Empty.missingFieldCount).toBeGreaterThan(0);

    const step8Empty = validateWizardStep(8, empty);
    expect(step8Empty.state).toBe("NEEDS_DOCUMENTS");

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

    expect(validateWizardStep(8, complete).state).toBe("IN_PROGRESS");
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

/**
 * FAZ P0 UX (2026-08-01) — final-review wizard regression suite.
 *
 * The wizard must never force Step 8 back to Step 7. Navigation and sealing
 * are decoupled: the user may open any step (including the final review),
 * but the seal gate stays fail-closed. These tests cover the pure decision
 * helpers; the DOM interactions (blocker panel, scroll, step buttons) are
 * covered by tests/e2e/critical-flows.spec.ts.
 */
describe("wizard final-review UX (never force Step 8 back to 7)", () => {
  /** Fully evidence-linked, seal-ready case (mirrors the existing fixture). */
  function readyCase(): AuditReadyCase {
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
    return complete;
  }

  /** Seal-ready case with one material evidence gap removed. */
  function blockedCase(): AuditReadyCase {
    const blocked = readyCase();
    blocked.evidenceRegister = blocked.evidenceRegister.filter(
      (record) => !record.linkedInputs.includes("goods.0.productionVolume")
    );
    return blocked;
  }

  // A. Step 8 + readiness false → "Review remaining actions" keeps the step
  //    and reveals the blocker panel; Step 7 is never forced.
  it("A. returns REVEAL_BLOCKERS (stay on Step 8) when readiness is false", () => {
    const decision = evaluateSealAttempt({
      isEligibleForSealing: false,
      correctionRequired: false,
      correctionReason: "",
      entitlementId: "ent_123",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.kind).toBe("REVEAL_BLOCKERS");
    // The failed seal never produces an entitlement id to consume.
    expect("entitlementId" in decision).toBe(false);

    const step8 = validateWizardStep(8, blockedCase());
    expect(step8.valid).toBe(false);
    expect(step8.evidenceIssues.length).toBeGreaterThan(0);

    // The blocker panel content is categorized and carries the step to fix.
    const actions = summarizeStep8Actions(blockedCase());
    expect(actions.length).toBeGreaterThan(0);
    const uploadItem = actions.find((item) => item.category === "Documents to upload");
    expect(uploadItem).toBeDefined();
    expect(uploadItem!.step).toBeGreaterThanOrEqual(1);
    expect(uploadItem!.step).toBeLessThanOrEqual(8);
  });

  // B. handleSeal readiness false → no seal, no entitlement consumption,
  //    step preserved (the decision object carries no entitlement id).
  it("B. a blocked seal can never consume an entitlement", () => {
    const decision = evaluateSealAttempt({
      isEligibleForSealing: false,
      correctionRequired: true,
      correctionReason: "A long enough correction reason",
      entitlementId: "ent_123",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.kind).toBe("REVEAL_BLOCKERS");
    expect("entitlementId" in decision).toBe(false);

    // Even with an entitlement present, readiness gates first and fails closed.
    const gated = evaluateSealAttempt({
      isEligibleForSealing: false,
      correctionRequired: false,
      correctionReason: "",
      entitlementId: "ent_123",
    });
    expect(gated.kind).toBe("REVEAL_BLOCKERS");

    // PROCEED only fires when readiness, correction reason and entitlement pass.
    const proceed = evaluateSealAttempt({
      isEligibleForSealing: true,
      correctionRequired: false,
      correctionReason: "",
      entitlementId: "ent_123",
    });
    expect(proceed.allowed).toBe(true);
    expect(proceed.kind).toBe("PROCEED");
    if (proceed.kind === "PROCEED") {
      expect(proceed.entitlementId).toBe("ent_123");
    } else {
      throw new Error("Expected a PROCEED seal decision.");
    }
  });

  // C. Server seal error → step preserved, user-facing message + technical code.
  it("C. translates seal errors into user language with a separate technical code", () => {
    const sealedMissing = translateSealError(new Error("SEALED_REPORT_ID_MISSING"));
    expect(sealedMissing.userMessage).toMatch(/no extra charge/i);
    expect(sealedMissing.technicalCode).toContain("SEALED_REPORT_ID_MISSING");

    const entitlement = translateSealError(new Error("ENTITLEMENT_REQUIRED"));
    expect(entitlement.userMessage).toMatch(/unpaid/i);
    expect(entitlement.technicalCode).toContain("ENTITLEMENT_REQUIRED");

    const blocker = translateSealError(new Error("SEAL_GATE_BLOCKED_QC_OPEN"));
    expect(blocker.userMessage).toMatch(/nothing was charged/i);
    expect(blocker.technicalCode).toContain("SEAL_GATE_BLOCKED");

    const session = translateSealError(new Error("UNAUTHENTICATED"));
    expect(session.userMessage).toMatch(/session expired/i);

    const permission = translateSealError(new Error("PERMISSION_DENIED"));
    expect(permission.userMessage).toMatch(/not available for your account/i);

    const fallback = translateSealError(new Error("INTERNAL"));
    expect(fallback.userMessage).toMatch(/draft is safe/i);
    expect(fallback.technicalCode).toBe("INTERNAL");
  });

  // D. User-selected remediation → the action list tells the user which step
  //    to fix, and navigation only happens when the user clicks it.
  it("D. categorizes remaining actions with the step to fix and a fixable path", () => {
    const caseData = baseCase();
    caseData.goods[0]!.productionVolume = datum(null);

    const actions = summarizeStep8Actions(caseData, {
      allocationShareTotal: "0.95",
      allocationReconciliationDelta: "0.02",
    });

    const info = actions.find((item) => item.category === "Required information");
    expect(info).toBeDefined();
    expect(info!.fieldPath).toBe("goods.0.productionVolume");
    expect(info!.step).toBe(2);
    expect(info!.why.length).toBeGreaterThan(0);
    expect(info!.acceptedDocuments.length).toBeGreaterThan(0);

    const allocation = actions.find((item) => item.category === "Calculation inconsistencies");
    expect(allocation).toBeDefined();
    expect(allocation!.step).toBe(2);

    // clampWizardStep is a pure clamp: it can only move within 1..8 and never
    // encodes any readiness decision (step 8 stays reachable).
    expect(clampWizardStep(3)).toBe(3);
    expect(clampWizardStep(8)).toBe(8);
    expect(clampWizardStep(9)).toBe(8);
    expect(clampWizardStep(0)).toBe(1);
    expect(clampWizardStep(Number.NaN)).toBe(1);
  });

  // E. URL query sync → ?step=N survives a refresh and out-of-range values
  //    fall back to step 1.
  it("E. parses ?step=N for refresh persistence", () => {
    expect(parseStepFromQuery("8")).toBe(8);
    expect(parseStepFromQuery(["8"])).toBe(8);
    expect(parseStepFromQuery("3")).toBe(3);
    expect(parseStepFromQuery("0")).toBe(1);
    expect(parseStepFromQuery("99")).toBe(8);
    expect(parseStepFromQuery("abc")).toBe(1);
    expect(parseStepFromQuery(null)).toBe(1);
    expect(parseStepFromQuery(undefined)).toBe(1);
  });

  // F. Evidence gaps never block preview, never bypass the gate.
  it("F. Step 8 preview stays open with missing evidence while the seal gate holds", () => {
    const blocked = blockedCase();

    // The final review is still computable and reports NEEDS_DOCUMENTS.
    const step8 = validateWizardStep(8, blocked);
    expect(step8.state).toBe("NEEDS_DOCUMENTS");
    expect(step8.valid).toBe(false);

    // Next is NOT blocked by evidence alone — only missing data blocks Next.
    expect(shouldBlockNext(step8)).toBe(false);
    expect(firstDataIssuePath(step8)).toBeUndefined();

    // The seal gate cannot be bypassed by being on Step 8.
    const decision = evaluateSealAttempt({
      isEligibleForSealing: step8.valid,
      correctionRequired: false,
      correctionReason: "",
      entitlementId: "ent_123",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.kind).toBe("REVEAL_BLOCKERS");
  });

  it("F2. Next is blocked only by missing data, and the first issue is focusable", () => {
    const caseData = baseCase();
    caseData.importerIdentity.eoriNumber = datum("");
    caseData.reportingPeriod.year = datum(null);

    const step1 = validateWizardStep(1, caseData);
    expect(shouldBlockNext(step1)).toBe(true);
    expect(firstDataIssuePath(step1)).toBe("importerIdentity.eoriNumber");
  });

  it("F3. an approved evidence-backed case unlocks the seal decision", () => {
    const decision = evaluateSealAttempt({
      isEligibleForSealing: true,
      correctionRequired: false,
      correctionReason: "",
      entitlementId: "ent_123",
    });
    expect(decision).toEqual({ allowed: true, kind: "PROCEED", entitlementId: "ent_123" });
  });
});
