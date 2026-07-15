import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

export const sealCbamReport = createCallable(
  {
    schema: z.object({
      caseId: z.string(),
      entitlementId: z.string(),
      correctionReason: z.string().optional()
    })
  },
  async ({ caseId, entitlementId, correctionReason }, { auth }) => {
    const { sealReport } = await import("../cbam/report/seal-service");
    try {
      // Load authoritative case revision on the server
      const caseDoc = await adminDb.collection("cbam_cases").doc(caseId).get();
      if (!caseDoc.exists) {
        throw new HttpsError("not-found", "Case not found.");
      }
      const cbamCase = caseDoc.data();
      if (!cbamCase || cbamCase.uid !== auth.uid) {
        throw new HttpsError("permission-denied", "Access denied to case.");
      }
      
      const report = await sealReport({
        uid: auth.uid,
        caseId,
        entitlementId,
        inputData: cbamCase.data,
        correctionReason
      });
      return { report, status: "success" };
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  }
);

export const getCbamReports = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("cbam_reports").where("uid", "==", auth.uid).get();
  const reports = snapshot.docs.map(doc => doc.data());
  return { reports, status: "success" };
});

export const getCbamReport = createCallable(
  {
    schema: z.object({ reportId: z.string() })
  },
  async ({ reportId }, { auth }) => {
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data() as any;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
  }
);

export const getReportDownloadUrl = createCallable(
  {
    schema: z.object({ reportId: z.string(), format: z.string() })
  },
  async ({ reportId, format }, { auth }) => {
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data() as any;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }
    
    const { getStorage } = await import("firebase-admin/storage");
    const { getApp } = await import("firebase-admin/app");
    
    let ext = format;
    if (format === "xlsx") ext = "xls";
    
    const filePath = `reports/${auth.uid}/${reportId}/dossier.${ext}`;
    const bucket = getStorage(getApp()).bucket();
    const file = bucket.file(filePath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    
    return { url, status: "success" };
  }
);
