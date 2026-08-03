import "server-only";

import crypto, { createHash } from "node:crypto";
import type { Bucket, File } from "@google-cloud/storage";
import type {
  DocumentReference,
  Firestore,
  Query,
} from "firebase-admin/firestore";
import { AuditReadyCaseSchema } from "../../../functions/src/cbam/schema";
import { assessCaseReadiness } from "../../../functions/src/cbam/validation/readiness-assessor";
import {
  FOUR_DOSSIER_KEYS,
  type FourDossierKey,
} from "../../../tests/fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_OLD_CASE_IDS,
  TEB232_REFRESH_SET,
  TEB232_UID,
  buildTeb232Case,
  teb232CaseId,
} from "../../../scripts/refresh-teb232-four-complete-cases";

type JsonRecord = Record<string, unknown>;
type PreparedCase = Awaited<ReturnType<typeof buildTeb232Case>>;
type DocumentBackup = { path: string; data: JsonRecord };
type FileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};
type CleanupState = {
  documents: Map<string, DocumentReference>;
  files: Map<string, File>;
  documentBackups: DocumentBackup[];
  fileBackups: FileBackup[];
};

type CanonicalState = {
  healthy: boolean;
  validKeys: Set<FourDossierKey>;
  invalidReplacementIds: string[];
  oldCaseIdsPresent: string[];
  unexpectedCaseIds: string[];
};

export type Teb232ReconcileResult = {
  changed: boolean;
  caseIds: string[];
  sectors: FourDossierKey[];
  operatorPreparation: 100;
  evidenceAssurance: 100;
};

const LOCK_DOCUMENT = "teb232-four-complete-reconcile-v1";
const LOCK_LEASE_MS = 5 * 60 * 1000;

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyCleanupState(): CleanupState {
  return {
    documents: new Map(),
    files: new Map(),
    documentBackups: [],
    fileBackups: [],
  };
}

async function addQuery(state: CleanupState, query: Query): Promise<void> {
  const snapshot = await query.get();
  for (const document of snapshot.docs) {
    state.documents.set(document.ref.path, document.ref);
  }
}

async function addDocument(
  state: CleanupState,
  reference: DocumentReference
): Promise<void> {
  const snapshot = await reference.get();
  if (snapshot.exists) state.documents.set(reference.path, reference);
}

async function addFiles(
  state: CleanupState,
  bucket: Bucket,
  prefix: string
): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) state.files.set(file.name, file);
}

async function discoverExactCaseState(
  db: Firestore,
  bucket: Bucket,
  caseIds: readonly string[]
): Promise<CleanupState> {
  const state = emptyCleanupState();

  for (const caseId of caseIds) {
    await addDocument(state, db.collection("cbam_cases").doc(caseId));
    await addQuery(state, db.collection("cbam_cases").where("caseId", "==", caseId));
    await addQuery(state, db.collection("cbam_reports").where("caseId", "==", caseId));
    await addQuery(state, db.collection("document_seals").where("caseId", "==", caseId));
    await addQuery(state, db.collection("report_requests").where("caseId", "==", caseId));
    await addFiles(state, bucket, `evidence/${TEB232_UID}/${caseId}/`);
  }

  const reports = [...state.documents.values()].filter(
    (reference) => reference.parent.id === "cbam_reports"
  );
  for (const reportReference of reports) {
    const snapshot = await reportReference.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() || {};
    const reportId = String(data.reportId || reportReference.id);
    const documentHash = String(data.documentHash || "");
    const packageCode = String(data.packageCode || "");
    await addDocument(state, db.collection("seal_log").doc(reportId));
    await addDocument(state, db.collection("seal_outbox").doc(reportId));
    if (documentHash) {
      await addDocument(state, db.collection("document_seals").doc(documentHash));
    }
    if (packageCode) {
      await addDocument(state, db.collection("package_codes").doc(packageCode));
    }
    await addFiles(state, bucket, `reports/${TEB232_UID}/${reportId}/`);
  }

  return state;
}

async function captureState(state: CleanupState): Promise<void> {
  for (const reference of state.documents.values()) {
    const snapshot = await reference.get();
    const data = snapshot.data();
    if (snapshot.exists && data) {
      state.documentBackups.push({
        path: reference.path,
        data: clone(data) as JsonRecord,
      });
    }
  }

  for (const file of state.files.values()) {
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    state.fileBackups.push({
      name: file.name,
      bytes,
      contentType: metadata.contentType,
      metadata: (metadata.metadata || {}) as Record<string, string>,
    });
  }
}

async function deleteState(db: Firestore, state: CleanupState): Promise<void> {
  for (const file of state.files.values()) {
    await file.delete({ ignoreNotFound: true });
  }

  const references = [...state.documents.values()];
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = db.batch();
    for (const reference of references.slice(offset, offset + 400)) {
      batch.delete(reference);
    }
    await batch.commit();
  }
}

