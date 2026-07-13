import crypto from "crypto";
import { adminDb } from "../../firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { getApp } from "firebase-admin/app";
import { performDossierCalculations } from "../calculator";
import { runQualityControls } from "../validation/quality-controls";
import {
  reserveEntitlement,
  consumeEntitlement,
  releaseEntitlementReservation,
} from "../../commerce/entitlement-service";
import { AuditReadyCase, AuditReadyCaseSchema } from "../schema";
import {
  buildVerifierPreparationPackage,
  PackageEvidenceFile,
} from "./verifier-package-builder";

export interface SealingResult {
  reportId: string;
  releaseVersion: number;
  documentHash: string;
  manifestHash: string;
  packageTopLevelComponentCount: number;
  verifiedFileCount: number;
  status: "SEALED";
}

export type SealState =
  | "SEAL_REQUESTED"
  | "QC_VALIDATED"
  | "EVIDENCE_VERIFIED"
  | "ENTITLEMENT_RESERVED"
  | "DATA_FROZEN"
  | "CALCULATION_COMPLETE"
  | "ARTIFACTS_GENERATED"
  | "PACKAGE_VERIFIED"
  | "OUTBOX_WRITTEN"
  | "ENTITLEMENT_CONSUMED"
  | "SEAL_ACTIVATED"
  | "COMPLETION_NOTIFIED"
  | "FAILED";

export function calculateSha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function deterministicReportId(uid: string, caseId: string, requestId: string): string {
  return `rel_${calculateSha256(`${uid}:${caseId}:${requestId}`).slice(0, 32)}`;
}

async function nextReleaseVersion(uid: string, caseId: string): Promise<number> {
  const snapshot = await adminDb
    .collection("cbam_reports")
    .where("uid", "==", uid)
    .where("caseId", "==", caseId)
    .get();

  return snapshot.docs.reduce((max, doc) => {
    const version = Number(doc.data()?.releaseVersion || 0);
    return Number.isFinite(version) ? Math.max(max, version) : max;
  }, 0) + 1;
}

