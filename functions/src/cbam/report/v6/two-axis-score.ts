/**
 * G-01 — two-axis scoring.
 *
 * The calendar never enters dataEvidenceReadiness and data never enters
 * periodClosure. A combined preparation score is forbidden. Each score keeps
 * machine-readable reason codes so a loss on the data axis is fully explainable.
 */
import { Decimal } from "decimal.js";
import type { AuditReadyCase } from "../../schema";
import { assessReadiness, getReportingPeriodAssessment } from "../../validation/readiness-score";
import { findEvidenceGaps } from "./evidence-gap";
import { buildRegistryTemplateMapping } from "../../registry/registry-template-mapping";
import type { TwoAxisScores } from "./types";

function clamp01(value: Decimal): number {
  return Math.min(100, Math.max(0, value.toDecimalPlaces(1).toNumber()));
}

/**
 * Days of the reporting period that have elapsed at the assessment time,
 * inclusive of the assessment day, bounded by the period boundaries.
 */
export function elapsedPeriodDays(params: {
  caseData: AuditReadyCase;
  assessmentTimestamp?: string;
}): { elapsedDays: number; totalDays: number; periodEnded: boolean } {
  const period = getReportingPeriodAssessment(params.caseData, params.assessmentTimestamp);
  const now = params.assessmentTimestamp
    ? new Date(params.assessmentTimestamp)
    : new Date();
  const startMs = Date.parse(period.startDate);
  const endMs = Date.parse(period.endDate);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || period.expectedDays <= 0) {
    return { elapsedDays: 0, totalDays: period.expectedDays, periodEnded: false };
  }
  const nowMs = now.getTime();
  const elapsed = Math.max(0, Math.min(endMs, nowMs) - startMs) / (1000 * 60 * 60 * 24) + 1;
  const periodEnded = nowMs >= endMs;
  return { elapsedDays: Math.round(elapsed), totalDays: period.expectedDays, periodEnded };
}

export function computePeriodClosure(params: {
  caseData: AuditReadyCase;
  assessmentTimestamp?: string;
}): { periodClosure: number; periodEnded: boolean } {
  const { elapsedDays, totalDays, periodEnded } = elapsedPeriodDays(params);
  if (totalDays <= 0) return { periodClosure: 0, periodEnded: false };
  return {
    periodClosure: clamp01(new Decimal(elapsedDays).dividedBy(totalDays).times(100)),
    periodEnded,
  };
}

/**
 * Data axis: operator-controllable readiness (calendar-free). The V5 weighted
 * dimension score is reused as the base, then only operator-closable V6
 * integrity penalties are applied: mandatory evidence gaps, methodology
 * decisions lacking a rejected alternative, and sampling populations left
 * NOT_ASSESSED. Period status is never consulted here.
 */
export function computeDataEvidenceReadiness(params: {
  caseData: AuditReadyCase;
  assessmentTimestamp?: string;
}): { dataEvidenceReadiness: number; reasonCodes: readonly string[] } {
  const { caseData, assessmentTimestamp } = params;
  const readiness = assessReadiness({
    caseData,
    isDraft: false,
    assessmentTimestamp,
    sealMode: "PREVIEW",
  });
  const reasonCodes: string[] = [];
  const base = new Decimal(readiness.score);

  const mapping = buildRegistryTemplateMapping(caseData, assessmentTimestamp);
  const evidenceGaps = findEvidenceGaps(mapping);
  if (evidenceGaps.length > 0) {
    reasonCodes.push(`EVIDENCE_GAPS:${evidenceGaps.length}`);
  }

  const decisionsWithoutAlternative = caseData.methodologyDecisions.filter(
    (decision) => !decision.rejectedAlternativeReason || decision.rejectedAlternativeReason.trim().length === 0
  );
  if (decisionsWithoutAlternative.length > 0) {
    reasonCodes.push(`METHODOLOGY_WITHOUT_ALTERNATIVE:${decisionsWithoutAlternative.length}`);
  }

  const penaltyPerGap = 5;
  const penalties = new Decimal(0)
    .plus(new Decimal(evidenceGaps.length).times(penaltyPerGap))
    .plus(new Decimal(decisionsWithoutAlternative.length).times(2));
  const capped = base.minus(penalties);

  return {
    dataEvidenceReadiness: clamp01(capped),
    reasonCodes,
  };
}

export function computeTwoAxisScores(params: {
  caseData: AuditReadyCase;
  assessmentTimestamp?: string;
}): TwoAxisScores {
  const data = computeDataEvidenceReadiness(params);
  const period = computePeriodClosure(params);
  return {
    dataEvidenceReadiness: data.dataEvidenceReadiness,
    periodClosure: period.periodClosure,
    dataReadinessReasonCodes: data.reasonCodes,
    periodEnded: period.periodEnded,
  };
}
