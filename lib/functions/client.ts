import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "@/lib/firebase/client";

// Core Callables
export const getCbamCasesCallable = httpsCallable<void, { cases: any[] }>(firebaseFunctions, "getCbamCases");
export const getCbamCaseCallable = httpsCallable<{ caseId: string }, { case: any }>(firebaseFunctions, "getCbamCase");
export const saveCbamCaseCallable = httpsCallable<{ caseId?: string, data: any }, { caseId: string }>(firebaseFunctions, "saveCbamCase");
export const renameCbamCaseCallable = httpsCallable<{ caseId: string, newName: string }, { success: boolean }>(firebaseFunctions, "renameCbamCase");
export const archiveCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "archiveCbamCase");
export const deleteCbamCaseCallable = httpsCallable<{ caseId: string }, { success: boolean }>(firebaseFunctions, "deleteCbamCase");

export const calculateCbamCallable = httpsCallable<any, any>(firebaseFunctions, "calculateCbam");
export const sealCbamReportCallable = httpsCallable<{ caseId: string, entitlementId: string }, any>(firebaseFunctions, "sealCbamReport");

export const getCbamReportsCallable = httpsCallable<void, { reports: any[] }>(firebaseFunctions, "getCbamReports");
export const getCbamReportCallable = httpsCallable<{ reportId: string }, { report: any }>(firebaseFunctions, "getCbamReport");
export const getReportDownloadUrlCallable = httpsCallable<{ reportId: string, format: string }, { url: string }>(firebaseFunctions, "getReportDownloadUrl");

export const getEntitlementsCallable = httpsCallable<void, { entitlements: any[] }>(firebaseFunctions, "getEntitlements");
export const createCheckoutSessionCallable = httpsCallable<{ productCode: string, caseId: string }, { transactionId: string, error?: string }>(firebaseFunctions, "createCheckoutSession");
export const unlockCbamUsesCallable = httpsCallable<{ requestId: string }, any>(firebaseFunctions, "unlockCbamUses");

export const adminSetUserTokensCallable = httpsCallable<{ targetUserId: string, tokensToSet: number }, { success: boolean }>(firebaseFunctions, "adminSetUserTokens");
export const getSourcesStatusCallable = httpsCallable<void, any>(firebaseFunctions, "getSourcesStatus");
export const verifyDocumentCallable = httpsCallable<{ documentHash: string }, any>(firebaseFunctions, "verifyDocument");

// Account Callables
export const getAccountOverviewCallable = httpsCallable<void, any>(firebaseFunctions, "getAccountOverview");
export const updateOwnProfileCallable = httpsCallable<any, any>(firebaseFunctions, "updateOwnProfile");
export const listCreditLedgerCallable = httpsCallable<{ limit?: number }, any>(firebaseFunctions, "listCreditLedger");
export const listPurchaseHistoryCallable = httpsCallable<{ limit?: number }, any>(firebaseFunctions, "listPurchaseHistory");
export const requestAccountClosureCallable = httpsCallable<void, any>(firebaseFunctions, "requestAccountClosure");

// Admin Callables
export const listAllUsersCallable = httpsCallable<{ limit?: number, pageToken?: string }, any>(firebaseFunctions, "listAllUsers");
export const listAllTransactionsCallable = httpsCallable<{ limit?: number }, any>(firebaseFunctions, "listAllTransactions");

// Service Layer functions that abstract the Callables
export async function getCases() {
  const result = await getCbamCasesCallable();
  return result.data.cases;
}

export async function getCase(caseId: string) {
  const result = await getCbamCaseCallable({ caseId });
  return result.data.case;
}

export async function saveCase(data: any, caseId?: string) {
  const result = await saveCbamCaseCallable({ caseId, data });
  return result.data.caseId;
}

export async function renameCase(caseId: string, newName: string) {
  const result = await renameCbamCaseCallable({ caseId, newName });
  return result.data.success;
}

export async function archiveCase(caseId: string) {
  const result = await archiveCbamCaseCallable({ caseId });
  return result.data.success;
}

export async function deleteCase(caseId: string) {
  const result = await deleteCbamCaseCallable({ caseId });
  return result.data.success;
}

export async function calculateReport(data: any) {
  const result = await calculateCbamCallable(data);
  return result.data;
}

export async function sealReport(caseId: string, entitlementId: string) {
  const result = await sealCbamReportCallable({ caseId, entitlementId });
  return result.data;
}

export async function getReports() {
  const result = await getCbamReportsCallable();
  return result.data.reports;
}

export async function getReport(reportId: string) {
  const result = await getCbamReportCallable({ reportId });
  return result.data.report;
}

export async function getReportDownloadUrl(reportId: string, format: string) {
  const result = await getReportDownloadUrlCallable({ reportId, format });
  return result.data.url;
}

export async function getEntitlements() {
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

export async function updateOwnProfile(data: any) {
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