async function loadEvidenceFiles(caseData: AuditReadyCase): Promise<PackageEvidenceFile[]> {
  const bucket = getStorage(getApp()).bucket();
  const files: PackageEvidenceFile[] = [];

  for (const evidence of caseData.evidenceRegister) {
    if (!evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`)) {
      throw new Error(`EVIDENCE_STORAGE_PATH_OWNERSHIP_MISMATCH:${evidence.evidenceId}`);
    }

    const file = bucket.file(evidence.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`EVIDENCE_FILE_MISSING:${evidence.evidenceId}`);
    }

    const [buffer] = await file.download();
    if (buffer.byteLength !== evidence.sizeBytes) {
      throw new Error(`EVIDENCE_FILE_SIZE_MISMATCH:${evidence.evidenceId}`);
    }
    if (calculateSha256(buffer) !== evidence.fileHash.toLowerCase()) {
      throw new Error(`EVIDENCE_FILE_HASH_MISMATCH:${evidence.evidenceId}`);
    }

    files.push({
      evidenceId: evidence.evidenceId,
      fileName: evidence.fileName,
      buffer,
      mimeType: evidence.mimeType,
      sourceHash: evidence.fileHash.toLowerCase(),
    });
  }

  return files;
}

async function writeState(reportId: string, state: SealState, extra: Record<string, unknown> = {}) {
  await adminDb.collection("seal_log").doc(reportId).set({
    reportId,
    state,
    timestamp: new Date().toISOString(),
    ...extra,
  }, { merge: true });
}

export async function sealReport(params: {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  inputData: unknown;
}): Promise<SealingResult> {
  const reportId = deterministicReportId(params.uid, params.caseId, params.requestId);
  const reportRef = adminDb.collection("cbam_reports").doc(reportId);
  const existingReport = await reportRef.get();

  if (existingReport.exists) {
    const existing = existingReport.data() as SealingResult & { uid: string; caseId: string };
    if (existing.uid !== params.uid || existing.caseId !== params.caseId) {
      throw new Error("SEAL_REQUEST_ID_COLLISION");
    }
    return {
      reportId,
      releaseVersion: existing.releaseVersion,
      documentHash: existing.documentHash,
      manifestHash: existing.manifestHash,
      packageTopLevelComponentCount: existing.packageTopLevelComponentCount,
      verifiedFileCount: existing.verifiedFileCount,
      status: "SEALED",
    };
  }

  await writeState(reportId, "SEAL_REQUESTED", {
    uid: params.uid,
    caseId: params.caseId,
    requestId: params.requestId,
  });

  let reservationCreated = false;

  try {
    const parsed = AuditReadyCaseSchema.safeParse({
      ...(params.inputData as Record<string, unknown>),
      caseId: params.caseId,
      ownerId: params.uid,
    });
    if (!parsed.success) {
      throw new Error(`CASE_SCHEMA_INVALID:${parsed.error.issues.map((issue) => issue.path.join(".")).join(",")}`);
    }
    const caseData = parsed.data;

    const qualityControls = runQualityControls(caseData);
    const blockers = qualityControls.filter((item) => item.status === "BLOCKER");
    if (blockers.length > 0) {
      throw new Error(`SEALING_BLOCKED:${blockers.map((item) => item.ruleId).join(",")}`);
    }
    await writeState(reportId, "QC_VALIDATED", { qualityControls });

    const evidenceFiles = await loadEvidenceFiles(caseData);
    await writeState(reportId, "EVIDENCE_VERIFIED", {
      evidenceCount: evidenceFiles.length,
      evidenceRootHash: calculateSha256(
        JSON.stringify(caseData.evidenceRegister.map((record) => record.fileHash).sort())
      ),
    });

    await adminDb.runTransaction(async (dbTransaction: any) => {
      await reserveEntitlement(dbTransaction, {
        entitlementId: params.entitlementId,
        uid: params.uid,
        caseId: params.caseId,
        reportId,
      });
    });
    reservationCreated = true;
    await writeState(reportId, "ENTITLEMENT_RESERVED");

    const caseSnapshot = JSON.stringify(canonicalize(caseData));
    const caseSnapshotHash = calculateSha256(caseSnapshot);
    await writeState(reportId, "DATA_FROZEN", { caseSnapshotHash });

    const calculation = performDossierCalculations(caseData);
    await writeState(reportId, "CALCULATION_COMPLETE", {
      calculationRootHash: calculation.calculationRootHash,
      ruleset: calculation.ruleset,
      engineVersion: calculation.engineVersion,
    });

    const releaseVersion = await nextReleaseVersion(params.uid, params.caseId);
    const packageResult = await buildVerifierPreparationPackage({
      releaseId: reportId,
      caseData: { ...caseData, version: releaseVersion },
      calculation,
      qualityControls,
      evidenceFiles,
    });
    await writeState(reportId, "ARTIFACTS_GENERATED");

    const documentHash = calculateSha256(packageResult.zipBuffer);
    const verifiedFileCount = packageResult.manifest.files.length;
    await writeState(reportId, "PACKAGE_VERIFIED", {
      documentHash,
      manifestHash: packageResult.manifestHash,
      packageTopLevelComponentCount: 23,
      verifiedFileCount,
    });

    const bucket = getStorage(getApp()).bucket();
    const basePath = `reports/${params.uid}/${reportId}`;
    await Promise.all([
      bucket.file(`${basePath}/verifier-preparation-package.zip`).save(packageResult.zipBuffer, {
        contentType: "application/zip",
        resumable: false,
        metadata: { cacheControl: "private, max-age=0, no-store" },
      }),
      bucket.file(`${basePath}/data-integrity-manifest.json`).save(
        JSON.stringify(packageResult.manifest, null, 2),
        {
          contentType: "application/json",
          resumable: false,
          metadata: { cacheControl: "private, max-age=0, no-store" },
        }
      ),
    ]);

    const now = new Date().toISOString();
    const sealedReport = {
      reportId,
      releaseId: reportId,
      releaseVersion,
      requestId: params.requestId,
      uid: params.uid,
      caseId: params.caseId,
      status: "SEALED",
      documentHash,
      manifestHash: packageResult.manifestHash,
      caseSnapshotHash,
      evidenceRootHash: calculateSha256(
        JSON.stringify(caseData.evidenceRegister.map((record) => record.fileHash).sort())
      ),
      calculationRootHash: calculation.calculationRootHash,
      ruleset: calculation.ruleset,
      engineVersion: calculation.engineVersion,
      packageTopLevelComponentCount: 23,
      verifiedFileCount,
      storagePath: `${basePath}/verifier-preparation-package.zip`,
      manifestStoragePath: `${basePath}/data-integrity-manifest.json`,
      calculation,
      qualityControls,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("seal_outbox").doc(reportId).set(sealedReport);
    await writeState(reportId, "OUTBOX_WRITTEN");

    await adminDb.runTransaction(async (dbTransaction: any) => {
      await consumeEntitlement(dbTransaction, {
        entitlementId: params.entitlementId,
        uid: params.uid,
        caseId: params.caseId,
        reportId,
        reportHash: documentHash,
      });

      dbTransaction.set(adminDb.collection("document_seals").doc(documentHash), {
        valid: true,
        documentHash,
        manifestHash: packageResult.manifestHash,
        reportId,
        caseId: params.caseId,
        releaseVersion,
        issuedAt: now,
        commercialStatus: "ACTIVE",
        verificationBoundary: "PREPARATION_FOR_INDEPENDENT_VERIFICATION",
      });
      dbTransaction.set(reportRef, sealedReport);
      dbTransaction.set(adminDb.collection("cbam_cases").doc(params.caseId), {
        latestReleaseId: reportId,
        latestReleaseVersion: releaseVersion,
        updatedAt: now,
      }, { merge: true });
    });

    await writeState(reportId, "ENTITLEMENT_CONSUMED");
    await writeState(reportId, "SEAL_ACTIVATED");
    await adminDb.collection("seal_outbox").doc(reportId).delete();
    await writeState(reportId, "COMPLETION_NOTIFIED");

    return {
      reportId,
      releaseVersion,
      documentHash,
      manifestHash: packageResult.manifestHash,
      packageTopLevelComponentCount: 23,
      verifiedFileCount,
      status: "SEALED",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEALING_FAILED";
    console.error(`[SEALING-ENGINE] Sealing failed for report ${reportId}.`, error);
    await writeState(reportId, "FAILED", { error: message });

    if (reservationCreated) {
      try {
        await adminDb.runTransaction(async (dbTransaction: any) => {
          await releaseEntitlementReservation(dbTransaction, {
            entitlementId: params.entitlementId,
            uid: params.uid,
            caseId: params.caseId,
            reportId,
          });
        });
      } catch (releaseError) {
        console.error("[SEALING-ENGINE] Failed to release entitlement reservation:", releaseError);
      }
    }
    throw error;
  }
}
