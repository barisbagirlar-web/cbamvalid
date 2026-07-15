import type { AuditReadyCase } from "@/lib/cbam/schema";
import { isCaseId } from "@/lib/cbam/case-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CaseSaveRequest = {
  data: AuditReadyCase;
  caseId?: string;
  requestId?: string;
};

export function createCaseSaveRequest(
  data: AuditReadyCase,
  caseId?: string,
  requestId?: string
): CaseSaveRequest {
  if (caseId !== undefined && requestId !== undefined) {
    throw new Error("AMBIGUOUS_CASE_SAVE_REQUEST");
  }

  if (caseId !== undefined) {
    const normalizedCaseId = caseId.trim();
    if (!isCaseId(normalizedCaseId)) throw new Error("INVALID_CASE_ID");
    return { caseId: normalizedCaseId, data };
  }

  const normalizedRequestId = requestId?.trim() ?? "";
  if (!UUID_PATTERN.test(normalizedRequestId)) {
    throw new Error("CASE_CREATION_REQUEST_ID_REQUIRED");
  }
  return { requestId: normalizedRequestId, data };
}
