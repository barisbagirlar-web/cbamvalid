#!/usr/bin/env npx tsx
/**
 * teb232 test hesabını temizleyip 2 farklı sektör senaryosunu mühürlenmeye
 * hazır olarak kurar (STEEL_IN + CEMENT_EG).
 *
 * Adımlar:
 *  1. Canlıdaki TÜM teb232 verisi keşfedilir: cbam_cases, cbam_reports,
 *     document_seals, report_requests, seal_log, seal_outbox, package_codes
 *     ve Storage (evidence/ + reports/) — yedeklenir.
 *  2. Yedek alındıktan sonra hepsi silinir.
 *  3. İki kanonik senaryo (teb232CaseId(key)) yedekten bağımsız sıfırdan
 *     kurulur: evidence dosyaları Storage'a, case Firestore'a.
 *  4. Kurulan iki case için okuma-doğrulama: AuditReadyCaseSchema parse,
 *     assessCaseReadiness %100 ve evidence okuma-back hash eşleşmesi.
 *
 * Güvenlik:
 *  - proje/email/uid allowlist (yalnızca cbam-desk / teb232@gmail.com)
 *  - varsayılan DRY_RUN; EXECUTE=1 ile uygulanır
 *  - tüm silme işleminden ÖNCE yerel yedek (artifacts/teb232-reset/backup/<stamp>/)
 *  - başarısızlıkta: yeni kurulanlar silinir, eski yedek geri yüklenir
 *
 * Kullanım:
 *   npx tsx scripts/reset-teb232-two-scenarios.ts          # dry-run
 *   EXECUTE=1 npx tsx scripts/reset-teb232-two-scenarios.ts
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
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
  type FourDossierKey,
} from "../tests/fixtures/four-dossiers";
import {
  TEB232_PROJECT,
  TEB232_EMAIL,
  TEB232_UID,
  TEB232_REFRESH_SET,
  teb232CaseId,
} from "./refresh-teb232-four-complete-cases";

// I1: mevcut scripti değiştirmiyoruz; yalnızca sabitleri ve yardımcıları import
// ediyoruz. replaceVisibleTestLanguage refresh scriptinde export değil, burada
// aynı dönüşümü yerel olarak yeniden üretiyoruz.
// (kept below)
function replaceVisibleTestLanguage(value: unknown): unknown {
  if (typeof value === "string") {
    if (value === "SANDBOX" || value === "PRODUCTION") return value;
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
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceVisibleTestLanguage(item)])
    );
  }
  return value;
}

const KEYS: readonly FourDossierKey[] = ["STEEL_IN", "CEMENT_EG"];
const EXECUTE = process.env.EXECUTE === "1";

type JsonRecord = Record<string, unknown>;
type EvidenceFile = Awaited<ReturnType<typeof buildFourDossierEvidenceFiles>>[number];
type PreparedCase = { key: FourDossierKey; data: AuditReadyCase; evidenceFiles: EvidenceFile[] };
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

async function addQuery(state: CleanupState, query: admin.firestore.Query): Promise<void> {
  const snapshot = await query.get();
  for (const doc of snapshot.docs) state.documents.set(doc.ref.path, doc.ref);
}
async function addDoc(state: CleanupState, ref: admin.firestore.DocumentReference): Promise<void> {
  const snapshot = await ref.get();
  if (snapshot.exists) state.documents.set(ref.path, ref);
}
async function addFiles(state: CleanupState, bucket: Bucket, prefix: string): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) state.files.set(file.name, file);
}

async function discoverAllUserState(
  db: admin.firestore.Firestore,
  bucket: Bucket
): Promise<CleanupState> {
  const state: CleanupState = {
    documents: new Map(),
    files: new Map(),
    documentBackups: [],
    fileBackups: [],
  };

  const owned = await db.collection("cbam_cases").where("uid", "==", TEB232_UID).get();
  for (const doc of owned.docs) {
    const data = doc.data() || {};
    const caseId = String(data.caseId || doc.id);
    await addDoc(state, db.collection("cbam_cases").doc(doc.id));
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

  // Kullanıcıya bağlı ama caseId ilişkisi olmayan kalıntılar (ör. eski
  // entitlement/ledger dokümanları) da kapsanır.
  await addQuery(state, db.collection("seal_log").where("ownerId", "==", TEB232_UID).limit(500));
  await addQuery(state, db.collection("seal_outbox").where("ownerId", "==", TEB232_UID).limit(500));
  await addQuery(state, db.collection("package_codes").where("ownerId", "==", TEB232_UID).limit(500));
  await addFiles(state, bucket, `reports/${TEB232_UID}/`);
  await addFiles(state, bucket, `evidence/${TEB232_UID}/`);

  return state;
}

async function backupState(state: CleanupState, root: string): Promise<void> {
  mkdirSync(root, { recursive: true });
  for (const ref of state.documents.values()) {
    const snapshot = await ref.get();
    const data = snapshot.data();
    if (snapshot.exists && data) {
      state.documentBackups.push({ path: ref.path, data: clone(data) as JsonRecord });
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

async function deleteState(db: admin.firestore.Firestore, state: CleanupState): Promise<void> {
  for (const file of state.files.values()) await file.delete({ ignoreNotFound: true });
  const refs = [...state.documents.values()];
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function restoreState(
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

export async function buildTeb232Scenario(key: FourDossierKey): Promise<PreparedCase> {
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
    reviewEnvironment: "PRODUCTION" as const,
  }));
  data.methodologyDecisions = data.methodologyDecisions.map((decision) => ({
    ...decision,
    decisionEnvironment: "PRODUCTION" as const,
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
  if (!readiness.isEligibleForSealing || readiness.completenessPercentage !== 100) {
    throw new Error(
      `CASE_NOT_SEAL_READY:${key}:${readiness.completenessPercentage}:` +
      readiness.criticalBlockers.map((gap) => gap.requiredEvidence).join("|")
    );
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

async function verifyFinal(
  db: admin.firestore.Firestore,
  bucket: Bucket
): Promise<void> {
  const owned = await db.collection("cbam_cases").where("uid", "==", TEB232_UID).get();
  if (owned.size !== KEYS.length) {
    throw new Error(`CURRENT_CASE_CARDINALITY:${owned.size}`);
  }
  for (const key of KEYS) {
    const caseId = teb232CaseId(key);
    const snapshot = await db.collection("cbam_cases").doc(caseId).get();
    if (!snapshot.exists) throw new Error(`CASE_MISSING:${key}`);
    const stored = snapshot.data() || {};
    if (stored.uid !== TEB232_UID || stored.refreshSet !== TEB232_REFRESH_SET || stored.sectorKey !== key) {
      throw new Error(`CASE_METADATA_MISMATCH:${key}`);
    }
    const parsed = AuditReadyCaseSchema.parse({
      ...(stored.data || {}),
      caseId,
      ownerId: TEB232_UID,
    });
    const readiness = assessCaseReadiness(parsed);
    if (!readiness.isEligibleForSealing || readiness.completenessPercentage !== 100) {
      throw new Error(`CASE_READBACK_NOT_READY:${key}:${readiness.completenessPercentage}`);
    }
    for (const record of parsed.evidenceRegister) {
      const file = bucket.file(record.storagePath);
      const [exists] = await file.exists();
      if (!exists) throw new Error(`EVIDENCE_OBJECT_MISSING:${key}:${record.evidenceId}`);
      const [bytes] = await file.download();
      const [metadata] = await file.getMetadata();
      if (
        bytes.byteLength !== record.sizeBytes ||
        sha256(bytes) !== record.fileHash ||
        String(metadata.contentType || "") !== record.mimeType
      ) {
        throw new Error(`EVIDENCE_READBACK_MISMATCH:${key}:${record.evidenceId}`);
      }
    }
    console.log(`VERIFIED ${key}: ${caseId} readiness=100 evidence=${parsed.evidenceRegister.length}`);
  }
}

export async function main(): Promise<void> {
  const project = String(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || TEB232_PROJECT);
  if (project !== TEB232_PROJECT) throw new Error(`REFUSED_PROJECT:${project}`);

  const env: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
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

  const prepared = await Promise.all(KEYS.map(buildTeb232Scenario));
  for (const item of prepared) {
    console.log(`PREBUILT ${item.key}: case=${item.data.caseId} evidence=${item.evidenceFiles.length} readiness=100`);
  }

  const existingState = await discoverAllUserState(db, bucket);
  console.log(`PROJECT=${TEB232_PROJECT}`);
  console.log(`TEST_USER=${TEB232_EMAIL}`);
  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);
  console.log(`EXISTING_DOCUMENTS=${existingState.documents.size}`);
  console.log(`EXISTING_STORAGE_OBJECTS=${existingState.files.size}`);
  console.log(`TARGET_SCENARIOS=${KEYS.join(",")}`);

  if (!EXECUTE) {
    console.log("TEB232_RESET_TWO_SCENARIOS=DRY_RUN_PASS");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.resolve(process.cwd(), "artifacts", "teb232-reset", "backup", stamp);
  await backupState(existingState, backupRoot);
  console.log(`BACKUP_PATH=${backupRoot}`);

  const createdDocs = new Set<string>();
  const createdFiles = new Set<string>();
  try {
    await deleteState(db, existingState);
    console.log(`DELETED_DOCUMENTS=${existingState.documents.size}`);
    console.log(`DELETED_STORAGE_OBJECTS=${existingState.files.size}`);
    for (const item of prepared) {
      await uploadEvidence(bucket, item, createdFiles);
      await writeCase(db, item, createdDocs);
      console.log(`CREATED ${item.key}: ${item.data.caseId}`);
    }
    await verifyFinal(db, bucket);
    console.log("TEB232_RESET_TWO_SCENARIOS=PASS");
    console.log("OPERATOR_PREPARATION=100");
    console.log("EVIDENCE_ASSURANCE=100");
    console.log("SEAL_READY_SCENARIOS=STEEL_IN,CEMENT_EG");
  } catch (error) {
    console.error("TEB232_RESET_TWO_SCENARIOS=FAILED", error);
    await cleanupCreated(db, bucket, createdDocs, createdFiles);
    await restoreState(db, bucket, existingState);
    console.error("ROLLBACK=RESTORED_PRE_RESET_STATE");
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
