import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { getCase } from "../cbam/storage/case-repository";
import { CaseIdSchema } from "../cbam/case-id";

export const sealCbamReport = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      entitlementId: z.string(),
      correctionReason: z.string().optional()
    })
  },
  async ({ caseId, entitlementId, correctionReason }, { auth }) => {
    const { sealReport } = await import("../cbam/report/seal-service");
    try {
      const cbamCase = await getCase(caseId);
      if (!cbamCase) {
        throw new HttpsError("not-found", "Case not found.");
      }
      if (cbamCase.uid !== auth.uid) {
        throw new HttpsError("permission-denied", "Access denied to case.");
      }

      const report = await sealReport({
        uid: auth.uid,
        caseId: cbamCase.caseId,
        entitlementId,
        inputData: cbamCase.data,
        correctionReason
      });
      return { report, status: "success" };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Report generation failed."
      );
    }
  }
);

export const getCbamReports = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("cbam_reports").where("uid", "==", auth.uid).get();
  const reports = snapshot.docs.map((document) => document.data());
  return { reports, status: "success" };
});

export const getCbamReport = createCallable(
  { schema: z.object({ reportId: z.string() }) },
  async ({ reportId }, { auth }) => {
    const document = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = document.data() as Record<string, unknown> | undefined;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
  }
);

export const getReportDownloadUrl = createCallable(
  { schema: z.object({ reportId: z.string(), format: z.string() }) },
  async ({ reportId, format }, { auth }) => {
    const document = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = document.data() as Record<string, unknown> | undefined;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }

    const { getStorage } = await import("firebase-admin/storage");
    const { getApp } = await import("firebase-admin/app");
    const extension = format === "xlsx" ? "xls" : format;
    const filePath = `reports/${auth.uid}/${reportId}/dossier.${extension}`;
    const file = getStorage(getApp()).bucket().file(filePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

    return { url, status: "success" };
  }
);
