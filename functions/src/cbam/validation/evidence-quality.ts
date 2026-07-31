/**
 * Structured evidence quality grading (FAZ P0) — functions-side canonical
 * grader used by the evidence-sufficiency engine and the review callable.
 *
 * Quality grades are derived ONLY from structured metadata
 * (issuerCategory, documentAuthority, officialReference,
 * accreditationReference and server review state). The free-text issuer
 * string is never scanned for keywords, so a document grade cannot be
 * manipulated by wording an issuer name.
 *
 * Grade semantics:
 *   A — official authority, registry, grid operator, accredited body or
 *       independently verified primary document.
 *   B — operator-controlled primary record with internal control and
 *       reviewer approval.
 *   C — supplier declaration with supporting controls.
 *   D — secondary, estimated, or a record without sufficient authority trace.
 *   E — unsupported, rejected, malware uncleared or missing.
 *   PENDING — reassessment required; legacy records without structured
 *       metadata are never auto-graded A/B.
 */

import type { EvidenceRecord } from "../schema";
import type { EvidenceQualityGrade as ReportEvidenceQualityGrade } from "../report/premium-dossier-schema";

export type EvidenceQualityGrade = ReportEvidenceQualityGrade | "PENDING";

export interface EvidenceQualityInput {
  /** Free-text issuer string. Accepted by the type for caller ergonomics but
   * deliberately NEVER read by the grader — grades are derived exclusively
   * from structured metadata so wording cannot influence quality. */
  issuer?: string | null;
  issuerCategory?: string | null;
  documentAuthority?: string | null;
  officialReference?: string | null;
  accreditationReference?: string | null;
  reviewStatus?: string | null;
  supportStatus?: string | null;
  malwareScanStatus?: string | null;
  sourceType?: string | null;
  qualityGrade?: string | null;
  qualityAssessedBy?: string | null;
  qualityAssessedAt?: string | null;
}

export interface EvidenceQualityAssessment {
  grade: EvidenceQualityGrade;
  basis: string;
  reasons: string[];
}

const INDEPENDENT_AUTHORITY_CATEGORIES = new Set<string>([
  "GOVERNMENT_AUTHORITY",
  "CUSTOMS_AUTHORITY",
  "NATIONAL_REGISTRY",
  "GRID_OPERATOR",
  "REGULATED_UTILITY",
  "ACCREDITED_LAB",
  "ACCREDITED_VERIFICATION_BODY",
  "INDEPENDENT_AUDITOR",
]);

export function assessEvidenceQuality(input: EvidenceQualityInput): EvidenceQualityAssessment {
  const reviewStatus = String(input.reviewStatus || "PENDING").toUpperCase();
  const supportStatus = String(input.supportStatus || "PENDING").toUpperCase();
  const malwareScanStatus = String(input.malwareScanStatus || "PENDING").toUpperCase();
  const issuerCategory = input.issuerCategory ? String(input.issuerCategory).toUpperCase() : "";
  const documentAuthority = input.documentAuthority
    ? String(input.documentAuthority).toUpperCase()
    : "";
  const sourceType = input.sourceType ? String(input.sourceType).toUpperCase() : "";

  // Fail-closed states.
  if (
    supportStatus === "UNSUPPORTED" ||
    supportStatus === "PENDING" ||
    reviewStatus !== "APPROVED" ||
    malwareScanStatus !== "CLEAN"
  ) {
    return {
      grade: "E",
      basis: "UNSUPPORTED_REJECTED_OR_MALWARE_UNCLEARED",
      reasons: ["SUPPORT_REJECTED_OR_MALWARE_UNCLEARED"],
    };
  }

  // Legacy record without structured metadata: never auto A/B.
  if (!issuerCategory || !documentAuthority) {
    return {
      grade: "PENDING",
      basis: "STRUCTURED_METADATA_MISSING_REVIEW_REQUIRED",
      reasons: ["LEGACY_RECORD_WITHOUT_STRUCTURED_METADATA"],
    };
  }

  // A server-assessed explicit grade with assessment provenance wins.
  if (
    input.qualityGrade &&
    input.qualityGrade !== "PENDING" &&
    input.qualityAssessedBy &&
    input.qualityAssessedAt
  ) {
    return {
      grade: input.qualityGrade as EvidenceQualityGrade,
      basis: "SERVER_ASSESSED_EXPLICIT_GRADE",
      reasons: ["SERVER_ASSESSED_GRADE"],
    };
  }

  switch (documentAuthority) {
    case "OFFICIAL":
    case "INDEPENDENT":
      if (INDEPENDENT_AUTHORITY_CATEGORIES.has(issuerCategory)) {
        return {
          grade: "A",
          basis: "OFFICIAL_AUTHORITY_DOCUMENT",
          reasons: ["OFFICIAL_AUTHORITY_DOCUMENT"],
        };
      }
      if (issuerCategory === "OPERATOR_CONTROLLED") {
        return {
          grade: "B",
          basis: "OPERATOR_PRIMARY_RECORD_WITH_INTERNAL_CONTROL",
          reasons: ["OPERATOR_CONTROLLED_RECORD"],
        };
      }
      if (issuerCategory === "SUPPLIER") {
        return {
          grade: "C",
          basis: "SUPPLIER_DECLARATION_WITH_SUPPORTING_CONTROLS",
          reasons: ["SUPPLIER_DECLARATION"],
        };
      }
      return { grade: "D", basis: "INSUFFICIENT_AUTHORITY_TRACE", reasons: ["INSUFFICIENT_AUTHORITY_TRACE"] };
    case "OPERATOR":
      return issuerCategory === "SUPPLIER"
        ? { grade: "C", basis: "SUPPLIER_DECLARATION_WITH_SUPPORTING_CONTROLS", reasons: ["SUPPLIER_DECLARATION"] }
        : { grade: "B", basis: "OPERATOR_PRIMARY_RECORD_WITH_INTERNAL_CONTROL", reasons: ["OPERATOR_CONTROLLED_RECORD"] };
    case "SUPPLIER":
      return { grade: "C", basis: "SUPPLIER_DECLARATION_WITH_SUPPORTING_CONTROLS", reasons: ["SUPPLIER_DECLARATION"] };
    case "SECONDARY":
      return { grade: "D", basis: "SECONDARY_SOURCE", reasons: ["SECONDARY_SOURCE"] };
    default:
      if (sourceType === "ESTIMATED") {
        return { grade: "D", basis: "ESTIMATED_VALUE", reasons: ["ESTIMATED_VALUE"] };
      }
      return { grade: "D", basis: "INSUFFICIENT_AUTHORITY_TRACE", reasons: ["INSUFFICIENT_AUTHORITY_TRACE"] };
  }
}

/** Grade only for a full evidence record (A-E/PENDING). */
export function gradeEvidenceRecord(
  record: EvidenceRecord | EvidenceQualityInput
): EvidenceQualityGrade {
  return assessEvidenceQuality(record).grade;
}
