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
