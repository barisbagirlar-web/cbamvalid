import { AuditReadyCase, GapRecord, GapSeverity } from "../schema";
import { runQualityControls, type QualityControlResult } from "./quality-controls";

export type VerificationReadinessStatus =
  | "NOT_READY"
  | "READY_WITH_WARNINGS"
  | "READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION";

export interface VerificationReadinessAssessment {
  status: VerificationReadinessStatus;
  criticalBlockers: GapRecord[];
  allGaps: GapRecord[];
  isEligibleForSealing: boolean;
  completenessPercentage: number;
  evidenceCoveragePercentage: number;
}

function severityFor(status: "WARNING" | "BLOCKER"): GapSeverity {
  return status === "BLOCKER" ? "BLOCKER" : "MINOR";
}

export function assessCaseReadiness(caseData: AuditReadyCase): VerificationReadinessAssessment {
  const qualityControls = runQualityControls(caseData);
  const evaluated = qualityControls.filter((item) => item.status !== "NOT_APPLICABLE");
  const findings = evaluated
    .filter((item): item is QualityControlResult & { status: "BLOCKER" | "WARNING" } =>
      item.status === "BLOCKER" || item.status === "WARNING"
    )
    .map<GapRecord>((item) => ({
      gapId: `qc_${item.ruleId}`,
      issueType: item.status === "BLOCKER" ? "calculation blocker" : "unresolved assumption",
      requirement: item.name,
      severity: severityFor(item.status),
      whyItMatters: item.message || "The quality-control rule requires review.",
      requiredEvidence: item.remediationCode || "Document and resolve the quality-control finding.",
      suggestedAction: item.remediationCode || "Review and resolve this finding.",
      isBlocking: item.status === "BLOCKER",
      resolutionStatus: "OPEN",
    }));

  const blockers = findings.filter((item) => item.isBlocking);
  const warnings = findings.filter((item) => !item.isBlocking);
  const passedCount = evaluated.filter((item) => item.status === "PASS").length;
  const completenessPercentage = evaluated.length === 0
    ? 0
    : Math.round((passedCount / evaluated.length) * 100);

  const evidencePaths = new Set(
    caseData.evidenceRegister.flatMap((record) => record.linkedInputs)
  );
  const requiredEvidencePaths = [
    "importerIdentity.eoriNumber",
    "directEmissions",
    "electricityConsumed",
    "gridEmissionFactor",
    ...caseData.goods.flatMap((_, index) => [
      `goods.${index}.cnCode`,
      `goods.${index}.productionVolume`,
    ]),
    ...caseData.precursors.flatMap((_, index) => [
      `precursors.${index}.quantity`,
      `precursors.${index}.directEmissions`,
      `precursors.${index}.indirectEmissions`,
    ]),
  ];
  const coveredPaths = requiredEvidencePaths.filter((path) => evidencePaths.has(path)).length;
  const evidenceCoveragePercentage = requiredEvidencePaths.length === 0
    ? 0
    : Math.round((coveredPaths / requiredEvidencePaths.length) * 100);

  const isEligibleForSealing = blockers.length === 0 && warnings.length === 0;
  const status: VerificationReadinessStatus = blockers.length > 0
    ? "NOT_READY"
    : warnings.length > 0
      ? "READY_WITH_WARNINGS"
      : "READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION";

  return {
    status,
    criticalBlockers: blockers,
    allGaps: findings,
    isEligibleForSealing,
    completenessPercentage,
    evidenceCoveragePercentage,
  };
}
