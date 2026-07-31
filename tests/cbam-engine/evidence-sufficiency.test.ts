import { describe, it, expect } from "vitest";
import type { AuditReadyCase, EvidenceRecord } from "../../functions/src/cbam/schema";
import {
  runEvidenceSufficiency,
  gradeEvidenceRecord,
  isEvidenceSupportedState,
} from "../../functions/src/cbam/validation/evidence-sufficiency";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    evidenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentType: "CALIBRATION_CERTIFICATE",
    fileName: "calibration.pdf",
    storagePath: `evidence/verifier-grade-user/case_verifier_grade_fixture/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/calibration.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    issuer: "Accredited Calibration Laboratory",
    issueDate: "2026-01-15",
    reportingPeriod: "2026 ANNUAL",
    fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    uploadTimestamp: "2026-01-16T00:00:00.000Z",
    uploader: "data-preparer",
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs: ["directEmissions"],
    linkedCalculations: [],
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
    ...overrides,
  };
}

function evidenceRecord(
  index: number,
  issuer: string,
  linkedInputs: string[],
  documentType = "VERIFICATION_DOCUMENT"
): EvidenceRecord {
  const evidenceId = `cccccccc-${String(index).padStart(4, "0")}-4ccc-8ccc-${String(index).padStart(12, "0")}`;
  return {
    evidenceId,
    documentType,
    fileName: `evidence-${index}.pdf`,
    storagePath: `evidence/verifier-grade-user/case_verifier_grade_fixture/${evidenceId}/evidence-${index}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1024 + index,
    issuer,
    issueDate: "2026-02-01",
    reportingPeriod: "2026 ANNUAL",
    fileHash: `${String(index).padStart(2, "0")}${"a".repeat(62)}`,
    uploadTimestamp: "2026-02-02T00:00:00.000Z",
    uploader: "data-preparer",
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs,
    linkedCalculations: [],
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
  };
}

/** Strip stray datum evidenceId defaults that create phantom UNLINKED rows. */
function stripDatumEvidenceIds<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripDatumEvidenceIds(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "evidenceId") continue;
      out[key] = stripDatumEvidenceIds(val);
    }
    return out as T;
  }
  return value;
}

