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
  return (await getCbamCasesCallable()).data.cases;
}

export async function getCase(caseId: string): Promise<AuditReadyCase> {
  return AuditReadyCaseSchema.parse((await getCbamCaseCallable({ caseId })).data.case);
}

export async function saveCase(data: AuditReadyCase, caseId?: string, requestId?: string): Promise<string> {
  return (await saveCbamCaseCallable(createCaseSaveRequest(data, caseId, requestId))).data.caseId;
}

export async function reviewEvidence(params: {
  caseId: string;
  evidenceId: string;
  decision: "APPROVED" | "REJECTED";
  supportStatus: EvidenceSupportStatus;
  reviewerNotes: string;
}): Promise<AuditReadyCase> {
  return AuditReadyCaseSchema.parse((await reviewCbamEvidenceCallable(params)).data.case);
}

export async function recordEvidenceScan(params: {
  caseId: string;
  evidenceId: string;
  status: "CLEAN" | "INFECTED";
  scannerReference: string;
}): Promise<AuditReadyCase> {
  return AuditReadyCaseSchema.parse((await recordCbamEvidenceScanCallable(params)).data.case);
}

export async function renameCase(caseId: string, newName: string): Promise<boolean> {
  return (await renameCbamCaseCallable({ caseId, newName })).data.success;
}

export async function archiveCase(caseId: string): Promise<boolean> {
  return (await archiveCbamCaseCallable({ caseId })).data.success;
}

export async function deleteCase(caseId: string): Promise<boolean> {
  return (await deleteCbamCaseCallable({ caseId })).data.success;
}

export async function calculateReport(caseId: string): Promise<UnknownRecord> {
  return (await calculateCbamCallable({ caseId })).data;
}

export async function sealReport(caseId: string, entitlementId: string, requestId: string, correctionReason?: string): Promise<SealResponse> {
  return (await sealCbamReportCallable({ caseId, entitlementId, requestId, correctionReason })).data;
}

export async function getReports(): Promise<SealedReportView[]> {
  return (await getCbamReportsCallable()).data.reports.map(parseSealedReportView);
}

export async function getReport(reportId: string): Promise<SealedReportView> {
  return parseSealedReportView((await getCbamReportCallable({ reportId })).data.report);
}

export async function getReportDownload(reportId: string, format: ReportDownloadFormat): Promise<ReportDownloadDescriptor> {
  return (await getReportDownloadUrlCallable({ reportId, format: ReportDownloadFormatSchema.parse(format) })).data;
}

export async function getReportDownloadUrl(reportId: string, format: ReportDownloadFormat): Promise<string> {
  return (await getReportDownload(reportId, format)).url;
}

export async function getEntitlements(): Promise<PreparationPackEntitlement[]> {
  return (await getEntitlementsCallable()).data.entitlements;
}

export async function getEntitlementSummary(): Promise<EntitlementsResponse> {
  return (await getEntitlementsCallable()).data;
}

export async function createCheckout(requestId: string, caseId?: string) {
  return (await createCheckoutSessionCallable({
    productCode: PREPARATION_PACK.productCode,
    requestId,
    ...(caseId ? { caseId } : {}),
  })).data;
}

export async function getSourcesStatus() {
  return (await getSourcesStatusCallable()).data;
}

export async function verifyDocument(documentHash: string) {
  return (await verifyDocumentCallable({ documentHash })).data;
}

export async function getAccountOverview(): Promise<AccountOverview> {
  return AccountOverviewSchema.parse((await getAccountOverviewCallable()).data);
}

export async function updateOwnProfile(data: {
  displayName?: string;
  companyName?: string;
  phone?: string;
  country?: string;
}) {
  return (await updateOwnProfileCallable(data)).data;
}

export async function listCreditLedger(limit?: number): Promise<CreditLedgerEntry[]> {
  return (await listCreditLedgerCallable({ limit })).data.ledger.map((entry) => CreditLedgerEntrySchema.parse(entry));
}

export async function listPurchaseHistory(limit?: number): Promise<PurchaseHistoryEntry[]> {
  return (await listPurchaseHistoryCallable({ limit })).data.history.map((entry) => PurchaseHistoryEntrySchema.parse(entry));
}

export async function requestAccountClosure() {
  return (await requestAccountClosureCallable()).data;
}
