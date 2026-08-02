#!/usr/bin/env npx tsx
/**
 * Replace the four known Teb232 synthetic/demo working files with four current,
 * complete and seal-ready sector cases. Payment and Paddle are out of scope.
 *
 * Safety:
 * - exact production project, email and UID allowlist
 * - exact old-case allowlist; no broad user-data deletion
 * - dry-run by default; EXECUTE=1 required
 * - all four replacement cases and evidence files are built and validated
 *   before any persisted state is changed
 * - local Firestore/Storage backup plus rollback on failure
 *
 * Dry run:
 *   npx tsx scripts/refresh-teb232-four-complete-cases.ts
 * Apply:
 *   EXECUTE=1 npx tsx scripts/refresh-teb232-four-complete-cases.ts
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import admin from "firebase-admin";
import type { Bucket, File } from "@google-cloud/storage";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../functions/src/cbam/schema";
import { assessCaseReadiness } from "../functions/src/cbam/validation/readiness-assessor";
import {
  FOUR_DOSSIER_KEYS,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
  type FourDossierKey,
} from "../tests/fixtures/four-dossiers";

export const TEB232_PROJECT = "cbam-desk";
export const TEB232_EMAIL = "teb232@gmail.com";
export const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
export const TEB232_REFRESH_SET = "TEB232_FOUR_COMPLETE_V1";

/** Exact four obsolete test working files approved for replacement. */
export const TEB232_OLD_CASE_IDS = Object.freeze([
  "case_518dbf061368d391bfe1f1b6010c9cab37fe1eb8d7321505f667ab396649e9b0",
  "case_4aa949246b04cd9dc0353b93530a50281fde4491531cc4ac1607cf8a90f6ee37",
  "case_ad8cd2d4c03ce3e4ce5b1f3c5c74902583398dc70260097a35b86685beca21eb",
  "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd",
]);

const EXECUTE = process.env.EXECUTE === "1";

type JsonRecord = Record<string, unknown>;
type EvidenceFile = Awaited<ReturnType<typeof buildFourDossierEvidenceFiles>>[number];
type PreparedCase = {
  key: FourDossierKey;
  data: AuditReadyCase;
  evidenceFiles: EvidenceFile[];
};
type DocumentBackup = { path: string; data: JsonRecord };
type FileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};
type CleanupState = {
  documents: Map<string, admin.firestore.DocumentReference>;
  files: Map<string, File>;
  documentBackups: DocumentBackup[];
  fileBackups: FileBackup[];
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readEnvLocal(): Record<string, string> {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

export function teb232CaseId(key: FourDossierKey): string {
  return `case_${sha256(`${TEB232_UID}\u0000${TEB232_REFRESH_SET}\u0000${key}`)}`;
}

function replaceVisibleTestLanguage(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/sandbox fixture/gi, "controlled test record")
      .replace(/sandbox/gi, "controlled test")
      .replace(/fixture/gi, "test record")
      .replace(/stress/gi, "test")
      .replace(/synthetic controlled record/gi, "controlled test evidence record");
  }
  if (Array.isArray(value)) return value.map(replaceVisibleTestLanguage);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [key, replaceVisibleTestLanguage(item)])
    );
  }
  return value;
}

export async function buildTeb232Case(key: FourDossierKey): Promise<PreparedCase> {
  const source = createFourDossierCase(key);
  const caseId = teb232CaseId(key);
  const data = replaceVisibleTestLanguage(clone(source)) as AuditReadyCase;
  data.caseId = caseId;
  data.ownerId = TEB232_UID;
  data.status = "DRAFT";
  data.version = Math.max(1, Number(data.version || 1));

  data.evidenceRegister = data.evidenceRegister.map((record) => ({
    ...record,
    storagePath: `evidence/${TEB232_UID}/${caseId}/${record.evidenceId}/${record.fileName}`,
    uploader: TEB232_UID,
  }));
  data.auditEvents = [
    ...data.auditEvents.filter((event) => event.action !== "FIXTURE_SEEDED"),
    {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: TEB232_UID,
      action: "CONTROLLED_TEST_CASE_PREPARED",
      metadata: {
        refreshSet: TEB232_REFRESH_SET,
        sectorKey: key,
        syntheticTest: true,
        paymentBypass: false,
      },
    },
  ];

  const evidenceFiles = await buildFourDossierEvidenceFiles(data);
  const parsed = AuditReadyCaseSchema.parse(data);
  const readiness = assessCaseReadiness(parsed);
  if (!readiness.isEligibleForSealing) {
    throw new Error(
      `CASE_NOT_SEAL_READY:${key}:` +
      readiness.criticalBlockers.map((gap) => gap.requiredEvidence).join("|")
    );
  }
  if (readiness.completenessPercentage !== 100) {
    throw new Error(`CASE_NOT_100_PERCENT:${key}:${readiness.completenessPercentage}`);
  }
  if (parsed.evidenceRegister.some((record) =>
    record.reviewStatus !== "APPROVED" ||
    record.supportStatus !== "SUPPORTED" ||
    record.malwareScanStatus !== "CLEAN"
  )) {
    throw new Error(`EVIDENCE_NOT_APPROVED_SUPPORTED_CLEAN:${key}`);
  }
  return { key, data: parsed, evidenceFiles };
}

