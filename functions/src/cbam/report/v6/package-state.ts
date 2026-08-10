/**
 * G-02 — single authoritative package state.
 *
 * The entire package (every PDF, XLSX tab and JSON output) must surface exactly
 * one value of packageReadinessState. NOT_READY is removed. An open reporting
 * period alone never produces a negative label: with no operator-closable
 * findings the state is ON_TRACK_PERIOD_OPEN, not a failure.
 */
import type { AuditReadyCase } from "../../schema";
import type { EvidenceGapFinding, PackageReadinessState, TwoAxisScores } from "./types";
import { findEvidenceGaps } from "./evidence-gap";
import { buildRegistryTemplateMapping } from "../../registry/registry-template-mapping";
import { assessReadiness } from "../../validation/readiness-score";
import { generateFindingsAndActions } from "../../validation/findings-engine";
import { computePeriodClosure } from "./two-axis-score";

export interface PackageStateInputs {
  readonly caseData: AuditReadyCase;
  readonly assessmentTimestamp?: string;
  readonly scores?: TwoAxisScores;
  readonly evidenceGaps?: readonly EvidenceGapFinding[];
}

export interface PackageStateDecision {
  readonly state: PackageReadinessState;
  readonly reasonCodes: readonly string[];
}

export function derivePackageReadinessState(
  params: PackageStateInputs
): PackageStateDecision {
  const { caseData, assessmentTimestamp } = params;
  const readiness = assessReadiness({
    caseData,
    isDraft: false,
    assessmentTimestamp,
    sealMode: "PREVIEW",
  });
  const mapping = buildRegistryTemplateMapping(caseData, assessmentTimestamp);
  const evidenceGaps =
    params.evidenceGaps ?? findEvidenceGaps(mapping);
  const period = params.scores
    ? { periodClosure: params.scores.periodClosure, periodEnded: params.scores.periodEnded }
    : computePeriodClosure({ caseData, assessmentTimestamp });

  const reasonCodes: string[] = [];

  // BLOCKED is reserved for what the operator cannot close on their own:
  // unresolved calculation exceptions and evidence-integrity failures
  // (corrupted hash / storage chain). Missing evidence, however severe, is an
  // operator-closable gap and therefore drives ACTION_REQUIRED, never BLOCKED —
  // the G-02 state table (D-01/D-02) is explicit that only non-closable or
  // genuinely critical blockers may turn the package BLOCKED.
  const integrityFailure = readiness.decisionReasonCodes.includes("EVIDENCE_INTEGRITY_FAILURE");
  const calculationException = readiness.unresolvedCalculationExceptionCount > 0;
  if (integrityFailure || calculationException) {
    const codes: string[] = [];
    if (integrityFailure) codes.push("EVIDENCE_INTEGRITY_FAILURE");
    if (calculationException) codes.push("UNRESOLVED_CALCULATION_EXCEPTION");
    return { state: "BLOCKED", reasonCodes: codes };
  }

  // Operator-closable findings exclude calendar-owned REPORTING_PERIOD findings:
  // an open period is handled by period.periodEnded and never turns a clean case
  // into ACTION_REQUIRED.
  const openOperatorFindings = generateFindingsAndActions(
    caseData,
    assessmentTimestamp,
    "PREVIEW"
  ).findings.filter((finding) => finding.status === "OPEN" && finding.category !== "REPORTING_PERIOD");

  const operatorClosable =
    evidenceGaps.length > 0 ||
    readiness.missingMaterialEvidenceCount > 0 ||
    openOperatorFindings.length > 0;
  if (operatorClosable) {
    const codes: string[] = [];
    if (evidenceGaps.length > 0) codes.push(`EVIDENCE_GAPS:${evidenceGaps.length}`);
    if (readiness.missingMaterialEvidenceCount > 0) codes.push(`MATERIAL_EVIDENCE_MISSING:${readiness.missingMaterialEvidenceCount}`);
    if (openOperatorFindings.length > 0) codes.push(`OPEN_FINDINGS:${openOperatorFindings.length}`);
    return { state: "ACTION_REQUIRED", reasonCodes: codes };
  }

  if (period.periodEnded) {
    reasonCodes.push("PERIOD_CLOSED", "NO_OPERATOR_CLOSABLE_FINDINGS");
    return { state: "READY_FOR_INDEPENDENT_VERIFICATION", reasonCodes };
  }

  reasonCodes.push("PERIOD_OPEN", "NO_OPERATOR_CLOSABLE_FINDINGS");
  return { state: "ON_TRACK_PERIOD_OPEN", reasonCodes };
}