/** Fully evidence-linked case: 8 distinct documents, each <= 3 requirement classes. */
function buildFullySupportedCase(): AuditReadyCase {
  const base = createVerifierGradeCase();
  // Extend the fixture's Q1-only evidence to full annual coverage.
  const extended = base.evidenceRegister.map((record) => ({
    ...record,
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
  }));
  return {
    ...stripDatumEvidenceIds(base),
    evidenceRegister: [
      ...extended,
      evidenceRecord(1, "Accredited National Authority", [
        "exporterIdentity.legalName",
        "exporterIdentity.address",
        "importerIdentity.legalName",
        "installation.name",
      ]),
      evidenceRecord(2, "Local Chamber of Commerce", [
        "installation.country",
        "installation.productionRoute",
      ]),
      evidenceRecord(3, "Operator Admin", ["reportingPeriod.year"]),
      evidenceRecord(4, "Regional Tax Authority", [
        "carbonPriceRecords.0.proofOfPaymentEvidenceId",
      ]),
    ],
    methodologyDecisions: [
      {
        decisionId: "dddddddd-0001-4ddd-8ddd-ddddddddddd1",
        topic: "installation.systemBoundaries",
        selectedMethod: "Documented system boundary based on controlled production route.",
        reason: "Boundary confirmed from the controlled route and excluded-process register.",
        legalOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 Article 6.",
        evidenceIds: [],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
  };
}

describe("FAZ 5 — Evidence quality grade", () => {
  it("grades primary independently issued evidence A", () => {
    expect(gradeEvidenceRecord(makeEvidence({ issuer: "Accredited Calibration Laboratory" }))).toBe("A");
  });

  it("grades operator-controlled primary evidence B", () => {
    expect(gradeEvidenceRecord(makeEvidence({ issuer: "Plant Operations Team" }))).toBe("B");
  });

  it("grades supplier declaration with controls C", () => {
    expect(gradeEvidenceRecord(makeEvidence({ issuer: "Raw Material Supplier" }))).toBe("C");
  });

  it("grades secondary or estimated evidence D", () => {
    expect(gradeEvidenceRecord(makeEvidence({ issuer: "Internal Engineering Dept", documentType: "ESTIMATION_NOTE" }))).toBe("D");
  });

  it("grades unsupported or unapproved evidence E", () => {
    expect(gradeEvidenceRecord(makeEvidence({ supportStatus: "UNSUPPORTED" }))).toBe("E");
    expect(gradeEvidenceRecord(makeEvidence({ reviewStatus: "PENDING" }))).toBe("E");
  });
});

describe("FAZ 5 — Supported states", () => {
  it("recognises only the three accepted supported predicates", () => {
    expect(isEvidenceSupportedState("SUPPORTED_BY_EVIDENCE")).toBe(true);
    expect(isEvidenceSupportedState("SUPPORTED_BY_ACCEPTED_METHODOLOGY_DECISION")).toBe(true);
    expect(isEvidenceSupportedState("SUPPORTED")).toBe(true);
    expect(isEvidenceSupportedState("PARTIALLY_SUPPORTED")).toBe(false);
    expect(isEvidenceSupportedState("MISSING")).toBe(false);
  });

  it("emits SUPPORTED_BY_EVIDENCE for evidence-backed material rows in a fully-linked case", () => {
    const rows = runEvidenceSufficiency(buildFullySupportedCase(), "2027-01-15T12:00:00.000Z");
    const supported = rows.filter((r) => isEvidenceSupportedState(r.state));
    expect(supported.length).toBeGreaterThan(0);
    const byEvidence = rows.filter((r) => r.supportBasis === "SUPPORTED_BY_EVIDENCE");
    expect(byEvidence.length).toBeGreaterThan(0);
    for (const row of byEvidence) {
      expect(row.state).toBe("SUPPORTED_BY_EVIDENCE");
      expect(row.evidenceIds.length).toBeGreaterThan(0);
    }
    const material = rows.filter((r) => r.blocksSealing);
    expect(material.length).toBe(0);
  });

  it("shows MISSING (never SUPPORTED) for a field without evidence ID and without accepted decision", () => {
    const base = createVerifierGradeCase();
    const gutted: AuditReadyCase = {
      ...base,
      evidenceRegister: [],
      methodologyDecisions: [],
    };
    const rows = runEvidenceSufficiency(gutted, "2027-01-15T12:00:00.000Z");
    const uncovered = rows.find((r) => r.inputPath.includes("systemBoundary"));
    if (uncovered) {
      expect(isEvidenceSupportedState(uncovered.state)).toBe(false);
    }
    // No row may claim SUPPORTED_BY_EVIDENCE without evidence ids.
    for (const row of rows) {
      if (row.supportBasis === "SUPPORTED_BY_EVIDENCE") {
        expect(row.evidenceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("downgrades material rows grounded only in D/E quality evidence", () => {
    const base = buildFullySupportedCase();
    const dGradeEvidence: AuditReadyCase = {
      ...base,
      evidenceRegister: base.evidenceRegister.map((record) =>
        record.linkedInputs.includes("directEmissions")
          ? { ...record, issuer: "Internal Engineering Dept", documentType: "ESTIMATION_NOTE" }
          : record
      ),
    };
    const rows = runEvidenceSufficiency(dGradeEvidence, "2027-01-15T12:00:00.000Z");
    const degraded = rows.find((r) => r.reasonCodes.includes("MATERIAL_EVIDENCE_QUALITY_D_OR_E"));
    expect(degraded).toBeDefined();
    expect(degraded!.state).toBe("PARTIALLY_SUPPORTED");
    expect(degraded!.blocksSealing).toBe(true);
    expect(degraded!.materialQualityGateBlocked).toBe(true);
    // No material row may reach a supported state on D/E evidence alone.
    for (const row of rows) {
      if (row.evidenceQualityGrade === "D" || row.evidenceQualityGrade === "E") {
        expect(isEvidenceSupportedState(row.state)).toBe(false);
      }
    }
  });

  it("accepts a supported row via an accepted methodology decision", () => {
    // buildFullySupportedCase ships an accepted systemBoundary decision, so
    // the boundary row must resolve to the decision-backed supported state.
    const rows = runEvidenceSufficiency(buildFullySupportedCase(), "2027-01-15T12:00:00.000Z");
    const bounds = rows.find((r) => r.inputPath.includes("systemBoundaries"));
    expect(bounds).toBeDefined();
    expect(bounds!.state).toBe("SUPPORTED_BY_ACCEPTED_METHODOLOGY_DECISION");
    expect(bounds!.supportBasis).toBe("SUPPORTED_BY_ACCEPTED_METHODOLOGY_DECISION");
    expect(bounds!.methodologyDecisionId).toBe("dddddddd-0001-4ddd-8ddd-ddddddddddd1");
    expect(bounds!.blocksSealing).toBe(false);
  });
});

