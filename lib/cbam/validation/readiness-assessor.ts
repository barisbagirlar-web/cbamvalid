import type { AuditReadyCase, GapRecord, GapSeverity } from "../schema";
import { runQualityControls, type QualityControlResult } from "./quality-controls";

export type VerificationReadinessStatus =
  | "NOT_READY"
  | "READY_WITH_OPEN_ITEMS"
  | "READY_FOR_INDEPENDENT_VERIFICATION";

export interface VerificationReadinessAssessment {
  /** Strict independent-verification posture. */
  status: VerificationReadinessStatus;
  /** Working-file blockers. Kept on the legacy field for UI compatibility. */
  criticalBlockers: GapRecord[];
  /** Working-file gaps. Pending organisation review is intentionally excluded. */
  allGaps: GapRecord[];
  /** Operator package may be locked and generated. */
  isEligibleForSealing: boolean;
  /** All strict review and verification-preparation controls passed. */
  isReadyForIndependentVerification: boolean;
  /** Strict verifier-handover blockers and gaps. */
  verificationCriticalBlockers: GapRecord[];
  verificationGaps: GapRecord[];
  verificationCompletenessPercentage: number;
  /** Working-file control completion. */
  completenessPercentage: number;
  passedControls: number;
  applicableControls: number;
}

interface ControlAssessment {
  criticalBlockers: GapRecord[];
  allGaps: GapRecord[];
  isComplete: boolean;
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

function assessControls(controls: QualityControlResult[]): ControlAssessment {
  const applicable = controls.filter((control) => control.status !== "NOT_APPLICABLE");
  const passed = applicable.filter((control) => control.status === "PASS");
  const unresolved = applicable.filter((control) => control.status !== "PASS");
  const allGaps = unresolved.map(toGap);
  const criticalBlockers = allGaps.filter((gap) => gap.isBlocking);
  const completenessPercentage = applicable.length === 0
    ? 0
    : Math.round((passed.length / applicable.length) * 100);

  return {
    criticalBlockers,
    allGaps,
    isComplete:
      criticalBlockers.length === 0 &&
      unresolved.length === 0 &&
      completenessPercentage === 100,
    completenessPercentage,
    passedControls: passed.length,
    applicableControls: applicable.length,
  };
}

export function assessCaseReadiness(caseData: AuditReadyCase): VerificationReadinessAssessment {
  const verification = assessControls(runQualityControls(caseData));
  const workingFile = assessControls(
    runQualityControls(caseData, { pendingReviewIsPresent: true })
  );

  const status: VerificationReadinessStatus = verification.isComplete
    ? "READY_FOR_INDEPENDENT_VERIFICATION"
    : verification.criticalBlockers.length > 0
      ? "NOT_READY"
      : "READY_WITH_OPEN_ITEMS";

  return {
    status,
    criticalBlockers: workingFile.criticalBlockers,
    allGaps: workingFile.allGaps,
    isEligibleForSealing: workingFile.isComplete,
    isReadyForIndependentVerification: verification.isComplete,
    verificationCriticalBlockers: verification.criticalBlockers,
    verificationGaps: verification.allGaps,
    verificationCompletenessPercentage: verification.completenessPercentage,
    completenessPercentage: workingFile.completenessPercentage,
    passedControls: workingFile.passedControls,
    applicableControls: workingFile.applicableControls,
  };
}
