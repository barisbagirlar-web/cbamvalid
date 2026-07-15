import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb, getStorageBucket } from "../firebase-admin";
import { getCase } from "../cbam/storage/case-repository";
import { CaseIdSchema } from "../cbam/case-id";
import { assertKmsSigningConfigured } from "../cbam/report/kms-signature";
import { toSealedReportView } from "../cbam/report/report-contract";

function sealError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : "REPORT_GENERATION_FAILED";
  if (message === "SEAL_REQUEST_IN_PROGRESS") return new HttpsError("aborted", message);
  if (message.includes("NOT_FOUND") || message.includes("MISSING")) return new HttpsError("not-found", message);
  if (
    message.includes("REQUIRED") ||
    message.includes("BLOCKED") ||
    message.includes("MISMATCH") ||
    message.includes("INVALID") ||
    message.includes("NOT_ACTIVE") ||
    message.includes("NOT_CLEAN") ||
    message.includes("NOT_RECONCILED") ||
    message.includes("LIMIT") ||
    message.includes("CONFIGURED") ||
    message.includes("KMS_")
  ) return new HttpsError("failed-precondition", message);
  if (message.includes("COLLISION") || message.includes("INPUT_CHANGED")) return new HttpsError("already-exists", message);
  return new HttpsError("internal", message);
}

export const sealCbamReport = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      entitlementId: z.string().trim().min(1).max(128),
      requestId: z.string().uuid(),
      correctionReason: z.string().trim().min(10).max(2000).optional(),
    }),
  },
  async ({ caseId, entitlementId, requestId, correctionReason }, { auth }) => {
    try {
      assertKmsSigningConfigured();
      const cbamCase = await getCase(caseId);
      if (!cbamCase) throw new HttpsError("not-found", "Case not found.");
      if (cbamCase.uid !== auth.uid) throw new HttpsError("permission-denied", "Access denied to case.");
      if (cbamCase.status !== "DRAFT") throw new HttpsError("failed-precondition", "Only an active draft can be sealed.");

      const { sealReport } = await import("../cbam/report/seal-service");
      const report = await sealReport({
        uid: auth.uid,
        caseId: cbamCase.caseId,
        entitlementId,
        requestId,
        inputData: cbamCase.data,
        correctionReason,
      });
      return { report, status: "success" };
    } catch (error) {
      throw sealError(error);
    }
  }
);

export const getCbamReports = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("cbam_reports")
    .where("uid", "==", auth.uid)
    .where("status", "==", "SEALED")
    .get();
  const reports = snapshot.docs
    .map((document) => toSealedReportView(document.data()))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { reports, status: "success" };
});

export const getCbamReport = createCallable(
  { schema: z.object({ reportId: z.string().regex(/^report_[a-f0-9]{64}$/) }) },
  async ({ reportId }, { auth }) => {
    const document = await adminDb.collection("cbam_reports").doc(reportId).get();
    if (!document.exists) throw new HttpsError("not-found", "Report not found or access denied.");
    const report = toSealedReportView(document.data());
    if (report.uid !== auth.uid) throw new HttpsError("not-found", "Report not found or access denied.");
    return { report, status: "success" };
  }
);

const DOWNLOADS = {
  zip: { file: "dossier.zip", downloadName: "CBAMValid-Verifier-Preparation-Dossier.zip" },
  pdf: { file: "dossier.pdf", downloadName: "Operator-Emissions-Report.pdf" },
  xlsx: { file: "dossier.xlsx", downloadName: "Verifier-Workspace.xlsx" },
  manifest: { file: "manifest.json", downloadName: "Data-Integrity-Manifest.json" },
  signature: { file: "manifest.sig", downloadName: "Manifest-Signature.sig" },
  snapshot: { file: "case-snapshot.json", downloadName: "Immutable-Case-Snapshot.json" },
} as const;

export const getReportDownloadUrl = createCallable(
  {
    schema: z.object({
      reportId: z.string().regex(/^report_[a-f0-9]{64}$/),
      format: z.enum(["zip", "pdf", "xlsx", "manifest", "signature", "snapshot"]),
    }),
  },
  async ({ reportId, format }, { auth }) => {
    const document = await adminDb.collection("cbam_reports").doc(reportId).get();
    if (!document.exists) throw new HttpsError("not-found", "Report not found or access denied.");
    const report = toSealedReportView(document.data());
    if (report.uid !== auth.uid) throw new HttpsError("not-found", "Report not found or access denied.");

    const target = DOWNLOADS[format];
    const entry = report.storage[target.file];
    const expectedPath = `reports/${auth.uid}/${reportId}/${target.file}`;
    if (!entry || entry.path !== expectedPath) {
      throw new HttpsError("failed-precondition", "Immutable report storage index is missing or inconsistent.");
    }

    const file = getStorageBucket().file(expectedPath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("not-found", "Requested immutable report artifact is missing.");
    const [metadata] = await file.getMetadata();
    const storedHash = metadata.metadata.sha256?.toLowerCase() || "";
    if (Number(metadata.size) !== entry.sizeBytes || storedHash !== entry.sha256.toLowerCase()) {
      throw new HttpsError("failed-precondition", "Immutable report artifact metadata does not match the sealed index.");
    }

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: `attachment; filename="${target.downloadName}"`,
    });
    return { url, fileName: target.downloadName, sha256: entry.sha256, sizeBytes: entry.sizeBytes, status: "success" };
  }
);
