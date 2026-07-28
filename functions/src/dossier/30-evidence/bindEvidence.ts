/**
 * L4 evidence binder — class admissibility + concentration + diversity (WP-07).
 */
import {
  assessEvidenceDiversity,
  isMimeAdmissible,
  type EvidenceClass,
  MAX_REQUIREMENT_CLASSES_PER_DOCUMENT,
} from "./evidence-classes";

export interface BoundEvidenceLink {
  readonly requirementId: string;
  readonly evidenceId: string;
  readonly evidenceClass: EvidenceClass;
  readonly mimeAdmissible: boolean;
}

export interface EvidenceBindResult {
  readonly links: readonly BoundEvidenceLink[];
  readonly distinctEvidenceCount: number;
  readonly findings: readonly string[];
  readonly evidenceScore01: number;
}

export function bindEvidence(params: {
  readonly requirementCount: number;
  readonly documents: ReadonlyArray<{
    readonly evidenceId: string;
    readonly mimeType: string;
    readonly requirementIds: readonly string[];
    readonly evidenceClass: EvidenceClass;
  }>;
}): EvidenceBindResult {
  const findings: string[] = [];
  const links: BoundEvidenceLink[] = [];

  for (const doc of params.documents) {
    const mimeAdmissible = isMimeAdmissible(doc.evidenceClass, doc.mimeType);
    if (!mimeAdmissible) findings.push("EVIDENCE_CLASS_MIME_INADMISSIBLE");
    if (doc.requirementIds.length > MAX_REQUIREMENT_CLASSES_PER_DOCUMENT) {
      findings.push("SINGLE_SOURCE_CONCENTRATION");
    }
    for (const reqId of doc.requirementIds) {
      links.push({
        requirementId: reqId,
        evidenceId: doc.evidenceId,
        evidenceClass: doc.evidenceClass,
        mimeAdmissible,
      });
    }
  }

  const distinct = new Set(params.documents.map((d) => d.evidenceId)).size;
  const diversity = assessEvidenceDiversity(distinct, params.requirementCount);
  if (!diversity.fullScoreAllowed) findings.push("EVIDENCE_DIVERSITY_INSUFFICIENT");

  let score = 1;
  if (findings.includes("EVIDENCE_CLASS_MIME_INADMISSIBLE")) score = Math.min(score, 0.2);
  if (findings.includes("SINGLE_SOURCE_CONCENTRATION")) score = Math.min(score, 0.35);
  if (findings.includes("EVIDENCE_DIVERSITY_INSUFFICIENT")) score = Math.min(score, 0.35);
  if (params.documents.length === 0) score = 0;

  return Object.freeze({
    links: Object.freeze(links),
    distinctEvidenceCount: distinct,
    findings: Object.freeze([...new Set(findings)]),
    evidenceScore01: score,
  });
}
