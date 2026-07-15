import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "@/lib/firebase/client";
import {
  AuditReadyCaseSchema,
  type AuditReadyCase,
  type EvidenceSupportStatus,
} from "@/lib/cbam/schema";
import {
  ReportDownloadFormatSchema,
  parseSealedReportView,
  type ReportDownloadFormat,
  type SealedReportView,
} from "@/lib/cbam/report-contract";
import {
  AccountOverviewSchema,
  CreditLedgerEntrySchema,
  PurchaseHistoryEntrySchema,
  type AccountOverview,
  type CreditLedgerEntry,
  type PurchaseHistoryEntry,
} from "@/lib/account-contract";
import { PREPARATION_PACK } from "@/lib/commerce/preparation-pack";
import { createCaseSaveRequest } from "@/lib/functions/case-save-contract";

export type UnknownRecord = Record<string, unknown>;

export type CbamCaseRecord = {
  caseId: string;
  uid: string;
  status: string;
  data: AuditReadyCase;
  createdAt: string;
  updatedAt: string;
  latestReleaseId?: string;
  latestReleaseVersion?: number;
};

export type PreparationPackEntitlement = {
  entitlementId: string;
  orderId: string;
  productCode: typeof PREPARATION_PACK.productCode;
  status: "AVAILABLE" | "RESERVED";
  scopeCaseId?: string;
  caseId?: string;
  releasesCount: number;
  releasesRemaining: number;
  maxReleases: typeof PREPARATION_PACK.maxReleases;
  reservedReportId?: string;
  reservationExpiresAt?: string;
};

export type EntitlementsResponse = {
  entitlements: PreparationPackEntitlement[];
  totalReleasesRemaining: number;
  status: "success";
};

export type SealResponse = {
  report: {
    reportId: string;
    releaseVersion: number;
    documentHash: string;
    manifestHash: string;
    packageHash: string;
    status: "SEALED";
  };
  status: "success";
};

export type ReportDownloadDescriptor = {
  url: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  status: "success";
};

const getCbamCasesCallable = httpsCallable<void, { cases: CbamCaseRecord[] }>(firebaseFunctions, "getCbamCases");
const getCbamCaseCallable = httpsCallable<{ caseId: string }, { case: unknown }>(firebaseFunctions, "getCbamCase");
const saveCbamCaseCallable = httpsCallable<{
  caseId?: string;
  requestId?: string;
  data: AuditReadyCase;
}, { caseId: string }>(firebaseFunctions, "saveCbamCase");
const reviewCbamEvidenceCallable = httpsCallable<{
  caseId: string;
  evidenceId: string;
  decision: "APPROVED" | "REJECTED";
  supportStatus: EvidenceSupportStatus;
  reviewerNotes: string;
}, { case: unknown }>(firebaseFunctions, "reviewCbamEvidence");
const recordCbamEvidenceScanCallable = httpsCallable<{
  caseId: string;
  evidenceId: string;
  status: "CLEAN" | "INFECTED";
  scannerReference: string;
}, { case: unknown }>(firebaseFunctions, "recordCbamEvidenceScan");
const renameCbamCaseCallable = httpsCallable<{ caseId: string; newName: string }, { success: boolean }>(firebaseFunctions, "renameCbamCase");
const archiveCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "archiveCbamCase");
const deleteCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "deleteCbamCase");
const calculateCbamCallable = httpsCallable<{ caseId: string }, UnknownRecord>(firebaseFunctions, "calculateCbam");
const sealCbamReportCallable = httpsCallable<{
  caseId: string;
  entitlementId: string;
  requestId: string;
  correctionReason?: string;
}, SealResponse>(firebaseFunctions, "sealCbamReport");
const getCbamReportsCallable = httpsCallable<void, { reports: unknown[] }>(firebaseFunctions, "getCbamReports");
const getCbamReportCallable = httpsCallable<{ reportId: string }, { report: unknown }>(firebaseFunctions, "getCbamReport");
const getReportDownloadUrlCallable = httpsCallable<{
  reportId: string;
  format: ReportDownloadFormat;
}, ReportDownloadDescriptor>(firebaseFunctions, "getReportDownloadUrl");
const getEntitlementsCallable = httpsCallable<void, EntitlementsResponse>(firebaseFunctions, "getEntitlements");
const createCheckoutSessionCallable = httpsCallable<{
  productCode: typeof PREPARATION_PACK.productCode;
  requestId: string;
  caseId?: string;
}, { transactionId: string; status: "success" }>(firebaseFunctions, "createCheckoutSession");
const getSourcesStatusCallable = httpsCallable<void, UnknownRecord>(firebaseFunctions, "getSourcesStatus");
const verifyDocumentCallable = httpsCallable<{ documentHash: string }, UnknownRecord>(firebaseFunctions, "verifyDocument");
const getAccountOverviewCallable = httpsCallable<void, unknown>(firebaseFunctions, "getAccountOverview");
const updateOwnProfileCallable = httpsCallable<{
  displayName?: string;
  companyName?: string;
  phone?: string;
  country?: string;
}, { success: true; updatedAt: string }>(firebaseFunctions, "updateOwnProfile");
const listCreditLedgerCallable = httpsCallable<{ limit?: number }, { ledger: unknown[] }>(firebaseFunctions, "listCreditLedger");
const listPurchaseHistoryCallable = httpsCallable<{ limit?: number }, { history: unknown[] }>(firebaseFunctions, "listPurchaseHistory");
const requestAccountClosureCallable = httpsCallable<void, { success: true; requestedAt: string }>(firebaseFunctions, "requestAccountClosure");

