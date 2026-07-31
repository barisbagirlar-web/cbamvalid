/**
 * FAZ 16 — External professional acceptance preparation.
 *
 * Documents the mandatory external review for a sealed dossier before any
 * 10/10 / VERIFIER_READY / premium-value claim may be made. The checklist is
 * deliberately fail-closed: default state is NOT_ACCEPTED, and ACCEPTED is
 * only reachable when every required reviewer has completed the full 12-item
 * checklist and no critical or high finding remains open.
 *
 * This module is authoritative data, not a runtime dependency of sealing:
 * sealing must never depend on an external review that has not happened.
 */

export type ExternalReviewerRole =
  | "CBAM_METHODOLOGY_SPECIALIST"
  | "ACCREDITED_CBAM_VERIFIER"
  | "FINANCIAL_OPERATIONAL_DATA_CONTROL_SPECIALIST";

export const EXTERNAL_REVIEWER_ROLES: readonly { role: ExternalReviewerRole; label: string; required: true }[] = [
  { role: "CBAM_METHODOLOGY_SPECIALIST", label: "CBAM methodology specialist", required: true },
  { role: "ACCREDITED_CBAM_VERIFIER", label: "Real accredited CBAM verifier", required: true },
  { role: "FINANCIAL_OPERATIONAL_DATA_CONTROL_SPECIALIST", label: "Financial/operational data control specialist", required: true },
];

export const EXTERNAL_ACCEPTANCE_CRITERIA: readonly {
  id: string;
  criterion: string;
  evidencePointer: string;
  packageArtifact: string;
}[] = [
  { id: "EXT-01", criterion: "Legal completeness", evidencePointer: "Legal and Reliance Boundary section; Calculation Trace.json legalBasis per node", packageArtifact: "Main dossier PDF §03; Calculation Trace.json" },
  { id: "EXT-02", criterion: "Monitoring plan completeness", evidencePointer: "Monitoring Plan Conformance section MP-01..MP-12", packageArtifact: "Installation Monitoring Plan.pdf; Monitoring Plan sheet" },
  { id: "EXT-03", criterion: "Calculation reproducibility", evidencePointer: "Independent recomputation from Calculation Trace.json + Calculation Graph.json; deterministic replay", packageArtifact: "Calculation Trace.json; Calculation Graph.json; Embedded Emissions Calculation Annex.pdf" },
  { id: "EXT-04", criterion: "Evidence sufficiency", evidencePointer: "Evidence Sufficiency Matrix states and coverage; A-E quality grades", packageArtifact: "Main dossier PDF §13-14; Evidence Register.csv; Evidence Matrix sheet" },
  { id: "EXT-05", criterion: "Materiality usability", evidencePointer: "Per-good materiality workpapers with regulatory/calculation basis and verifier status", packageArtifact: "Main dossier PDF §37; Materiality sheet" },
  { id: "EXT-06", criterion: "Risk and sampling usability", evidencePointer: "Inherent/control/detection risk registers; sampling population, rationale and selection", packageArtifact: "Main dossier PDF §36; Risk Register sheet; Sampling Plan sheet" },
  { id: "EXT-07", criterion: "Site-visit readiness", evidencePointer: "Site-visit readiness pack and site-visit execution state", packageArtifact: "Verifier Handover section; Site Visits sheet" },
  { id: "EXT-08", criterion: "Registry template readiness", evidencePointer: "Registry Verification Template Mapping Dataset field coverage", packageArtifact: "Registry Mapping sheet; O3CI Field Mapping.csv" },
  { id: "EXT-09", criterion: "Report clarity", evidencePointer: "Structure, headings, units, page numbers and render QA on the main report", packageArtifact: "Main dossier PDF; render-qa PNG pages" },
  { id: "EXT-10", criterion: "Verifier workload reduction", evidencePointer: "Verifier Workspace navigation, locked formulas, input-cell discipline", packageArtifact: "Verifier Workspace.xlsx" },
  { id: "EXT-11", criterion: "Misleading claim absence", evidencePointer: "guard:claims scan; no accredited-verification/acceptance claims without an opinion", packageArtifact: "Whole package; guard-report-claims result" },
  { id: "EXT-12", criterion: "Commercial value", evidencePointer: "Package contract completeness and verifier-facing utility for the $449 Single Pack", packageArtifact: "Whole package; Data Integrity Manifest.json" },
];

