/**
 * Client-side mirror of the canonical evidence quality + independent-
 * verifiability assessment. A-E grade and verifiability are separate axes.
 */
import type { EvidenceRecord } from "./schema";

export type EvidenceQualityGrade = "A" | "B" | "C" | "D" | "E" | "PENDING";
export type EvidenceVerifiabilityState =
  | "INDEPENDENTLY_VERIFIABLE"
  | "STRUCTURALLY_VERIFIABLE"
  | "WEAK"
  | "UNVERIFIABLE";

export interface EvidenceQualityInput {
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

export interface EvidenceVerifiabilityInput extends EvidenceQualityInput {
  fileHash?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  issueDate?: string | null;
  uploadTimestamp?: string | null;
}

export interface EvidenceQualityAssessment {
  grade: EvidenceQualityGrade;
  basis: string;
  reasons: string[];
}

export interface EvidenceVerifiabilityAssessment {
  state: EvidenceVerifiabilityState;
  basis: string;
  metadataIntegrity: "PASS" | "FAIL";
  authorityTrace: string;
  externalCredentialReference: string;
  warnings: string[];
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

const VALID_QUALITY_GRADES = new Set<string>(["A", "B", "C", "D", "E", "PENDING"]);

export function assessEvidenceQuality(input: EvidenceQualityInput): EvidenceQualityAssessment {
  const reviewStatus = String(input.reviewStatus || "PENDING").toUpperCase();
  const supportStatus = String(input.supportStatus || "PENDING").toUpperCase();
  const malwareScanStatus = String(input.malwareScanStatus || "PENDING").toUpperCase();
  const issuerCategory = input.issuerCategory ? String(input.issuerCategory).toUpperCase() : "";
  const documentAuthority = input.documentAuthority ? String(input.documentAuthority).toUpperCase() : "";
  const sourceType = input.sourceType ? String(input.sourceType).toUpperCase() : "";

  if (
    supportStatus === "UNSUPPORTED" ||
    supportStatus === "PENDING" ||
    reviewStatus !== "APPROVED" ||
    malwareScanStatus !== "CLEAN"
  ) {
    return { grade: "E", basis: "UNSUPPORTED_REJECTED_OR_MALWARE_UNCLEARED", reasons: ["SUPPORT_REJECTED_OR_MALWARE_UNCLEARED"] };
  }
  if (!issuerCategory || !documentAuthority) {
    return { grade: "PENDING", basis: "STRUCTURED_METADATA_MISSING_REVIEW_REQUIRED", reasons: ["LEGACY_RECORD_WITHOUT_STRUCTURED_METADATA"] };
  }
  if (
    input.qualityGrade &&
    VALID_QUALITY_GRADES.has(String(input.qualityGrade).toUpperCase()) &&
    String(input.qualityGrade).toUpperCase() !== "PENDING" &&
    input.qualityAssessedBy &&
    input.qualityAssessedAt
  ) {
    return { grade: String(input.qualityGrade).toUpperCase() as EvidenceQualityGrade, basis: "SERVER_ASSESSED_EXPLICIT_GRADE", reasons: ["SERVER_ASSESSED_GRADE"] };
  }
  if (issuerCategory === "SECONDARY_SOURCE") return { grade: "D", basis: "SECONDARY_SOURCE", reasons: ["SECONDARY_SOURCE"] };
  switch (documentAuthority) {
    case "OFFICIAL":
    case "INDEPENDENT":
      if (INDEPENDENT_AUTHORITY_CATEGORIES.has(issuerCategory)) return { grade: "A", basis: "OFFICIAL_AUTHORITY_DOCUMENT", reasons: ["OFFICIAL_AUTHORITY_DOCUMENT"] };
      if (issuerCategory === "OPERATOR_CONTROLLED") return { grade: "B", basis: "OPERATOR_PRIMARY_RECORD_WITH_INTERNAL_CONTROL", reasons: ["OPERATOR_CONTROLLED_RECORD"] };
      if (issuerCategory === "SUPPLIER") return { grade: "C", basis: "SUPPLIER_DECLARATION_WITH_SUPPORTING_CONTROLS", reasons: ["SUPPLIER_DECLARATION"] };
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
      if (sourceType === "ESTIMATED") return { grade: "D", basis: "ESTIMATED_VALUE", reasons: ["ESTIMATED_VALUE"] };
      return { grade: "D", basis: "INSUFFICIENT_AUTHORITY_TRACE", reasons: ["INSUFFICIENT_AUTHORITY_TRACE"] };
  }
}

export function assessEvidenceVerifiability(input: EvidenceVerifiabilityInput): EvidenceVerifiabilityAssessment {
  const issuerCategory = String(input.issuerCategory || "").toUpperCase();
  const documentAuthority = String(input.documentAuthority || "").toUpperCase();
  const externalCredentialReference = String(input.accreditationReference || input.officialReference || "").trim() || "NOT_RECORDED";
  const hashOk = /^[a-f0-9]{64}$/i.test(String(input.fileHash || ""));
  const bytesOk = Number.isFinite(Number(input.sizeBytes)) && Number(input.sizeBytes) > 0;
  const mimeOk = Boolean(String(input.mimeType || "").trim());
  const issuerOk = Boolean(String(input.issuer || "").trim());
  const issueDateOk = Boolean(String(input.issueDate || "").trim());
  const uploadTimeOk = Number.isFinite(Date.parse(String(input.uploadTimestamp || "")));
  const metadataIntegrity = hashOk && bytesOk && mimeOk && issuerOk && issueDateOk && uploadTimeOk;
  const authorityTrace = `${issuerCategory || "NOT_RECORDED"} / ${documentAuthority || "NOT_RECORDED"}`;
  const independentAuthority = INDEPENDENT_AUTHORITY_CATEGORIES.has(issuerCategory);
  const structuredAuthority = Boolean(issuerCategory && documentAuthority);
  const serverAssessment = Boolean(input.qualityGrade && input.qualityAssessedBy && input.qualityAssessedAt);

  let state: EvidenceVerifiabilityState;
  if (metadataIntegrity && independentAuthority && externalCredentialReference !== "NOT_RECORDED") state = "INDEPENDENTLY_VERIFIABLE";
  else if (metadataIntegrity && structuredAuthority && serverAssessment) state = "STRUCTURALLY_VERIFIABLE";
  else if (metadataIntegrity) state = "WEAK";
  else state = "UNVERIFIABLE";

  const basis = [
    `SHA256=${hashOk ? "PASS" : "FAIL"}`,
    `BYTES=${bytesOk ? "PASS" : "FAIL"}`,
    `MIME=${mimeOk ? "PASS" : "FAIL"}`,
    `ISSUER=${issuerOk ? "PASS" : "FAIL"}`,
    `ISSUE_DATE=${issueDateOk ? "PASS" : "FAIL"}`,
    `UPLOAD_TIMESTAMP=${uploadTimeOk ? "PASS" : "FAIL"}`,
    `AUTHORITY=${authorityTrace}`,
    `EXTERNAL_REFERENCE=${externalCredentialReference}`,
    `SERVER_QUALITY_ASSESSMENT=${serverAssessment ? "RECORDED" : "NOT_RECORDED"}`,
  ].join("; ");

  const warnings: string[] = [];
  if (!metadataIntegrity) warnings.push("Evidence metadata integrity is incomplete; hash/size/type/issuer/date/timestamp must all be recorded.");
  if (!structuredAuthority) warnings.push("Structured issuer category and document authority are missing; A/B authority cannot be independently justified.");
  if (state === "WEAK") warnings.push("Evidence is hash-verifiable but authority provenance is weak; add structured authority metadata and an official/accreditation reference where available.");
  if (state === "UNVERIFIABLE") warnings.push("Evidence is not independently reproducible from the recorded metadata and must be remediated before high-confidence reliance.");
  return { state, basis, metadataIntegrity: metadataIntegrity ? "PASS" : "FAIL", authorityTrace, externalCredentialReference, warnings };
}

export function evidenceUploadWarnings(input: EvidenceVerifiabilityInput): string[] {
  return assessEvidenceVerifiability(input).warnings;
}

export function gradeEvidenceRecord(record: EvidenceRecord | EvidenceQualityInput): EvidenceQualityGrade {
  return assessEvidenceQuality(record).grade;
}
