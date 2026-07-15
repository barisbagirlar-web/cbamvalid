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
  entitlementId?: string;
  caseId?: string;
  status?: string;
  versionSequence?: number;
  releasesCount?: number;
  releasesRemaining?: number;
  [key: string]: unknown;
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

export const getCbamCasesCallable = httpsCallable<void, { cases: CbamCaseRecord[] }>(firebaseFunctions, "getCbamCases");
export const getCbamCaseCallable = httpsCallable<{ caseId: string }, { case: unknown }>(firebaseFunctions, "getCbamCase");
export const saveCbamCaseCallable = httpsCallable<{
  caseId?: string;
  requestId?: string;
  data: AuditReadyCase;
}, { caseId: string }>(firebaseFunctions, "saveCbamCase");
export const reviewCbamEvidenceCallable = httpsCallable<{
  caseId: string;
  evidenceId: string;
  decision: "APPROVED" | "REJECTED";
  supportStatus: EvidenceSupportStatus;
  reviewerNotes: string;
}, { case: unknown }>(firebaseFunctions, "reviewCbamEvidence");
export const recordCbamEvidenceScanCallable = httpsCallable<{
  caseId: string;
  evidenceId: string;
  status: "CLEAN" | "INFECTED";
  scannerReference: string;
}, { case: unknown }>(firebaseFunctions, "recordCbamEvidenceScan");
export const renameCbamCaseCallable = httpsCallable<{ caseId: string; newName: string }, { success: boolean }>(firebaseFunctions, "renameCbamCase");
export const archiveCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "archiveCbamCase");
export const deleteCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "deleteCbamCase");

export const calculateCbamCallable = httpsCallable<{ caseId: string }, UnknownRecord>(firebaseFunctions, "calculateCbam");
export const sealCbamReportCallable = httpsCallable<{
  caseId: string;
  entitlementId: string;
  requestId: string;
  correctionReason?: string;
}, SealResponse>(firebaseFunctions, "sealCbamReport");

export const getCbamReportsCallable = httpsCallable<void, { reports: unknown[] }>(firebaseFunctions, "getCbamReports");
export const getCbamReportCallable = httpsCallable<{ reportId: string }, { report: unknown }>(firebaseFunctions, "getCbamReport");
export const getReportDownloadUrlCallable = httpsCallable<{
  reportId: string;
  format: ReportDownloadFormat;
}, ReportDownloadDescriptor>(firebaseFunctions, "getReportDownloadUrl");

export const getEntitlementsCallable = httpsCallable<void, { entitlements: PreparationPackEntitlement[] }>(firebaseFunctions, "getEntitlements");
export const createCheckoutSessionCallable = httpsCallable<{ productCode: string; caseId: string }, { transactionId: string; error?: string }>(firebaseFunctions, "createCheckoutSession");
export const unlockCbamUsesCallable = httpsCallable<{ requestId: string }, UnknownRecord>(firebaseFunctions, "unlockCbamUses");

export const adminSetUserTokensCallable = httpsCallable<{ targetUserId: string; tokensToSet: number }, { success: boolean }>(firebaseFunctions, "adminSetUserTokens");
export const getSourcesStatusCallable = httpsCallable<void, UnknownRecord>(firebaseFunctions, "getSourcesStatus");
export const verifyDocumentCallable = httpsCallable<{ documentHash: string }, UnknownRecord>(firebaseFunctions, "verifyDocument");

export const getAccountOverviewCallable = httpsCallable<void, UnknownRecord>(firebaseFunctions, "getAccountOverview");
export const updateOwnProfileCallable = httpsCallable<UnknownRecord, UnknownRecord>(firebaseFunctions, "updateOwnProfile");
export const listCreditLedgerCallable = httpsCallable<{ limit?: number }, { ledger: UnknownRecord[] }>(firebaseFunctions, "listCreditLedger");
export const listPurchaseHistoryCallable = httpsCallable<{ limit?: number }, { history: UnknownRecord[] }>(firebaseFunctions, "listPurchaseHistory");
export const requestAccountClosureCallable = httpsCallable<void, UnknownRecord>(firebaseFunctions, "requestAccountClosure");

export const listAllUsersCallable = httpsCallable<{ limit?: number; pageToken?: string }, { users: UnknownRecord[] }>(firebaseFunctions, "listAllUsers");
export const listAllTransactionsCallable = httpsCallable<{ limit?: number }, { transactions: UnknownRecord[] }>(firebaseFunctions, "listAllTransactions");

export async function getCases(): Promise<CbamCaseRecord[]> {
  const result = await getCbamCasesCallable();
  return result.data.cases;
}

export async function getCase(caseId: string): Promise<AuditReadyCase> {
  const result = await getCbamCaseCallable({ caseId });
  return AuditReadyCaseSchema.parse(result.data.case);
}

export async function saveCase(
  data: AuditReadyCase,
  caseId?: string,
  requestId?: string
): Promise<string> {
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

export async function sealReport(
  caseId: string,
  entitlementId: string,
  requestId: string,
  correctionReason?: string
): Promise<SealResponse> {
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

export async function getReportDownload(
  reportId: string,
  format: ReportDownloadFormat
): Promise<ReportDownloadDescriptor> {
  const parsedFormat = ReportDownloadFormatSchema.parse(format);
  const result = await getReportDownloadUrlCallable({ reportId, format: parsedFormat });
  return result.data;
}

export async function getReportDownloadUrl(
  reportId: string,
  format: ReportDownloadFormat
): Promise<string> {
  const result = await getReportDownload(reportId, format);
  return result.url;
}

export async function getEntitlements(): Promise<PreparationPackEntitlement[]> {
  const result = await getEntitlementsCallable();
  return result.data.entitlements;
}

export async function createCheckout(productCode: string, caseId: string) {
  const result = await createCheckoutSessionCallable({ productCode, caseId });
  return result.data;
}

export async function unlockCbamUses(requestId: string) {
  const result = await unlockCbamUsesCallable({ requestId });
  return result.data;
}

export async function adminSetUserTokens(targetUserId: string, tokensToSet: number) {
  const result = await adminSetUserTokensCallable({ targetUserId, tokensToSet });
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

export async function getAccountOverview() {
  const result = await getAccountOverviewCallable();
  return result.data;
}

export async function updateOwnProfile(data: UnknownRecord) {
  const result = await updateOwnProfileCallable(data);
  return result.data;
}

export async function listCreditLedger(limit?: number) {
  const result = await listCreditLedgerCallable({ limit });
  return result.data.ledger;
}

export async function listPurchaseHistory(limit?: number) {
  const result = await listPurchaseHistoryCallable({ limit });
  return result.data.history;
}

export async function requestAccountClosure() {
  const result = await requestAccountClosureCallable();
  return result.data;
}

export async function listAllUsers(limit?: number, pageToken?: string) {
  const result = await listAllUsersCallable({ limit, pageToken });
  return result.data.users;
}

export async function listAllTransactions(limit?: number) {
  const result = await listAllTransactionsCallable({ limit });
  return result.data.transactions;
}
