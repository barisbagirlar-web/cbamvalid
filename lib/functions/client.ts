import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "@/lib/firebase/client";

// Core Callables
export const getCbamCasesCallable = httpsCallable<void, { cases: any[] }>(firebaseFunctions, "getCbamCases");
export const getCbamCaseCallable = httpsCallable<{ caseId: string }, { case: any }>(firebaseFunctions, "getCbamCase");
export const saveCbamCaseCallable = httpsCallable<{ caseId?: string, data: any }, { case: any }>(firebaseFunctions, "saveCbamCase");

export const calculateCbamCallable = httpsCallable<any, any>(firebaseFunctions, "calculateCbam");
export const sealCbamReportCallable = httpsCallable<{ caseId: string, entitlementId: string }, any>(firebaseFunctions, "sealCbamReport");

export const getCbamReportsCallable = httpsCallable<void, { reports: any[] }>(firebaseFunctions, "getCbamReports");
export const getCbamReportCallable = httpsCallable<{ reportId: string }, { report: any }>(firebaseFunctions, "getCbamReport");
export const getReportDownloadUrlCallable = httpsCallable<{ reportId: string, format: string }, { url: string }>(firebaseFunctions, "getReportDownloadUrl");

export const getEntitlementsCallable = httpsCallable<void, { entitlements: any[] }>(firebaseFunctions, "getEntitlements");
export const createCheckoutSessionCallable = httpsCallable<{ productCode: string, caseId: string }, { transactionId: string, error?: string }>(firebaseFunctions, "createCheckoutSession");

export const adminSetUserTokensCallable = httpsCallable<{ targetUserId: string, tokensToSet: number }, { success: boolean }>(firebaseFunctions, "adminSetUserTokens");
export const getSourcesStatusCallable = httpsCallable<void, any>(firebaseFunctions, "getSourcesStatus");
export const verifyDocumentCallable = httpsCallable<{ documentHash: string }, any>(firebaseFunctions, "verifyDocument");

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
  return result.data.case;
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
