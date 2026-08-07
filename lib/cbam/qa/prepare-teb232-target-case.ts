import "server-only";

import { createHash } from "node:crypto";
import type { Bucket } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";
import { AuditReadyCaseSchema } from "../../../functions/src/cbam/schema";
import { assessCaseReadiness } from "../../../functions/src/cbam/validation/readiness-assessor";
import { buildFourDossierEvidenceFiles } from "../../../tests/fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_UID,
  buildTeb232Case,
} from "../../../scripts/refresh-teb232-four-complete-cases";

export const TEB232_TARGET_CASE_ID =
  "case_80aeb60175ce08a0d3acb7bc46617f152f0442f97ee652435280a2f2dff5e7cc";
export const TEB232_TARGET_FIXTURE = "STEEL_IN" as const;
const TARGET_PREPARATION_VERSION = "TEB232_TARGET_SEAL_READY_V1";

type FileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type Teb232TargetPrepareResult = {
  changed: boolean;
  caseId: string;
  fixtureKey: typeof TEB232_TARGET_FIXTURE;
  operatorPreparation: 100;
  evidenceAssurance: 100;
};

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function evidenceFilesAreValid(
  bucket: Bucket,
  data: ReturnType<typeof AuditReadyCaseSchema.parse>
): Promise<boolean> {
  for (const record of data.evidenceRegister) {
    try {
      const file = bucket.file(record.storagePath);
      const [exists] = await file.exists();
      if (!exists) return false;
      const [bytes] = await file.download();
      const [metadata] = await file.getMetadata();
      if (
        bytes.byteLength !== record.sizeBytes ||
        sha256(bytes) !== record.fileHash ||
        String(metadata.contentType || "") !== record.mimeType
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function currentTargetIsHealthy(
  bucket: Bucket,
  stored: Record<string, unknown>
): Promise<boolean> {
  if (
    stored.syntheticTestTarget !== true ||
    stored.targetPreparationVersion !== TARGET_PREPARATION_VERSION ||
    stored.targetFixtureKey !== TEB232_TARGET_FIXTURE
  ) {
    return false;
  }

  try {
    const parsed = AuditReadyCaseSchema.parse({
      ...((stored.data || {}) as Record<string, unknown>),
      caseId: TEB232_TARGET_CASE_ID,
      ownerId: TEB232_UID,
    });
    const readiness = assessCaseReadiness(parsed);
    if (
      readiness.isEligibleForSealing !== true ||
      readiness.completenessPercentage !== 100 ||
      readiness.criticalBlockers.length !== 0 ||
      readiness.allGaps.length !== 0
    ) {
      return false;
    }
    if (
      parsed.evidenceRegister.some(
        (record) =>
          record.reviewStatus !== "APPROVED" ||
          record.supportStatus !== "SUPPORTED" ||
          record.malwareScanStatus !== "CLEAN"
      )
    ) {
      return false;
    }
    return evidenceFilesAreValid(bucket, parsed);
  } catch {
    return false;
  }
}

async function captureFiles(bucket: Bucket, prefix: string): Promise<FileBackup[]> {
  const [files] = await bucket.getFiles({ prefix });
  const backups: FileBackup[] = [];
  for (const file of files) {
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    backups.push({
      name: file.name,
      bytes,
      contentType: metadata.contentType,
      metadata: (metadata.metadata || {}) as Record<string, string>,
    });
  }
  return backups;
}

async function restoreFiles(bucket: Bucket, backups: FileBackup[]): Promise<void> {
  const prefix = `evidence/${TEB232_UID}/${TEB232_TARGET_CASE_ID}/`;
  const [current] = await bucket.getFiles({ prefix });
  for (const file of current) {
    await file.delete({ ignoreNotFound: true });
  }
  for (const backup of backups) {
    await bucket.file(backup.name).save(backup.bytes, {
      resumable: false,
      contentType: backup.contentType,
      metadata: { metadata: backup.metadata || {} },
    });
  }
}

export async function prepareTeb232TargetCase(params: {
  db: Firestore;
  bucket: Bucket;
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
  targetCaseId: string;
}): Promise<Teb232TargetPrepareResult> {
  if (
    params.authenticatedUid !== TEB232_UID ||
    params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL ||
    params.emailVerified !== true
  ) {
    throw new Error("TEB232_TARGET_PREPARE_IDENTITY_REFUSED");
  }
  if (params.targetCaseId !== TEB232_TARGET_CASE_ID) {
    throw new Error("TEB232_TARGET_CASE_REFUSED");
  }

  const caseRef = params.db.collection("cbam_cases").doc(TEB232_TARGET_CASE_ID);
  const caseSnapshot = await caseRef.get();
  if (!caseSnapshot.exists) throw new Error("TEB232_TARGET_CASE_NOT_FOUND");
  const stored = caseSnapshot.data() || {};
  if (stored.uid !== TEB232_UID) throw new Error("TEB232_TARGET_CASE_OWNER_MISMATCH");

  const reportSnapshot = await params.db
    .collection("cbam_reports")
    .where("caseId", "==", TEB232_TARGET_CASE_ID)
    .limit(1)
    .get();
  if (!reportSnapshot.empty) {
    throw new Error("TEB232_TARGET_CASE_ALREADY_RELEASED");
  }

  if (await currentTargetIsHealthy(params.bucket, stored)) {
    return {
      changed: false,
      caseId: TEB232_TARGET_CASE_ID,
      fixtureKey: TEB232_TARGET_FIXTURE,
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  }

  const prepared = await buildTeb232Case(TEB232_TARGET_FIXTURE);
  const data = clone(prepared.data);
  data.caseId = TEB232_TARGET_CASE_ID;
  data.ownerId = TEB232_UID;
  data.status = "DRAFT";
  data.version = Math.max(1, Number(data.version || 1));
  data.evidenceRegister = data.evidenceRegister.map((record) => ({
    ...record,
    storagePath: `evidence/${TEB232_UID}/${TEB232_TARGET_CASE_ID}/${record.evidenceId}/${record.fileName}`,
    uploader: TEB232_UID,
    reviewEnvironment: "PRODUCTION" as const,
  }));
  data.auditEvents = [
    ...data.auditEvents,
    {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: TEB232_UID,
      action: "CONTROLLED_TEST_TARGET_PREPARED",
      metadata: {
        targetPreparationVersion: TARGET_PREPARATION_VERSION,
        fixtureKey: TEB232_TARGET_FIXTURE,
        syntheticTest: true,
        paymentBypass: false,
      },
    },
  ];

  const evidenceFiles = await buildFourDossierEvidenceFiles(data);
  const parsed = AuditReadyCaseSchema.parse(data);
  const readiness = assessCaseReadiness(parsed);
  if (
    readiness.isEligibleForSealing !== true ||
    readiness.completenessPercentage !== 100 ||
    readiness.criticalBlockers.length !== 0 ||
    readiness.allGaps.length !== 0
  ) {
    throw new Error(
      `TEB232_TARGET_NOT_SEAL_READY:${readiness.completenessPercentage}:${readiness.criticalBlockers.length}:${readiness.allGaps.length}`
    );
  }
  if (
    parsed.evidenceRegister.some(
      (record) =>
        record.reviewStatus !== "APPROVED" ||
        record.supportStatus !== "SUPPORTED" ||
        record.malwareScanStatus !== "CLEAN"
    )
  ) {
    throw new Error("TEB232_TARGET_EVIDENCE_NOT_READY");
  }

  const prefix = `evidence/${TEB232_UID}/${TEB232_TARGET_CASE_ID}/`;
  const fileBackups = await captureFiles(params.bucket, prefix);
  const documentBackup = clone(stored);
  const createdPaths = new Set<string>();

  try {
    for (const binary of evidenceFiles) {
      const record = parsed.evidenceRegister.find(
        (item) => item.evidenceId === binary.evidenceId
      );
      if (!record) throw new Error(`TEB232_TARGET_EVIDENCE_RECORD_MISSING:${binary.evidenceId}`);
      const file = params.bucket.file(record.storagePath);
      await file.save(binary.bytes, {
        resumable: false,
        contentType: record.mimeType,
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
          metadata: {
            ownerId: TEB232_UID,
            caseId: TEB232_TARGET_CASE_ID,
            evidenceId: record.evidenceId,
            sha256: record.fileHash,
            syntheticTest: "true",
            targetPreparationVersion: TARGET_PREPARATION_VERSION,
            fixtureKey: TEB232_TARGET_FIXTURE,
          },
        },
      });
      createdPaths.add(record.storagePath);

      const [readback] = await file.download();
      if (
        readback.byteLength !== record.sizeBytes ||
        sha256(readback) !== record.fileHash
      ) {
        throw new Error(`TEB232_TARGET_EVIDENCE_READBACK_MISMATCH:${record.evidenceId}`);
      }
    }

    const [existingFiles] = await params.bucket.getFiles({ prefix });
    for (const file of existingFiles) {
      if (!createdPaths.has(file.name)) {
        await file.delete({ ignoreNotFound: true });
      }
    }

    const now = new Date().toISOString();
    await caseRef.set({
      caseId: TEB232_TARGET_CASE_ID,
      uid: TEB232_UID,
      data: parsed,
      status: "DRAFT",
      createdAt: stored.createdAt || now,
      updatedAt: now,
      syntheticTest: true,
      syntheticTestTarget: true,
      targetPreparationVersion: TARGET_PREPARATION_VERSION,
      targetFixtureKey: TEB232_TARGET_FIXTURE,
      testOwnerEmail: TEB232_EMAIL,
    });

    const readback = await caseRef.get();
    const readbackData = readback.data() || {};
    const readbackParsed = AuditReadyCaseSchema.parse({
      ...((readbackData.data || {}) as Record<string, unknown>),
      caseId: TEB232_TARGET_CASE_ID,
      ownerId: TEB232_UID,
    });
    const readbackReadiness = assessCaseReadiness(readbackParsed);
    if (
      readbackReadiness.isEligibleForSealing !== true ||
      readbackReadiness.completenessPercentage !== 100 ||
      readbackReadiness.criticalBlockers.length !== 0 ||
      readbackReadiness.allGaps.length !== 0 ||
      !(await evidenceFilesAreValid(params.bucket, readbackParsed))
    ) {
      throw new Error("TEB232_TARGET_POSTWRITE_VERIFICATION_FAILED");
    }

    return {
      changed: true,
      caseId: TEB232_TARGET_CASE_ID,
      fixtureKey: TEB232_TARGET_FIXTURE,
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  } catch (error) {
    await restoreFiles(params.bucket, fileBackups);
    await caseRef.set(documentBackup);
    throw error;
  }
}
