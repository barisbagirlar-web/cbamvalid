import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { verifyCaseOwner } from "../cbam/storage/case-repository";

export const sealCbamReport = createCallable(
  {
    schema: z.object({
      caseId: z.string().min(1),
      entitlementId: z.string().min(1),
      requestId: z.string().uuid()
    })
  },
  async ({ caseId, entitlementId, requestId }, { auth }) => {
    const { sealReport } = await import("../cbam/report/seal-service");
    try {
      const cbamCase = await verifyCaseOwner(caseId, auth.uid);
      const report = await sealReport({
        uid: auth.uid,
        caseId,
        entitlementId,
        requestId,
        inputData: cbamCase.data,
      });
      return { report, status: "success" };
    } catch (err: any) {
      console.error("[SEAL-CALLABLE] Sealing failed:", err?.message || err);
      const message = String(err?.message || "Sealing failed.");
      if (message.startsWith("SEALING_BLOCKED") || message.startsWith("CASE_SCHEMA_INVALID")) {
        throw new HttpsError("failed-precondition", message);
      }
      if (message.includes("Ownership") || message.includes("different dossier")) {
        throw new HttpsError("permission-denied", message);
      }
      throw new HttpsError("internal", message);
    }
  }
);

export const getCbamReports = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb
    .collection("cbam_reports")
    .where("uid", "==", auth.uid)
    .get();
  const reports = snapshot.docs
    .map((doc) => doc.data())
    .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { reports, status: "success" };
});

export const getCbamReport = createCallable(
  { schema: z.object({ reportId: z.string().min(1) }) },
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
    schema: z.object({
      reportId: z.string().min(1),
      format: z.enum(["zip", "manifest"])
    })
  },
  async ({ reportId, format }, { auth }) => {
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data() as any;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }

    const { getStorage } = await import("firebase-admin/storage");
    const { getApp } = await import("firebase-admin/app");
    const filePath = format === "zip" ? report.storagePath : report.manifestStoragePath;
    if (!filePath) {
      throw new HttpsError("failed-precondition", "Requested release artifact is unavailable.");
    }

    const bucket = getStorage(getApp()).bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", "Requested release artifact was not found.");
    }

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: `attachment; filename="${format === "zip" ? `CBAMValid_${reportId}_Verifier_Preparation_Package.zip` : `CBAMValid_${reportId}_Data_Integrity_Manifest.json`}"`,
    });

    return { url, status: "success" };
  }
);