export interface ExternalChecklistRow {
  criterionId: string;
  criterion: string;
  reviewerRole: ExternalReviewerRole;
  evidencePointer: string;
  packageArtifact: string;
  status: "NOT_COMPLETED" | "PASS" | "FAIL" | "OPEN_FINDING";
  findingReference: string | null;
  assessedAt: string | null;
  assessedBy: string | null;
}

export interface ExternalAcceptanceState {
  reviewers: { role: ExternalReviewerRole; label: string; completionState: "PENDING" | "COMPLETE" }[];
  checklist: ExternalChecklistRow[];
  criticalFindingsOpen: number;
  highFindingsOpen: number;
  overall: "NOT_ACCEPTED" | "ACCEPTED";
  acceptsAsOf: string | null;
}

const MANDATED_CRITERIA = new Set(EXTERNAL_ACCEPTANCE_CRITERIA.map((entry) => entry.criterion));

export function validateExternalAcceptanceCriteria(): { missing: string[] } {
  const mandated = [
    "Legal completeness",
    "Monitoring plan completeness",
    "Calculation reproducibility",
    "Evidence sufficiency",
    "Materiality usability",
    "Risk and sampling usability",
    "Site-visit readiness",
    "Registry template readiness",
    "Report clarity",
    "Verifier workload reduction",
    "Misleading claim absence",
    "Commercial value",
  ];
  return { missing: mandated.filter((label) => !MANDATED_CRITERIA.has(label)) };
}

export function buildExternalAcceptanceState(): ExternalAcceptanceState {
  const checklist: ExternalChecklistRow[] = [];
  for (const criterion of EXTERNAL_ACCEPTANCE_CRITERIA) {
    for (const reviewer of EXTERNAL_REVIEWER_ROLES) {
      checklist.push({
        criterionId: criterion.id,
        criterion: criterion.criterion,
        reviewerRole: reviewer.role,
        evidencePointer: criterion.evidencePointer,
        packageArtifact: criterion.packageArtifact,
        status: "NOT_COMPLETED",
        findingReference: null,
        assessedAt: null,
        assessedBy: null,
      });
    }
  }
  return {
    reviewers: EXTERNAL_REVIEWER_ROLES.map((reviewer) => ({ role: reviewer.role, label: reviewer.label, completionState: "PENDING" })),
    checklist,
    criticalFindingsOpen: 0,
    highFindingsOpen: 0,
    overall: "NOT_ACCEPTED",
    acceptsAsOf: null,
  };
}

/**
 * Records one reviewer's assessment of one criterion. Fails closed:
 * ACCEPTED is impossible while any critical/high finding is open or any
 * reviewer has not completed every criterion.
 */
export function recordExternalAssessment(params: {
  state: ExternalAcceptanceState;
  reviewerRole: ExternalReviewerRole;
  criterionId: string;
  status: "PASS" | "FAIL" | "OPEN_FINDING";
  findingReference?: string | null;
  assessedBy: string;
  assessedAt: string;
  criticalFindingsOpen: number;
  highFindingsOpen: number;
}): ExternalAcceptanceState {
  const { state, reviewerRole, criterionId, status, findingReference, assessedBy, assessedAt, criticalFindingsOpen, highFindingsOpen } = params;
  const row = state.checklist.find((entry) => entry.criterionId === criterionId && entry.reviewerRole === reviewerRole);
  if (!row) throw new Error(`EXTERNAL_CRITERION_UNKNOWN:${reviewerRole}:${criterionId}`);

  row.status = status;
  row.findingReference = status === "PASS" ? null : (findingReference ?? null);
  row.assessedBy = assessedBy;
  row.assessedAt = assessedAt;

  const reviewerDone = state.reviewers.find((reviewer) => reviewer.role === reviewerRole);
  if (reviewerDone) {
    const remaining = state.checklist.filter((entry) => entry.reviewerRole === reviewerRole && entry.status === "NOT_COMPLETED");
    reviewerDone.completionState = remaining.length === 0 ? "COMPLETE" : "PENDING";
  }

  const allReviewersComplete = state.reviewers.every((reviewer) => reviewer.completionState === "COMPLETE");
  const noFailedRows = state.checklist.every((entry) => entry.status === "PASS");
  const accepted = allReviewersComplete && noFailedRows && criticalFindingsOpen === 0 && highFindingsOpen === 0;

  state.criticalFindingsOpen = criticalFindingsOpen;
  state.highFindingsOpen = highFindingsOpen;
  state.overall = accepted ? "ACCEPTED" : "NOT_ACCEPTED";
  state.acceptsAsOf = accepted ? assessedAt : null;
  return state;
}
