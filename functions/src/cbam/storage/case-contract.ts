import { AuditReadyCaseSchema, type AuditReadyCase } from "../schema";
import { createCanonicalCaseId } from "../case-id";

export type CaseRecordStatus = "DRAFT" | "COMPLETED" | "REFUNDED" | "ARCHIVED";

export interface CbamCaseRecord {
  caseId: string;
  uid: string;
  data: AuditReadyCase;
  status: CaseRecordStatus;
  latestReleaseId?: string;
  latestReleaseVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export type CaseWorkspaceView = AuditReadyCase & {
  caseId: string;
  ownerId: string;
  recordStatus: CaseRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export function buildCaseRecord(params: {
  rawDocumentId: string;
  uid: string;
  data: unknown;
  timestamp: string;
}): CbamCaseRecord {
  const caseId = createCanonicalCaseId(params.rawDocumentId);
  const parsedData = AuditReadyCaseSchema.parse({
    ...(params.data as Record<string, unknown>),
    caseId,
    ownerId: params.uid,
  });

  return {
    caseId,
    uid: params.uid,
    data: parsedData,
    status: "DRAFT",
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };
}

export function toCaseWorkspaceView(record: CbamCaseRecord): CaseWorkspaceView {
  const parsedData = AuditReadyCaseSchema.parse({
    ...record.data,
    caseId: record.caseId,
    ownerId: record.uid,
  });

  return {
    ...parsedData,
    caseId: record.caseId,
    ownerId: record.uid,
    recordStatus: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