export async function getCases(): Promise<CbamCaseRecord[]> {
  const result = await getCbamCasesCallable();
  return result.data.cases;
}

export async function getCase(caseId: string): Promise<AuditReadyCase> {
  const result = await getCbamCaseCallable({ caseId });
  return AuditReadyCaseSchema.parse(result.data.case);
}

export async function saveCase(data: AuditReadyCase, caseId?: string, requestId?: string): Promise<string> {
  const result = await saveCbamCaseCallable(createCaseSaveRequest(data, caseId, requestId));
  return result.data.caseId;
}

export async function reviewEvidence(params: {
  caseId: string;
  evidenceId: string;
  decision: "APPROVED" | "REJECTED";
  supportStatus: EvidenceSupportStatus;
  reviewerNotes: string;
}): Promise<AuditReadyCase> {
  const result = await reviewCbamEvidenceCallable(params);
  return AuditReadyCaseSchema.parse(result.data.case);
}

export async function recordEvidenceScan(params: {
  caseId: string;
  evidenceId: string;
  status: "CLEAN" | "INFECTED";
  scannerReference: string;
}): Promise<AuditReadyCase> {
  const result = await recordCbamEvidenceScanCallable(params);
  return AuditReadyCaseSchema.parse(result.data.case);
}

export async function renameCase(caseId: string, newName: string): Promise<boolean> {
  const result = await renameCbamCaseCallable({ caseId, newName });
  return result.data.success;
}

export async function archiveCase(caseId: string): Promise<boolean> {
  const result = await archiveCbamCaseCallable({ caseId });
  return result.data.success;
}

export async function deleteCase(caseId: string): Promise<boolean> {
  const result = await deleteCbamCaseCallable({ caseId });
  return result.data.success;
}

export async function calculateReport(caseId: string): Promise<UnknownRecord> {
  const result = await calculateCbamCallable({ caseId });
  return result.data;
}

export async function sealReport(caseId: string, entitlementId: string, requestId: string, correctionReason?: string): Promise<SealResponse> {
  const result = await sealCbamReportCallable({ caseId, entitlementId, requestId, correctionReason });
  return result.data;
}

export async function getReports(): Promise<SealedReportView[]> {
  const result = await getCbamReportsCallable();
  return result.data.reports.map(parseSealedReportView);
}

export async function getReport(reportId: string): Promise<SealedReportView> {
  const result = await getCbamReportCallable({ reportId });
  return parseSealedReportView(result.data.report);
}

export async function getReportDownload(reportId: string, format: ReportDownloadFormat): Promise<ReportDownloadDescriptor> {
  const parsedFormat = ReportDownloadFormatSchema.parse(format);
  const result = await getReportDownloadUrlCallable({ reportId, format: parsedFormat });
  return result.data;
}

export async function getReportDownloadUrl(reportId: string, format: ReportDownloadFormat): Promise<string> {
  const result = await getReportDownload(reportId, format);
  return result.url;
}

export async function getEntitlements(): Promise<PreparationPackEntitlement[]> {
  const result = await getEntitlementsCallable();
  return result.data.entitlements.map((entitlement) => ({
    ...entitlement,
    caseId: entitlement.scopeCaseId,
  }));
}

export async function getEntitlementSummary(): Promise<EntitlementsResponse> {
  const result = await getEntitlementsCallable();
  return {
    ...result.data,
    entitlements: result.data.entitlements.map((entitlement) => ({
      ...entitlement,
      caseId: entitlement.scopeCaseId,
    })),
  };
}

export async function createCheckout(requestId: string, caseId?: string) {
  const result = await createCheckoutSessionCallable({
    productCode: PREPARATION_PACK.productCode,
    requestId,
    ...(caseId ? { caseId } : {}),
  });
  return result.data;
}

export async function getSourcesStatus() {
  const result = await getSourcesStatusCallable();
  return result.data;
}

export async function verifyDocument(documentHash: string) {
  const result = await verifyDocumentCallable({ documentHash });
  return result.data;
}

export async function getAccountOverview(): Promise<AccountOverview> {
  const result = await getAccountOverviewCallable();
  return AccountOverviewSchema.parse(result.data);
}

export async function updateOwnProfile(data: {
  displayName?: string;
  companyName?: string;
  phone?: string;
  country?: string;
}) {
  const result = await updateOwnProfileCallable(data);
  return result.data;
}

export async function listCreditLedger(limit?: number): Promise<CreditLedgerEntry[]> {
  const result = await listCreditLedgerCallable({ limit });
  return result.data.ledger.map((entry) => CreditLedgerEntrySchema.parse(entry));
}

export async function listPurchaseHistory(limit?: number): Promise<PurchaseHistoryEntry[]> {
  const result = await listPurchaseHistoryCallable({ limit });
  return result.data.history.map((entry) => PurchaseHistoryEntrySchema.parse(entry));
}

export async function requestAccountClosure() {
  const result = await requestAccountClosureCallable();
  return result.data;
}
