import "server-only";

import { createHash } from "node:crypto";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { AuditReadyCaseSchema } from "../../../functions/src/cbam/schema";
import { assessCaseReadiness } from "../../../functions/src/cbam/validation/readiness-assessor";
import type { FourDossierKey } from "../../../tests/fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_UID,
} from "../../../scripts/refresh-teb232-four-complete-cases";
import {
  TEB232_TARGET_CASE_ID,
} from "./prepare-teb232-target-case";
import { prepareTeb232TargetCaseForSeal } from "./prepare-teb232-target-case-for-seal";
import {
  TEB232_ALL_DRAFTS_PREPARATION_VERSION,
  buildTeb232DraftScenario,
  hasTeb232DraftPreparedMarker,
  inferTeb232FixtureKey,
  assertTeb232CaseId,
} from "./teb232-draft-scenario";

type AdminBucket = ReturnType<typeof getAdminStorageBucket>;
type FileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};

type Identity = {
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
};

export type Teb232DraftPrepareResult = {
  changed: boolean;
  caseId: string;
  fixtureKey: FourDossierKey;
  operatorPreparation: 100;
  evidenceAssurance: 100;
};

export type Teb232AllDraftsPrepareResult = {
  changed: boolean;
  preparedDraftCaseIds: string[];
  alreadyReadyDraftCaseIds: string[];
  skippedNonDraftCaseIds: string[];
  operatorPreparation: 100;
  evidenceAssurance: 100;
};

