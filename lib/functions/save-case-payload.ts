import type { AuditReadyCase } from "@/lib/cbam/schema";

export type SaveCasePayload = {
  data: AuditReadyCase;
  caseId?: string;
};

/**
 * Firebase callable payloads must not contain undefined values. New cases have
 * no caseId yet, so the property is omitted completely until the first draft
 * has been persisted.
 */
export function buildSaveCasePayload(data: AuditReadyCase, caseId?: string): SaveCasePayload {
  const normalizedCaseId = typeof caseId === "string" ? caseId.trim() : "";
  return normalizedCaseId ? { caseId: normalizedCaseId, data } : { data };
}
