import type { AuditReadyCase, GapRecord, GapSeverity } from "../schema";
import { runQualityControls, type QualityControlResult } from "./quality-controls";

export type VerificationReadinessStatus =
  | "NOT_READY"
  | "READY_WITH_WARNINGS"
  | "READY_FOR_INDEPENDENT_VERIFICATION";

export interface VerificationReadinessAssessment {
  status: VerificationReadinessStatus;
  criticalBlockers: GapRecord[];
  warningGaps: GapRecord[];
  allGaps: GapRecord[];
  hasWarnings: boolean;
  isEligibleForSealing: boolean;
  completenessPercentage: number;
  passedControls: number;
  applicableControls: number;
}

function severity(control: QualityControlResult): GapSeverity {
  if (control.isHardBlocker) return "BLOCKER";
  if (control.status === "WARNING") return "MAJOR";
  return "ADVISORY";
}

function toGap(control: QualityControlResult): GapRecord {
  return {
    gapId: `gap_${control.ruleId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    issueType: control.isHardBlocker ? "non-conformity" : "unresolved assumption",
    requirement: control.name,
    severity: severity(control),
    affectedResult: control.ruleId,
    whyItMatters: control.message || "The control has not reached a passing state.",
    requiredEvidence: control.remediationCode || "Resolve the underlying control requirement.",
    suggestedAction: control.remediationCode || "Review the dossier input and evidence chain.",
    isBlocking: Boolean(control.isHardBlocker),
    resolutionStatus: "OPEN",
  };
}

export function assessCaseReadiness(caseData: AuditReadyCase): VerificationReadinessAssessment {
  const controls = runQualityControls(caseData);
  const applicable = controls.filter((c) => c.status !== "NOT_APPLICABLE");
  const passed = applicable.filter((c) => c.status === "PASS");
  const unresolved = applicable.filter((c) => c.status !== "PASS");
  const allGaps = unresolved.map(toGap);
  const criticalBlockers = allGaps.filter((gap) => gap.isBlocking);
  const warningGaps = allGaps.filter((gap) => !gap.isBlocking);
  const completenessPercentage = applicable.length === 0
    ? 0
    : Math.round((passed.length / applicable.length) * 100);

  // Sealing is allowed when there are no hard structural blockers.
  // Reports with open warnings generate with annotated data-gap sections.
  const isEligibleForSealing = criticalBlockers.length === 0;
  const hasWarnings = warningGaps.length > 0;

  const status: VerificationReadinessStatus = isEligibleForSealing
    ? (hasWarnings ? "READY_WITH_WARNINGS" : "READY_FOR_INDEPENDENT_VERIFICATION")
    : "NOT_READY";

  return {
    status,
    criticalBlockers,
    warningGaps,
    allGaps,
    hasWarnings,
    isEligibleForSealing,
    completenessPercentage,
    passedControls: passed.length,
    applicableControls: applicable.length,
  };
}

