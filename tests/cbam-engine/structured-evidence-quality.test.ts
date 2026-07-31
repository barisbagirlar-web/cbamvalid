/**
 * FAZ P0 (I) — Structured evidence quality grading.
 *
 * Evidence quality class must be derived from structured metadata
 * (issuerCategory, documentAuthority, review/support/malware state) and must
 * NOT be derived from keywords inside the free-text issuer name.
 *
 * Legacy records without structured metadata must never auto-grade A/B; they
 * are returned as PENDING (re-review required) or D.
 */

import { describe, expect, it } from "vitest";
import { assessEvidenceQuality, gradeEvidenceRecord } from "@/lib/cbam/evidence-quality";
import { assessEvidenceQuality as serverAssessEvidenceQuality, gradeEvidenceRecord as serverGradeEvidenceRecord } from "../../functions/src/cbam/validation/evidence-quality";

const base = {
  reviewStatus: "APPROVED",
  supportStatus: "SUPPORTED",
  malwareScanStatus: "CLEAN",
};

describe("structured evidence quality grading", () => {
  it("never lets issuer-name wording change the grade", () => {
    // The word "accredited" and "authority" appear in the free-text issuer, but
    // the structured fields say OPERATOR / OPERATOR. The grade must stay B.
    const record = {
      ...base,
      issuer: "Independent Accredited Authority of Records",
      issuerCategory: "OPERATOR_CONTROLLED",
      documentAuthority: "OPERATOR",
    };
    expect(gradeEvidenceRecord(record)).toBe("B");

    const sameGradeAsPlainIssuer = gradeEvidenceRecord({
      ...base,
      issuer: "Regular operating company",
      issuerCategory: "OPERATOR_CONTROLLED",
      documentAuthority: "OPERATOR",
    });
    expect(sameGradeAsPlainIssuer).toBe("B");
  });

  it("does not boost a supplier-grade record because the issuer text mentions government", () => {
    const record = {
      ...base,
      issuer: "Ministry of Industry and Trade (on behalf of supplier)",
      issuerCategory: "SUPPLIER",
      documentAuthority: "SUPPLIER",
    };
    expect(gradeEvidenceRecord(record)).toBe("C");
  });

  it("grades official authority documents as A", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "CUSTOMS_AUTHORITY",
        documentAuthority: "OFFICIAL",
      })
    ).toBe("A");
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "GRID_OPERATOR",
        documentAuthority: "OFFICIAL",
      })
    ).toBe("A");
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "ACCREDITED_VERIFICATION_BODY",
        documentAuthority: "INDEPENDENT",
      })
    ).toBe("A");
  });

  it("grades operator primary records with internal control as B", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "OPERATOR_CONTROLLED",
        documentAuthority: "OPERATOR",
      })
    ).toBe("B");
  });

  it("grades supplier declarations as C", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SUPPLIER",
        documentAuthority: "SUPPLIER",
      })
    ).toBe("C");
  });

  it("grades secondary or estimated records as D", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SECONDARY_SOURCE",
        documentAuthority: "SECONDARY",
      })
    ).toBe("D");
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SECONDARY_SOURCE",
        documentAuthority: "OFFICIAL",
        sourceType: "ESTIMATED",
      })
    ).toBe("D");
  });

  it("grades secondary-category documents as D even when the authority label says OPERATOR or SUPPLIER", () => {
    // Brittle-grading regression: a record whose issuerCategory is
    // SECONDARY_SOURCE must never be promoted to B/C by a flattering
    // documentAuthority label. The structural category caps the grade at D.
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SECONDARY_SOURCE",
        documentAuthority: "OPERATOR",
      })
    ).toBe("D");
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SECONDARY_SOURCE",
        documentAuthority: "SUPPLIER",
      })
    ).toBe("D");
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "SECONDARY_SOURCE",
        documentAuthority: "INDEPENDENT",
      })
    ).toBe("D");
    expect(serverGradeEvidenceRecord({
      ...base,
      issuerCategory: "SECONDARY_SOURCE",
      documentAuthority: "OPERATOR",
    })).toBe("D");
    expect(serverGradeEvidenceRecord({
      ...base,
      issuerCategory: "SECONDARY_SOURCE",
      documentAuthority: "SUPPLIER",
    })).toBe("D");
  });

  it("ignores an out-of-enum explicit qualityGrade instead of leaking it into the report", () => {
    const assessment = assessEvidenceQuality({
      ...base,
      issuerCategory: "GOVERNMENT_AUTHORITY",
      documentAuthority: "OFFICIAL",
      qualityGrade: "Z",
      qualityAssessedBy: "reviewer@cbamvalid.com",
      qualityAssessedAt: "2026-07-31T10:00:00.000Z",
    });
    // Z is not a valid grade: the grader must fall through to structural
    // grading (A) rather than propagate an invented grade.
    expect(assessment.grade).toBe("A");
    expect(assessment.basis).toBe("OFFICIAL_AUTHORITY_DOCUMENT");

    const server = serverAssessEvidenceQuality({
      ...base,
      issuerCategory: "GOVERNMENT_AUTHORITY",
      documentAuthority: "OFFICIAL",
      qualityGrade: "INVALID",
      qualityAssessedBy: "reviewer@cbamvalid.com",
      qualityAssessedAt: "2026-07-31T10:00:00.000Z",
    });
    expect(server.grade).toBe("A");
  });

  it("honours a valid server-assessed explicit grade only with provenance", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "OPERATOR_CONTROLLED",
        documentAuthority: "OPERATOR",
        qualityGrade: "C",
        qualityAssessedBy: "reviewer@cbamvalid.com",
        qualityAssessedAt: "2026-07-31T10:00:00.000Z",
      })
    ).toBe("C");
    // Without provenance the explicit grade is ignored.
    expect(
      gradeEvidenceRecord({
        ...base,
        issuerCategory: "OPERATOR_CONTROLLED",
        documentAuthority: "OPERATOR",
        qualityGrade: "A",
      })
    ).toBe("B");
  });

  it("grades unsupported, rejected or malware-uncleared records as E", () => {
    expect(
      gradeEvidenceRecord({
        ...base,
        supportStatus: "UNSUPPORTED",
        issuerCategory: "GOVERNMENT_AUTHORITY",
        documentAuthority: "OFFICIAL",
      })
    ).toBe("E");
    expect(
      gradeEvidenceRecord({
        ...base,
        reviewStatus: "REJECTED",
        issuerCategory: "GOVERNMENT_AUTHORITY",
        documentAuthority: "OFFICIAL",
      })
    ).toBe("E");
    expect(
      gradeEvidenceRecord({
        ...base,
        malwareScanStatus: "PENDING",
        issuerCategory: "GOVERNMENT_AUTHORITY",
        documentAuthority: "OFFICIAL",
      })
    ).toBe("E");
  });

  it("never auto-grades a legacy record without structured metadata", () => {
    const legacy = {
      ...base,
      issuer: "Customs Administration — official accredited authority",
      // no issuerCategory / no documentAuthority
    };
    expect(gradeEvidenceRecord(legacy)).toBe("PENDING");
  });

  it("is deterministic for the same structured metadata", () => {
    const record = {
      ...base,
      issuerCategory: "GOVERNMENT_AUTHORITY",
      documentAuthority: "OFFICIAL",
    };
    const grades = new Set(Array.from({ length: 10 }, () => gradeEvidenceRecord(record)));
    expect(grades.size).toBe(1);
    expect(grades.has("A")).toBe(true);
  });

  it("mirrors the server-side grading engine", () => {
    const cases = [
      { issuerCategory: "CUSTOMS_AUTHORITY", documentAuthority: "OFFICIAL", expected: "A" },
      { issuerCategory: "OPERATOR_CONTROLLED", documentAuthority: "OPERATOR", expected: "B" },
      { issuerCategory: "SUPPLIER", documentAuthority: "SUPPLIER", expected: "C" },
      { issuerCategory: "SECONDARY_SOURCE", documentAuthority: "SECONDARY", expected: "D" },
      { supportStatus: "UNSUPPORTED", expected: "E" },
    ];
    for (const scenario of cases) {
      const input = { ...base, ...scenario };
      expect(assessEvidenceQuality(input).grade).toBe(scenario.expected);
      expect(serverAssessEvidenceQuality(input).grade).toBe(scenario.expected);
      expect(serverGradeEvidenceRecord(input)).toBe(scenario.expected);
    }

    const legacy = { ...base, issuer: "Customs administration" };
    expect(serverGradeEvidenceRecord(legacy)).toBe("PENDING");
  });
});
