/**
 * FAZ UX (2026-08-01) — Step 8 status semantics.
 *
 * Step 8 uses a dedicated status model (BLOCKED / PAYMENT_REQUIRED /
 * READY_TO_LOCK / LOCKING / LOCKED / LOCK_FAILED) and can never be COMPLETE.
 * Readiness (preparation) and entitlement (payment) are separate:
 *   - blockers open ⇒ BLOCKED even if the file is paid;
 *   - readiness pass + no entitlement ⇒ PAYMENT_REQUIRED;
 *   - readiness pass + entitlement ⇒ READY_TO_LOCK (only state with a lock CTA).
 * "COMPLETE" and "PACKAGE INTEGRITY NOT READY" can never coexist.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import {
  deriveStep8Status,
  STEP8_FOOTER_CTA_LABELS,
  validateWizardStep,
} from "@/lib/cbam/wizard-validation";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

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
    caseId: "case_wizard_semantics_2026",
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

function linkEvidence(caseData: AuditReadyCase, evidenceId: string, pathName: string, documentType = "CUSTOMS_DECLARATION") {
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
    linkedInputs: [pathName],
    linkedCalculations: [],
    reviewerNotes: "Server review approved the linked input.",
    issuerCategory: "CUSTOMS_AUTHORITY",
    documentAuthority: "OFFICIAL",
    qualityGrade: "A",
    qualityAssessmentBasis: "Official customs authority record.",
    qualityAssessedBy: "Server Review Engine",
    qualityAssessedAt: "2027-01-15T00:00:00.000Z",
  });
  return caseData;
}

/** Seal-ready, fully evidence-linked case. */
function readyCase(): AuditReadyCase {
  const complete = baseCase();
  const links: Array<[string, string]> = [
    ["E1", "importerIdentity.eoriNumber"],
    ["E2", "importerIdentity.legalName"],
    ["E3", "exporterIdentity.legalName"],
    ["E4", "exporterIdentity.address"],
    ["E5", "reportingPeriod.year"],
    ["E6", "installation.name"],
    ["E7", "installation.country"],
    ["E8", "installation.productionRoute"],
    ["E9", "installation.systemBoundaries"],
    ["E10", "goods.0.cnCode"],
    ["E11", "goods.0.productionVolume"],
    ["E12", "directEmissions"],
    ["E13", "electricityConsumed"],
    ["E14", "gridEmissionFactor"],
  ];
  for (const [id, input] of links) {
    linkEvidence(complete, id, input, id === "E9" ? "MONITORING_PLAN" : id === "E10" ? "CUSTOMS_DECLARATION" : "PRIMARY_SOURCE_RECORD");
  }
  return complete;
}

describe("Step 8 status model", () => {
  it("never derives COMPLETE for step 8 — with or without blockers", () => {
    const ready = readyCase();
    const readyValidation = validateWizardStep(8, ready);
    expect(readyValidation.valid).toBe(true);
    expect(readyValidation.state).not.toBe("COMPLETE");

    // Blocked case (one material evidence gap removed).
    const blocked = readyCase();
    blocked.evidenceRegister = blocked.evidenceRegister.filter(
      (record) => !record.linkedInputs.includes("goods.0.productionVolume")
    );
    const blockedValidation = validateWizardStep(8, blocked);
    expect(blockedValidation.valid).toBe(false);
    expect(blockedValidation.state).not.toBe("COMPLETE");
    expect(blockedValidation.state).toBe("NEEDS_DOCUMENTS");
  });

  it("derives BLOCKED when readiness is not eligible or blockers exist, even when paid", () => {
    expect(deriveStep8Status({ isEligibleForSealing: false, criticalBlockerCount: 0, hasEntitlement: true, lockState: "IDLE" })).toBe("BLOCKED");
    expect(deriveStep8Status({ isEligibleForSealing: true, criticalBlockerCount: 2, hasEntitlement: true, lockState: "IDLE" })).toBe("BLOCKED");
    expect(deriveStep8Status({ isEligibleForSealing: true, criticalBlockerCount: 0, hasEntitlement: true, lockState: "IDLE" })).toBe("READY_TO_LOCK");
  });

  it("derives PAYMENT_REQUIRED when readiness passes but no entitlement exists", () => {
    expect(deriveStep8Status({ isEligibleForSealing: true, criticalBlockerCount: 0, hasEntitlement: false, lockState: "IDLE" })).toBe("PAYMENT_REQUIRED");
  });

  it("precedence: LOCKING > LOCKED > LOCK_FAILED > readiness/payment", () => {
    expect(deriveStep8Status({ isEligibleForSealing: false, criticalBlockerCount: 3, hasEntitlement: false, lockState: "LOCKING" })).toBe("LOCKING");
    expect(deriveStep8Status({ isEligibleForSealing: false, criticalBlockerCount: 3, hasEntitlement: false, lockState: "LOCKED", lockedReportId: "report_x" })).toBe("LOCKED");
    expect(deriveStep8Status({ isEligibleForSealing: true, criticalBlockerCount: 0, hasEntitlement: true, lockState: "LOCK_FAILED" })).toBe("LOCK_FAILED");
  });

  it("no lock CTA while blockers are open: BLOCKED and PAYMENT_REQUIRED never carry a lock label", () => {
    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).toBe("Review remaining requirements");
    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Review remaining requirements");
    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Lock & download package");
    // Only READY_TO_LOCK/LOCKING/LOCKED states may claim a lock action.
    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).not.toMatch(/lock/i);
    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).not.toMatch(/lock/i);
    expect(STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED).not.toMatch(/Lock & download/i);
    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toMatch(/Lock & download/i);
    expect(STEP8_FOOTER_CTA_LABELS.LOCKING).toMatch(/Creating package/i);
    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toMatch(/Open sealed release/i);
  });

  it("payment readiness never claims lock-allowed while blockers are open", () => {
    const journeyStrip = readSource("components/cbam/WorkingFileJourneyStrip.tsx");
    expect(journeyStrip.toLowerCase()).not.toContain("lock allowed");
    for (const label of Object.values(STEP8_FOOTER_CTA_LABELS)) {
      expect(label.toLowerCase()).not.toContain("lock allowed");
    }
  });

  it("COMPLETE and PACKAGE INTEGRITY NOT READY can never coexist on step 8", () => {
    const ready = readyCase();
    const blocked = readyCase();
    blocked.evidenceRegister = [];
    blocked.methodologyDecisions = [];

    const readyStatus = deriveStep8Status({ isEligibleForSealing: true, criticalBlockerCount: 0, hasEntitlement: true, lockState: "IDLE" });
    const blockedStatus = deriveStep8Status({ isEligibleForSealing: false, criticalBlockerCount: 1, hasEntitlement: true, lockState: "IDLE" });

    // The ready state never renders COMPLETE, and the blocked state renders a
    // blocked footer CTA (never a completed/lock claim).
    expect(readyStatus).not.toBe("COMPLETE");
    expect(validateWizardStep(8, ready).state).not.toBe("COMPLETE");
    expect(blockedStatus).toBe("BLOCKED");
    expect(STEP8_FOOTER_CTA_LABELS[blockedStatus]).toContain("Review");
  });
});
