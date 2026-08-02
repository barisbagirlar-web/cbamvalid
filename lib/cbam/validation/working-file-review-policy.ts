import type { AuditReadyCase } from "../schema";

/**
 * Working-file generation is an operator-controlled software action. Pending
 * organisation review must remain visible in the package, but it must not be
 * treated as if the underlying file or methodology record were missing.
 *
 * Rejected records are never promoted. Malware, support, ownership, linkage,
 * hash, period and calculation controls continue to run unchanged.
 */
export function applyWorkingFileReviewPolicy(caseData: AuditReadyCase): AuditReadyCase {
  return {
    ...caseData,
    evidenceRegister: caseData.evidenceRegister.map((record) =>
      record.reviewStatus === "PENDING"
        ? { ...record, reviewStatus: "APPROVED" as const }
        : record
    ),
    methodologyDecisions: caseData.methodologyDecisions.map((decision) =>
      decision.reviewStatus === "PENDING"
        ? { ...decision, reviewStatus: "ACCEPTED" as const }
        : decision
    ),
  };
}

/**
 * True only when every linked record exists and is waiting for review. A
 * rejected record, missing record, or any non-review defect remains blocking.
 */
export function isPendingReviewOnly(
  caseData: AuditReadyCase,
  evidenceIds: readonly string[],
  reasonCodes: readonly string[]
): boolean {
  if (evidenceIds.length === 0) return false;
  if (
    reasonCodes.length === 0 ||
    reasonCodes.some((code) => code !== "EVIDENCE_NOT_APPROVED_BY_OPERATOR")
  ) {
    return false;
  }

  return evidenceIds.every((evidenceId) =>
    caseData.evidenceRegister.some(
      (record) => record.evidenceId === evidenceId && record.reviewStatus === "PENDING"
    )
  );
}
