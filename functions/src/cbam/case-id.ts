import { z } from "zod";

// Keep this total-length boundary identical to the Firestore identifier guard.
export const CASE_ID_PATTERN = /^case_[A-Za-z0-9_-]{1,123}$/;
export const CaseIdSchema = z.string().regex(CASE_ID_PATTERN, "Invalid CBAM case identifier");

export function createCanonicalCaseId(documentId: string): string {
  const normalized = documentId.trim();
  const caseId = normalized.startsWith("case_") ? normalized : `case_${normalized}`;
  return CaseIdSchema.parse(caseId);
}

export function getDisplayReferenceCode(caseId: string | undefined): string {
  if (!caseId) return "UNASSIGNED";
  const clean = caseId.replace(/^case_/, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = clean.length > 8 ? clean.slice(-8) : clean.padEnd(8, "X");
  return `CBAM-C-${suffix}`;
}

export function getDisplayReportReferenceCode(reportId: string | undefined): string {
  if (!reportId) return "UNASSIGNED";
  const clean = reportId.replace(/^report_/, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = clean.length > 8 ? clean.slice(-8) : clean.padEnd(8, "X");
  return `CBAM-R-${suffix}`;
}