async function restoreState(
  db: Firestore,
  bucket: Bucket,
  state: CleanupState
): Promise<void> {
  for (const item of state.fileBackups) {
    await bucket.file(item.name).save(item.bytes, {
      resumable: false,
      contentType: item.contentType,
      metadata: { metadata: item.metadata || {} },
    });
  }

  for (let offset = 0; offset < state.documentBackups.length; offset += 400) {
    const batch = db.batch();
    for (const item of state.documentBackups.slice(offset, offset + 400)) {
      batch.set(db.doc(item.path), item.data);
    }
    await batch.commit();
  }
}

async function uploadEvidence(
  bucket: Bucket,
  prepared: PreparedCase,
  createdFiles: Set<string>
): Promise<void> {
  for (const evidence of prepared.evidenceFiles) {
    const record = prepared.data.evidenceRegister.find(
      (item) => item.evidenceId === evidence.evidenceId
    );
    if (!record) {
      throw new Error(
        `EVIDENCE_RECORD_MISSING:${prepared.key}:${evidence.evidenceId}`
      );
    }

    const file = bucket.file(record.storagePath);
    await file.save(evidence.bytes, {
      resumable: false,
      contentType: record.mimeType,
      metadata: {
        cacheControl: "private, max-age=0, no-transform",
        metadata: {
          ownerId: TEB232_UID,
          caseId: prepared.data.caseId || "",
          evidenceId: record.evidenceId,
          sha256: record.fileHash,
          syntheticTest: "true",
          refreshSet: TEB232_REFRESH_SET,
          sectorKey: prepared.key,
        },
      },
    });
    createdFiles.add(record.storagePath);

    const [readback] = await file.download();
    const [metadata] = await file.getMetadata();
    if (
      readback.byteLength !== record.sizeBytes ||
      sha256(readback) !== record.fileHash ||
      String(metadata.contentType || "") !== record.mimeType
    ) {
      throw new Error(
        `EVIDENCE_READBACK_MISMATCH:${prepared.key}:${record.evidenceId}`
      );
    }
  }
}

async function writeCase(
  db: Firestore,
  prepared: PreparedCase,
  createdDocuments: Set<string>
): Promise<void> {
  const now = new Date().toISOString();
  const caseId = prepared.data.caseId;
  if (!caseId) throw new Error(`CASE_ID_MISSING:${prepared.key}`);

  const reference = db.collection("cbam_cases").doc(caseId);
  await reference.set({
    caseId,
    uid: TEB232_UID,
    data: prepared.data,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    syntheticTest: true,
    refreshSet: TEB232_REFRESH_SET,
    sectorKey: prepared.key,
    testOwnerEmail: TEB232_EMAIL,
  });
  createdDocuments.add(reference.path);
}

async function cleanupCreated(
  db: Firestore,
  bucket: Bucket,
  documents: Set<string>,
  files: Set<string>
): Promise<void> {
  for (const name of files) {
    await bucket.file(name).delete({ ignoreNotFound: true });
  }
  const references = [...documents].map((path) => db.doc(path));
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = db.batch();
    for (const reference of references.slice(offset, offset + 400)) {
      batch.delete(reference);
    }
    await batch.commit();
  }
}

async function evidenceObjectsAreValid(
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

async function replacementCaseIsValid(
  db: Firestore,
  bucket: Bucket,
  key: FourDossierKey
): Promise<boolean> {
  const caseId = teb232CaseId(key);
  const snapshot = await db.collection("cbam_cases").doc(caseId).get();
  if (!snapshot.exists) return false;
  const stored = snapshot.data() || {};
  if (
    stored.uid !== TEB232_UID ||
    stored.refreshSet !== TEB232_REFRESH_SET ||
    stored.sectorKey !== key
  ) {
    return false;
  }

  try {
    const parsed = AuditReadyCaseSchema.parse({
      ...(stored.data || {}),
      caseId,
      ownerId: TEB232_UID,
    });
    const readiness = assessCaseReadiness(parsed);
    if (
      !readiness.isEligibleForSealing ||
      readiness.completenessPercentage !== 100 ||
      readiness.criticalBlockers.length !== 0 ||
      readiness.allGaps.length !== 0
    ) {
      return false;
    }
    return evidenceObjectsAreValid(bucket, parsed);
  } catch {
    return false;
  }
}

export async function inspectTeb232CanonicalState(
  db: Firestore,
  bucket: Bucket
): Promise<CanonicalState> {
  const validKeys = new Set<FourDossierKey>();
  const invalidReplacementIds: string[] = [];
  for (const key of FOUR_DOSSIER_KEYS) {
    if (await replacementCaseIsValid(db, bucket, key)) {
      validKeys.add(key);
    } else {
      invalidReplacementIds.push(teb232CaseId(key));
    }
  }

  const oldCaseIdsPresent: string[] = [];
  for (const oldCaseId of TEB232_OLD_CASE_IDS) {
    const snapshot = await db.collection("cbam_cases").doc(oldCaseId).get();
    if (snapshot.exists) oldCaseIdsPresent.push(oldCaseId);
  }

  const allOwned = await db.collection("cbam_cases").where("uid", "==", TEB232_UID).get();
  const allowedIds = new Set([
    ...TEB232_OLD_CASE_IDS,
    ...FOUR_DOSSIER_KEYS.map(teb232CaseId),
  ]);
  const unexpectedCaseIds = allOwned.docs
    .map((document) => String(document.data().caseId || document.id))
    .filter((caseId) => !allowedIds.has(caseId));

  return {
    healthy:
      validKeys.size === FOUR_DOSSIER_KEYS.length &&
      oldCaseIdsPresent.length === 0 &&
      unexpectedCaseIds.length === 0 &&
      allOwned.size === FOUR_DOSSIER_KEYS.length,
    validKeys,
    invalidReplacementIds,
    oldCaseIdsPresent,
    unexpectedCaseIds,
  };
}

async function acquireLock(db: Firestore): Promise<string> {
  const owner = crypto.randomUUID();
  const reference = db.collection("system").doc(LOCK_DOCUMENT);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() || {};
    const leaseUntilMs = Number(data.leaseUntilMs || 0);
    if (data.state === "RUNNING" && leaseUntilMs > now) {
      throw new Error("TEB232_RECONCILE_IN_PROGRESS");
    }
    transaction.set(
      reference,
      {
        state: "RUNNING",
        owner,
        startedAt: new Date(now).toISOString(),
        leaseUntilMs: now + LOCK_LEASE_MS,
      },
      { merge: true }
    );
  });
  return owner;
}

