import type { AuditReadyCase, GapRecord, GapSeverity } from "../schema";
import { runQualityControls, type QualityControlResult } from "./quality-controls";

export type VerificationReadinessStatus =
  | "NOT_READY"
  | "READY_WITH_OPEN_ITEMS"
  | "READY_FOR_INDEPENDENT_VERIFICATION";

export interface VerificationReadinessAssessment {
  status: VerificationReadinessStatus;
  criticalBlockers: GapRecord[];
  allGaps: GapRecord[];
  isEligibleForSealing: boolean;
  completenessPercentage: number;
  passedControls: number;
  applicableControls: number;
}

function severity(control: QualityControlResult): GapSeverity {
  if (control.status === "BLOCKER") return "BLOCKER";
  if (control.status === "WARNING") return "MAJOR";
  return "ADVISORY";
}

function toGap(control: QualityControlResult): GapRecord {
  return {
    gapId: `gap_${control.ruleId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    issueType: control.status === "BLOCKER" ? "non-conformity" : "unresolved assumption",
    requirement: control.name,
    severity: severity(control),
    affectedResult: control.ruleId,
    whyItMatters: control.message || "The control has not reached a passing state.",
    requiredEvidence: control.remediationCode || "Resolve the underlying control requirement.",
    suggestedAction: control.remediationCode || "Review the dossier input and evidence chain.",
    isBlocking: control.status === "BLOCKER",
    resolutionStatus: "OPEN",
  };
}

export function assessCaseReadiness(caseData: AuditReadyCase): VerificationReadinessAssessment {
  const controls = runQualityControls(caseData);
  const applicable = controls.filter((control) => control.status !== "NOT_APPLICABLE");
  const passed = applicable.filter((control) => control.status === "PASS");
  const unresolved = applicable.filter((control) => control.status !== "PASS");
  const allGaps = unresolved.map(toGap);
  const criticalBlockers = allGaps.filter((gap) => gap.isBlocking);
  const completenessPercentage = applicable.length === 0
    ? 0
    : Math.round((passed.length / applicable.length) * 100);
  const isEligibleForSealing = criticalBlockers.length === 0 && unresolved.length === 0 && completenessPercentage === 100;
  const status: VerificationReadinessStatus = isEligibleForSealing
    ? "READY_FOR_INDEPENDENT_VERIFICATION"
    : criticalBlockers.length > 0
      ? "NOT_READY"
      : "READY_WITH_OPEN_ITEMS";

  return {
    status,
    criticalBlockers,
    allGaps,
    isEligibleForSealing,
    completenessPercentage,
    passedControls: passed.length,
    applicableControls: applicable.length,
  };
}