async function addQuery(
  state: CleanupState,
  query: admin.firestore.Query
): Promise<void> {
  const snapshot = await query.get();
  for (const doc of snapshot.docs) state.documents.set(doc.ref.path, doc.ref);
}

async function addDoc(
  state: CleanupState,
  ref: admin.firestore.DocumentReference
): Promise<void> {
  const snapshot = await ref.get();
  if (snapshot.exists) state.documents.set(ref.path, ref);
}

async function addFiles(state: CleanupState, bucket: Bucket, prefix: string): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) state.files.set(file.name, file);
}

async function discoverOldState(
  db: admin.firestore.Firestore,
  bucket: Bucket
): Promise<CleanupState> {
  const state: CleanupState = {
    documents: new Map(),
    files: new Map(),
    documentBackups: [],
    fileBackups: [],
  };

  for (const caseId of TEB232_OLD_CASE_IDS) {
    await addDoc(state, db.collection("cbam_cases").doc(caseId));
    await addQuery(state, db.collection("cbam_cases").where("caseId", "==", caseId));
    await addQuery(state, db.collection("cbam_reports").where("caseId", "==", caseId));
    await addQuery(state, db.collection("document_seals").where("caseId", "==", caseId));
    await addQuery(state, db.collection("report_requests").where("caseId", "==", caseId));
    await addFiles(state, bucket, `evidence/${TEB232_UID}/${caseId}/`);
  }

  const reports = [...state.documents.values()].filter((ref) => ref.parent.id === "cbam_reports");
  for (const reportRef of reports) {
    const snapshot = await reportRef.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() || {};
    const reportId = String(data.reportId || reportRef.id);
    const documentHash = String(data.documentHash || "");
    const packageCode = String(data.packageCode || "");
    await addDoc(state, db.collection("seal_log").doc(reportId));
    await addDoc(state, db.collection("seal_outbox").doc(reportId));
    if (documentHash) await addDoc(state, db.collection("document_seals").doc(documentHash));
    if (packageCode) await addDoc(state, db.collection("package_codes").doc(packageCode));
    await addFiles(state, bucket, `reports/${TEB232_UID}/${reportId}/`);
  }
  return state;
}