async function releaseLock(
  db: Firestore,
  owner: string,
  state: "PASS" | "FAILED",
  error?: unknown
): Promise<void> {
  const reference = db.collection("system").doc(LOCK_DOCUMENT);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.data()?.owner !== owner) return;
    transaction.set(
      reference,
      {
        state,
        finishedAt: new Date().toISOString(),
        leaseUntilMs: 0,
        ...(error
          ? {
              error:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : String(error).slice(0, 500),
            }
          : { error: null }),
      },
      { merge: true }
    );
  });
}

export async function reconcileTeb232Cases(params: {
  db: Firestore;
  bucket: Bucket;
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
}): Promise<Teb232ReconcileResult> {
  if (
    params.authenticatedUid !== TEB232_UID ||
    params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL ||
    params.emailVerified !== true
  ) {
    throw new Error("TEB232_RECONCILE_IDENTITY_REFUSED");
  }

  const before = await inspectTeb232CanonicalState(params.db, params.bucket);
  if (before.healthy) {
    return {
      changed: false,
      caseIds: FOUR_DOSSIER_KEYS.map(teb232CaseId),
      sectors: [...FOUR_DOSSIER_KEYS],
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  }
  if (before.unexpectedCaseIds.length > 0) {
    throw new Error(
      `TEB232_UNEXPECTED_CASES:${before.unexpectedCaseIds.join(",")}`
    );
  }

  const lockOwner = await acquireLock(params.db);
  let cleanupState = emptyCleanupState();
  const createdDocuments = new Set<string>();
  const createdFiles = new Set<string>();

  try {
    const lockedState = await inspectTeb232CanonicalState(params.db, params.bucket);
    if (lockedState.healthy) {
      await releaseLock(params.db, lockOwner, "PASS");
      return {
        changed: false,
        caseIds: FOUR_DOSSIER_KEYS.map(teb232CaseId),
        sectors: [...FOUR_DOSSIER_KEYS],
        operatorPreparation: 100,
        evidenceAssurance: 100,
      };
    }
    if (lockedState.unexpectedCaseIds.length > 0) {
      throw new Error(
        `TEB232_UNEXPECTED_CASES:${lockedState.unexpectedCaseIds.join(",")}`
      );
    }

    const invalidKeys = FOUR_DOSSIER_KEYS.filter(
      (key) => !lockedState.validKeys.has(key)
    );
    const prepared = await Promise.all(invalidKeys.map(buildTeb232Case));
    const cleanupIds = [
      ...lockedState.oldCaseIdsPresent,
      ...lockedState.invalidReplacementIds,
    ];

    cleanupState = await discoverExactCaseState(
      params.db,
      params.bucket,
      cleanupIds
    );
    await captureState(cleanupState);
    await deleteState(params.db, cleanupState);

    for (const item of prepared) {
      await uploadEvidence(params.bucket, item, createdFiles);
      await writeCase(params.db, item, createdDocuments);
    }

    const after = await inspectTeb232CanonicalState(params.db, params.bucket);
    if (!after.healthy) {
      throw new Error(
        `TEB232_FINAL_STATE_INVALID:valid=${after.validKeys.size}:old=${after.oldCaseIdsPresent.length}:unexpected=${after.unexpectedCaseIds.length}`
      );
    }

    await releaseLock(params.db, lockOwner, "PASS");
    return {
      changed: true,
      caseIds: FOUR_DOSSIER_KEYS.map(teb232CaseId),
      sectors: [...FOUR_DOSSIER_KEYS],
      operatorPreparation: 100,
      evidenceAssurance: 100,
    };
  } catch (error) {
    await cleanupCreated(
      params.db,
      params.bucket,
      createdDocuments,
      createdFiles
    );
    await restoreState(params.db, params.bucket, cleanupState);
    await releaseLock(params.db, lockOwner, "FAILED", error);
    throw error;
  }
}
