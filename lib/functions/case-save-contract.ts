import type { AuditReadyCase } from "@/lib/cbam/schema";
import { isCaseId } from "@/lib/cbam/case-id";

export type CaseSaveRequest = { data: AuditReadyCase; caseId?: string };

export function createCaseSaveRequest(data: AuditReadyCase, caseId?: string): CaseSaveRequest {
  if (caseId === undefined) return { data };
  const normalized = caseId.trim();
  if (!isCaseId(normalized)) throw new Error("INVALID_CASE_ID");
  return { caseId: normalized, data };
}