async function backupState(state: CleanupState, root: string): Promise<void> {
  mkdirSync(root, { recursive: true });
  for (const ref of state.documents.values()) {
    const snapshot = await ref.get();
    if (snapshot.exists) state.documentBackups.push({ path: ref.path, data: clone(snapshot.data()) });
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
  writeFileSync(
    path.join(root, "firestore.json"),
    `${JSON.stringify(state.documentBackups, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(
    path.join(root, "storage-index.json"),
    `${JSON.stringify(state.fileBackups.map((item) => ({
      name: item.name,
      sizeBytes: item.bytes.byteLength,
      sha256: sha256(item.bytes),
      contentType: item.contentType || null,
      metadata: item.metadata || {},
    })), null, 2)}\n`,
    "utf8"
  );
  for (const item of state.fileBackups) {
    const target = path.join(root, "storage", ...item.name.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, item.bytes);
  }
}

async function deleteOldState(db: admin.firestore.Firestore, state: CleanupState): Promise<void> {
  for (const file of state.files.values()) await file.delete({ ignoreNotFound: true });
  const refs = [...state.documents.values()];
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function restoreOldState(
  db: admin.firestore.Firestore,
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
    state.documentBackups.slice(offset, offset + 400).forEach((item) =>
      batch.set(db.doc(item.path), item.data)
    );
    await batch.commit();
  }
}

async function uploadEvidence(
  bucket: Bucket,
  prepared: PreparedCase,
  createdFiles: Set<string>
): Promise<void> {
  for (const evidence of prepared.evidenceFiles) {
    const record = prepared.data.evidenceRegister.find((item) => item.evidenceId === evidence.evidenceId);
    if (!record) throw new Error(`EVIDENCE_RECORD_MISSING:${prepared.key}:${evidence.evidenceId}`);
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
    ) throw new Error(`EVIDENCE_READBACK_MISMATCH:${prepared.key}:${record.evidenceId}`);
  }
}

async function writeCase(
  db: admin.firestore.Firestore,
  prepared: PreparedCase,
  createdDocs: Set<string>
): Promise<void> {
  const now = new Date().toISOString();
  const caseId = prepared.data.caseId!;
  const ref = db.collection("cbam_cases").doc(caseId);
  await ref.set({
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
  createdDocs.add(ref.path);
  const readback = await ref.get();
  if (!readback.exists) throw new Error(`CASE_READBACK_MISSING:${prepared.key}`);
  const parsed = AuditReadyCaseSchema.parse({
    ...(readback.data()?.data || {}),
    caseId,
    ownerId: TEB232_UID,
  });
  const readiness = assessCaseReadiness(parsed);
  if (!readiness.isEligibleForSealing || readiness.completenessPercentage !== 100) {
    throw new Error(`CASE_READBACK_NOT_READY:${prepared.key}`);
  }
}

async function cleanupCreated(
  db: admin.firestore.Firestore,
  bucket: Bucket,
  docs: Set<string>,
  files: Set<string>
): Promise<void> {
  for (const name of files) await bucket.file(name).delete({ ignoreNotFound: true });
  const refs = [...docs].map((item) => db.doc(item));
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function verifyFinal(db: admin.firestore.Firestore): Promise<void> {
  for (const oldCaseId of TEB232_OLD_CASE_IDS) {
    const old = await db.collection("cbam_cases").doc(oldCaseId).get();
    if (old.exists) throw new Error(`OLD_CASE_STILL_PRESENT:${oldCaseId}`);
    const oldReports = await db.collection("cbam_reports").where("caseId", "==", oldCaseId).get();
    const oldSeals = await db.collection("document_seals").where("caseId", "==", oldCaseId).get();
    if (!oldReports.empty || !oldSeals.empty) throw new Error(`OLD_RELEASE_STATE_STILL_PRESENT:${oldCaseId}`);
  }
  const current = await db.collection("cbam_cases")
    .where("uid", "==", TEB232_UID)
    .where("refreshSet", "==", TEB232_REFRESH_SET)
    .get();
  if (current.size !== FOUR_DOSSIER_KEYS.length) {
    throw new Error(`CURRENT_CASE_CARDINALITY:${current.size}`);
  }
  const sectors = new Set(current.docs.map((doc) => String(doc.data().sectorKey || "")));
  for (const key of FOUR_DOSSIER_KEYS) if (!sectors.has(key)) throw new Error(`SECTOR_MISSING:${key}`);
}

export async function main(): Promise<void> {
  const project = String(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || TEB232_PROJECT);
  if (project !== TEB232_PROJECT) throw new Error(`REFUSED_PROJECT:${project}`);
  const env = readEnvLocal();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_MISSING");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: TEB232_PROJECT,
      storageBucket: bucketName,
    });
  }
  const auth = admin.auth();
  const db = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const user = await auth.getUserByEmail(TEB232_EMAIL);
  if (user.uid !== TEB232_UID || user.emailVerified !== true) {
    throw new Error(`TEST_USER_IDENTITY_MISMATCH:${user.uid}:${user.emailVerified}`);
  }

  const prepared = await Promise.all(FOUR_DOSSIER_KEYS.map(buildTeb232Case));
  for (const item of prepared) {
    console.log(`PREBUILT ${item.key}: case=${item.data.caseId} evidence=${item.evidenceFiles.length} readiness=100`);
  }
  const oldState = await discoverOldState(db, bucket);
  console.log(`PROJECT=${TEB232_PROJECT}`);
  console.log(`TEST_USER=${TEB232_EMAIL}`);
  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);
  console.log(`OLD_CASE_ALLOWLIST=${TEB232_OLD_CASE_IDS.length}`);
  console.log(`OLD_DOCUMENTS=${oldState.documents.size}`);
  console.log(`OLD_STORAGE_OBJECTS=${oldState.files.size}`);
  if (!EXECUTE) {
    console.log("TEB232_FOUR_CASE_REFRESH=DRY_RUN_PASS");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.resolve(process.cwd(), "artifacts", "teb232-four-complete", "backup", stamp);
  await backupState(oldState, backupRoot);
  console.log(`BACKUP_PATH=${backupRoot}`);

  const createdDocs = new Set<string>();
  const createdFiles = new Set<string>();
  try {
    await deleteOldState(db, oldState);
    for (const item of prepared) {
      await uploadEvidence(bucket, item, createdFiles);
      await writeCase(db, item, createdDocs);
      console.log(`CREATED ${item.key}: ${item.data.caseId}`);
    }
    await verifyFinal(db);
    console.log("TEB232_FOUR_CASE_REFRESH=PASS");
    console.log("STEP_1_TO_7=COMPLETE");
    console.log("OPERATOR_PREPARATION=100");
    console.log("EVIDENCE_ASSURANCE=100");
    console.log("PAYMENT_OR_ENTERPRISE_LOCK=NOT_APPLICABLE_FOR_TEST_ADMIN");
  } catch (error) {
    console.error("TEB232_FOUR_CASE_REFRESH=FAILED", error);
    await cleanupCreated(db, bucket, createdDocs, createdFiles);
    await restoreOldState(db, bucket, oldState);
    console.error("ROLLBACK=RESTORED_OLD_TEST_STATE");
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