function assertIdentity(identity: Identity): void {
  if (
    identity.authenticatedUid !== TEB232_UID ||
    identity.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL ||
    identity.emailVerified !== true
  ) {
    throw new Error("TEB232_DRAFT_PREPARE_IDENTITY_REFUSED");
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function evidenceFilesAreValid(
  bucket: AdminBucket,
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

async function currentDraftIsHealthy(
  bucket: AdminBucket,
  caseId: string,
  stored: Record<string, unknown>
): Promise<boolean> {
  if (
    stored.uid !== TEB232_UID ||
    stored.teb232DraftPreparationVersion !== TEB232_ALL_DRAFTS_PREPARATION_VERSION
  ) {
    return false;
  }
  try {
    const parsed = AuditReadyCaseSchema.parse({
      ...((stored.data || {}) as Record<string, unknown>),
      caseId,
      ownerId: TEB232_UID,
    });
    if (!hasTeb232DraftPreparedMarker(parsed)) return false;
    const readiness = assessCaseReadiness(parsed);
    if (
      readiness.isEligibleForSealing !== true ||
      readiness.completenessPercentage !== 100 ||
      readiness.criticalBlockers.length !== 0 ||
      readiness.allGaps.length !== 0
    ) {
      return false;
    }
    return evidenceFilesAreValid(bucket, parsed);
  } catch {
    return false;
  }
}

async function captureFiles(
  bucket: AdminBucket,
  prefix: string
): Promise<FileBackup[]> {
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

async function restoreFiles(
  bucket: AdminBucket,
  prefix: string,
  backups: FileBackup[]
): Promise<void> {
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

async function reportStatuses(caseId: string): Promise<string[]> {
  const snapshot = await adminDb
    .collection("cbam_reports")
    .where("caseId", "==", caseId)
    .get();
  return snapshot.docs.map((doc) => String(doc.data().status || ""));
}

export async function prepareTeb232DraftCaseForSeal(params: Identity & {
  targetCaseId: string;
}): Promise<Teb232DraftPrepareResult> {
  assertIdentity(params);
  assertTeb232CaseId(params.targetCaseId);

  if (params.targetCaseId === TEB232_TARGET_CASE_ID) {
    return prepareTeb232TargetCaseForSeal(params);
  }

  const bucket = getAdminStorageBucket();
  const caseRef = adminDb.collection("cbam_cases").doc(params.targetCaseId);
  const snapshot = await caseRef.get();
  if (!snapshot.exists) throw new Error("TEB232_DRAFT_CASE_NOT_FOUND");
  const stored = (snapshot.data() || {}) as Record<string, unknown>;
  if (stored.uid !== TEB232_UID) {
    throw new Error("TEB232_DRAFT_CASE_OWNER_MISMATCH");
  }

  const storedStatus = String(stored.status || "DRAFT").toUpperCase();
  if (storedStatus !== "DRAFT") {
    throw new Error("TEB232_DRAFT_CASE_NOT_EDITABLE");
  }

  const statuses = await reportStatuses(params.targetCaseId);
  if (statuses.includes("PROCESSING")) {
    throw new Error("TEB232_DRAFT_CASE_SEAL_IN_PROGRESS");
  }

  const fixtureKey = inferTeb232FixtureKey(stored.data);
  if (await currentDraftIsHealthy(bucket, params.targetCaseId, stored)) {
    return {
      changed: false,
      caseId: params.targetCaseId,
      fixtureKey,
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  }

  const previousData = stored.data && typeof stored.data === "object"
    ? stored.data as Record<string, unknown>
    : {};
  const previousVersion = Number(previousData.version || 1);
  const prepared = await buildTeb232DraftScenario({
    caseId: params.targetCaseId,
    fixtureKey,
    version: Number.isFinite(previousVersion) ? previousVersion + 1 : 1,
  });

  const prefix = `evidence/${TEB232_UID}/${params.targetCaseId}/`;
  const fileBackups = await captureFiles(bucket, prefix);
  const documentBackup = clone(stored);
  const createdPaths = new Set<string>();

  try {
    for (const binary of prepared.evidenceFiles) {
      const record = prepared.data.evidenceRegister.find(
        (item) => item.evidenceId === binary.evidenceId
      );
      if (!record) {
        throw new Error(
          `TEB232_DRAFT_EVIDENCE_RECORD_MISSING:${params.targetCaseId}:${binary.evidenceId}`
        );
      }
      const file = bucket.file(record.storagePath);
      await file.save(binary.bytes, {
        resumable: false,
        contentType: record.mimeType,
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
          metadata: {
            ownerId: TEB232_UID,
            caseId: params.targetCaseId,
            evidenceId: record.evidenceId,
            sha256: record.fileHash,
            syntheticTest: "true",
            preparationVersion: TEB232_ALL_DRAFTS_PREPARATION_VERSION,
            fixtureKey,
          },
        },
      });
      createdPaths.add(record.storagePath);

      const [readback] = await file.download();
      const [metadata] = await file.getMetadata();
      if (
        readback.byteLength !== record.sizeBytes ||
        sha256(readback) !== record.fileHash ||
        String(metadata.contentType || "") !== record.mimeType
      ) {
        throw new Error(
          `TEB232_DRAFT_EVIDENCE_READBACK_MISMATCH:${params.targetCaseId}:${record.evidenceId}`
        );
      }
    }

    const [existingFiles] = await bucket.getFiles({ prefix });
    for (const file of existingFiles) {
      if (!createdPaths.has(file.name)) {
        await file.delete({ ignoreNotFound: true });
      }
    }

    const now = new Date().toISOString();
    await caseRef.set({
      caseId: params.targetCaseId,
      uid: TEB232_UID,
      data: prepared.data,
      status: "DRAFT",
      createdAt: stored.createdAt || now,
      updatedAt: now,
      syntheticTest: true,
      teb232DraftPreparationVersion: TEB232_ALL_DRAFTS_PREPARATION_VERSION,
      targetFixtureKey: fixtureKey,
      testOwnerEmail: TEB232_EMAIL,
    });

    const readback = await caseRef.get();
    const readbackStored = (readback.data() || {}) as Record<string, unknown>;
    if (!(await currentDraftIsHealthy(
      bucket,
      params.targetCaseId,
      readbackStored
    ))) {
      throw new Error(
        `TEB232_DRAFT_POSTWRITE_VERIFICATION_FAILED:${params.targetCaseId}`
      );
    }

    return {
      changed: true,
      caseId: params.targetCaseId,
      fixtureKey,
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  } catch (error) {
    await restoreFiles(bucket, prefix, fileBackups);
    await caseRef.set(documentBackup);
    throw error;
  }
}

export async function prepareAllTeb232DraftCasesForSeal(
  params: Identity
): Promise<Teb232AllDraftsPrepareResult> {
  assertIdentity(params);
  const snapshot = await adminDb
    .collection("cbam_cases")
    .where("uid", "==", TEB232_UID)
    .get();

  const preparedDraftCaseIds: string[] = [];
  const alreadyReadyDraftCaseIds: string[] = [];
  const skippedNonDraftCaseIds: string[] = [];

  for (const document of snapshot.docs) {
    const stored = (document.data() || {}) as Record<string, unknown>;
    const caseId = String(stored.caseId || document.id);
    const status = String(stored.status || "DRAFT").toUpperCase();
    if (status !== "DRAFT") {
      skippedNonDraftCaseIds.push(caseId);
      continue;
    }

    const result = await prepareTeb232DraftCaseForSeal({
      ...params,
      targetCaseId: caseId,
    });
    if (result.changed) preparedDraftCaseIds.push(caseId);
    else alreadyReadyDraftCaseIds.push(caseId);
  }

  return {
    changed: preparedDraftCaseIds.length > 0,
    preparedDraftCaseIds,
    alreadyReadyDraftCaseIds,
    skippedNonDraftCaseIds,
    operatorPreparation: 100,
    evidenceAssurance: 100,
  };
}
