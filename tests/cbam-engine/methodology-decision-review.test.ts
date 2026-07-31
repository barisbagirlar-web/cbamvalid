/**
 * FAZ P0 (I) — Methodology decision review security.
 *
 * A user-created methodology decision must never carry reviewStatus ACCEPTED.
 * New records are REVIEW_REQUIRED; ACCEPTED is a server-controlled outcome
 * that requires full approval provenance (approverName, approverRole,
 * approvedAt).
 *
 * installation.systemBoundaries may be supported by approved evidence OR by a
 * genuinely reviewed ACCEPTED methodology decision — a REVIEW_REQUIRED
 * decision is not sufficient.
 */

import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema, type MethodologyDecision } from "@/lib/cbam/schema";
import { validateWizardStep } from "@/lib/cbam/wizard-validation";
import type { AuditReadyCase } from "@/lib/cbam/schema";

const APPROVER_FIELDS = {
  approverName: "Sandbox Internal Reviewer",
  approverRole: "INTERNAL_REVIEWER",
  approvedAt: "2027-01-21T10:00:00.000Z",
};

function decision(overrides: Partial<MethodologyDecision>): MethodologyDecision {
  return {
    decisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    topic: "SYSTEM_BOUNDARY",
    selectedMethod: "System boundary per installation monitoring plan and process map",
    reason: "The monitoring plan documents the controlled boundary.",
    legalOrTechnicalBasis: "Regulation (EU) 2023/956 Annex IV; Commission Implementing Regulation (EU) 2025/2547.",
    evidenceIds: [],
    reviewStatus: "REVIEW_REQUIRED",
    rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    ...overrides,
  };
}

function wizardCase(): AuditReadyCase {
  const datum = (value: string | number | null, evidenceId?: string) => ({
    value,
    ...(evidenceId ? { evidenceId } : {}),
    sourceType: "PRIMARY" as const,
    confidenceStatus: "HIGH_VERIFIED" as const,
    documentReference: "Methodology security test record",
    measurementMethod: "Documented direct measurement",
    responsiblePerson: "Test monitoring manager",
  });
  return {
    caseId: "case_methodology_security_2026",
    status: "DRAFT",
    version: 1,
    ownerId: "methodology-test-owner",
    importerIdentity: { legalName: datum("Importer GmbH"), eoriNumber: datum("DE1234567890"), address: datum("Hamburg, Germany") },
    exporterIdentity: { legalName: datum("Exporter SA"), address: datum("City, Country"), exporterCountry: datum("TR") },
    reportingPeriod: { year: datum("2026"), quarter: datum("ANNUAL"), startDate: datum("2026-01-01"), endDate: datum("2026-12-31") },
    goods: [],
    installation: {
      name: datum("Test Installation"),
      country: datum("TR"),
      productionRoute: datum("Test route"),
      systemBoundaries: "Controlled boundary per monitoring plan.",
      monitoringPlanId: datum("MP-METHOD-2026-v1"),
    },
    directEmissions: datum("12000"),
    electricityConsumed: datum("5000"),
    gridEmissionFactor: datum("0.3830"),
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

describe("methodology decision security", () => {
  it("rejects a self-asserted ACCEPTED decision without approval provenance", () => {
    const selfApproved = decision({ reviewStatus: "ACCEPTED" });
    const parsed = AuditReadyCaseSchema.safeParse({ ...wizardCase(), methodologyDecisions: [selfApproved] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(" | ");
      expect(messages).toContain("approverName");
      expect(messages).toContain("approverRole");
      expect(messages).toContain("approvedAt");
    }
  });

  it("accepts an ACCEPTED decision that carries full server review provenance", () => {
    const reviewed = decision({ reviewStatus: "ACCEPTED", ...APPROVER_FIELDS });
    const parsed = AuditReadyCaseSchema.safeParse({ ...wizardCase(), methodologyDecisions: [reviewed] });
    expect(parsed.success).toBe(true);
  });

  it("keeps user-created REVIEW_REQUIRED records valid without approver fields", () => {
    const userCreated = decision({ reviewStatus: "REVIEW_REQUIRED" });
    const parsed = AuditReadyCaseSchema.safeParse({ ...wizardCase(), methodologyDecisions: [userCreated] });
    expect(parsed.success).toBe(true);
  });

  it("does not let a REVIEW_REQUIRED decision support the system boundary", () => {
    const caseData = wizardCase();
    caseData.methodologyDecisions = [decision({ reviewStatus: "REVIEW_REQUIRED" })];
    const validation = validateWizardStep(3, caseData);
    const boundaryIssue = validation.evidenceIssues.find((issue) => issue.fieldPath === "installation.systemBoundaries");
    expect(boundaryIssue).toBeDefined();
  });

  it("lets a genuinely reviewed ACCEPTED decision support the system boundary", () => {
    const caseData = wizardCase();
    caseData.methodologyDecisions = [decision({ reviewStatus: "ACCEPTED", ...APPROVER_FIELDS })];
    const validation = validateWizardStep(3, caseData);
    const boundaryIssue = validation.evidenceIssues.find((issue) => issue.fieldPath === "installation.systemBoundaries");
    expect(boundaryIssue).toBeUndefined();
  });
});
