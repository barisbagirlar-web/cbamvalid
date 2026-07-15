import { z } from "zod";

export const CASE_ID_PATTERN = /^case_[A-Za-z0-9_-]{1,128}$/;
export const CaseIdSchema = z.string().regex(CASE_ID_PATTERN, "Invalid CBAM case identifier");

export function createCanonicalCaseId(documentId: string): string {
  const normalized = documentId.trim();
  const caseId = normalized.startsWith("case_") ? normalized : `case_${normalized}`;
  return CaseIdSchema.parse(caseId);
}
