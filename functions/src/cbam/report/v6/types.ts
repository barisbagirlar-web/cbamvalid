/**
 * V6 enterprise readiness domain — RM-CBAMVALID-006.
 *
 * Two-axis honesty model: a data/evidence score that is entirely independent
 * of the calendar, and a calendar-only period-closure percentage. A single
 * authoritative package state is derived from the axes plus findings. A
 * combined "preparationScore" is intentionally forbidden by G-01.
 */

export const PACKAGE_READINESS_STATES = [
  "ON_TRACK_PERIOD_OPEN",
  "ACTION_REQUIRED",
  "BLOCKED",
  "READY_FOR_INDEPENDENT_VERIFICATION",
] as const;

export type PackageReadinessState = (typeof PACKAGE_READINESS_STATES)[number];

export const DEPRECATED_PREPARATION_STATE_VALUES = [
  "NOT_READY",
  "CONDITIONAL",
  "READY_WITH_GAPS",
  "READY_FOR_VERIFIER_REVIEW",
] as const;

export interface TwoAxisScores {
  /** 0-100. Operator-controllable readiness only; the calendar never enters. */
  readonly dataEvidenceReadiness: number;
  /** 0-100. (days elapsed in the reporting period / total days) x 100. */
  readonly periodClosure: number;
  /** Machine-readable reason codes for the data-axis score. */
  readonly dataReadinessReasonCodes: readonly string[];
  /** True when the reporting period has fully ended at the assessment time. */
  readonly periodEnded: boolean;
}

export type EvidenceRequirementStatus = "MANDATORY" | "OPTIONAL" | "NOT_APPLICABLE_WITH_BASIS";

export interface RegistryEvidenceRequirement {
  readonly registryFieldId: string;
  readonly requirement: EvidenceRequirementStatus;
  readonly basis?: string;
}

export interface EvidenceGapFinding {
  readonly findingId: string;
  readonly severity: "P2";
  readonly responsibleRole: "OPERATOR";
  readonly category: "EVIDENCE_GAP";
  readonly registryFieldId: string;
  readonly state: string;
  readonly title: string;
  readonly closureCondition: string;
  readonly targetDate: "NOT_YET_SET";
}

export interface ScenarioInterpretation {
  readonly scenarioId: string;
  readonly totalEmissionsDelta: string;
  readonly interpretationNote: string;
  readonly labels: readonly string[];
}

export interface HashArchitectureRow {
  readonly hashName: string;
  readonly covers: string;
  readonly notCovered: string;
  readonly reproduction: string;
}

export interface SamplingAssessment {
  readonly populationDomain: string;
  readonly state: string;
  readonly rationale: string;
}

export interface ValueStatementRow {
  readonly metric: string;
  readonly value: string;
  readonly source: string;
}
