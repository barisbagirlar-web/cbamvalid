#!/usr/bin/env npx tsx
/**
 * Replace the four known synthetic QA dossiers in the isolated sandbox with
 * fresh current-engine Release 1 packages.
 *
 * Safety contract:
 *  - production project cbam-desk is always refused
 *  - hosted execution is allowed only for cbam-desk-sandbox
 *  - default mode is dry-run; destructive replacement requires --apply
 *  - old Firestore documents and Storage bytes are backed up before deletion
 *  - if the replacement fails, newly written data is removed and the backup is
 *    restored before the script exits non-zero
 *
 * Hosted sandbox:
 *   FIREBASE_PROJECT=cbam-desk-sandbox \
 *     npx tsx scripts/refresh-four-complete-dossiers.ts --apply
 *
 * Local emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
 *     npx tsx scripts/refresh-four-complete-dossiers.ts --emulator --apply
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 } from "../functions/src/cbam/report/package-components";
import {
  FOUR_DOSSIER_KEYS,
  type FourDossierKey,
} from "../tests/fixtures/four-dossiers";
import {
  DOSSIER_PRODUCT_CODE,
  DOSSIER_RELEASE_CONTRACT_VERSION,
  DOSSIER_RELEASE_VERSION,
  FOUR_DOSSIER_FIXTURE_SET,
  buildDossierSealedPackage,
  dossierPackageCode,
  dossierReportId,
  legacyDossierReportId,
} from "../tests/fixtures/four-dossier-package";

const SANDBOX_PROJECT = "cbam-desk-sandbox";
const PRODUCTION_PROJECT = "cbam-desk";
const apply = process.argv.includes("--apply");
const emulator = process.argv.includes("--emulator");

type JsonRecord = Record<string, unknown>;
type StoredDocumentBackup = { path: string; data: JsonRecord };
type StoredFileBackup = {
  name: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};

type CleanupState = {
  documents: Map<string, admin.firestore.DocumentReference>;
  files: Map<string, admin.storage.File>;
  documentBackups: StoredDocumentBackup[];
  fileBackups: StoredFileBackup[];
};

function resolveProjectId(): string {
  const configured = String(process.env.FIREBASE_PROJECT || "").trim();
  if (configured === PRODUCTION_PROJECT) {
    throw new Error("REFUSED_PRODUCTION_PROJECT: synthetic QA data may not be refreshed in cbam-desk");
  }
  if (emulator) return configured || SANDBOX_PROJECT;
  if (!configured) {
    throw new Error("FIREBASE_PROJECT_REQUIRED: set FIREBASE_PROJECT=cbam-desk-sandbox");
  }
  if (configured !== SANDBOX_PROJECT) {
    throw new Error(`REFUSED_NON_SANDBOX_PROJECT:${configured}`);
  }
  return configured;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function asPlainRecord(value: unknown): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function deterministicUuid(key: FourDossierKey): string {
  const raw = sha256(`${FOUR_DOSSIER_FIXTURE_SET}\u0000REQUEST\u0000${key}`).slice(0, 32).split("");
  raw[12] = "4";
  raw[16] = "8";
  const hex = raw.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeBackupPath(objectName: string): string {
  return objectName
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_"))
    .join(path.sep);
}

async function addQueryDocuments(
  state: CleanupState,
  query: admin.firestore.Query
): Promise<void> {
  const snapshot = await query.get();
  for (const document of snapshot.docs) {
    state.documents.set(document.ref.path, document.ref);
  }
}

async function addDocumentIfExists(
  state: CleanupState,
  ref: admin.firestore.DocumentReference
): Promise<void> {
  const snapshot = await ref.get();
  if (snapshot.exists) state.documents.set(ref.path, ref);
}

async function addFilesByPrefix(
  state: CleanupState,
  bucket: admin.storage.Bucket,
  prefix: string
): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) state.files.set(file.name, file);
}

async function discoverCleanupState(
  db: admin.firestore.Firestore,
  bucket: admin.storage.Bucket,
  packages: Awaited<ReturnType<typeof buildDossierSealedPackage>>[]
): Promise<CleanupState> {
  const state: CleanupState = {
    documents: new Map(),
    files: new Map(),
    documentBackups: [],
    fileBackups: [],
  };

  for (const pkg of packages) {
    const caseId = pkg.caseData.caseId!;
    const ownerId = pkg.caseData.ownerId!;
    const currentReportId = dossierReportId(pkg.key);
    const legacyReportId = legacyDossierReportId(pkg.key);

    await addDocumentIfExists(state, db.collection("cbam_cases").doc(caseId));
    await addQueryDocuments(state, db.collection("cbam_cases").where("caseId", "==", caseId));
    await addQueryDocuments(state, db.collection("cbam_reports").where("caseId", "==", caseId));
    await addQueryDocuments(state, db.collection("document_seals").where("caseId", "==", caseId));
    await addQueryDocuments(state, db.collection("report_requests").where("caseId", "==", caseId));

    await addDocumentIfExists(state, db.collection("cbam_reports").doc(currentReportId));
    await addDocumentIfExists(state, db.collection("cbam_reports").doc(legacyReportId));

    await addFilesByPrefix(state, bucket, `evidence/${ownerId}/${caseId}/`);
  }

  // Reports discovered by caseId provide the authoritative old report IDs,
  // hashes, package codes and owner paths needed for bounded cleanup.
  const reportDocuments = [...state.documents.values()].filter((ref) => ref.parent.id === "cbam_reports");
  for (const reportRef of reportDocuments) {
    const reportSnapshot = await reportRef.get();
    if (!reportSnapshot.exists) continue;
    const data = reportSnapshot.data() || {};
    const reportId = String(data.reportId || reportRef.id);
    const uid = String(data.uid || "");
    const documentHash = String(data.documentHash || "");
    const packageCode = String(data.packageCode || "");

    await addDocumentIfExists(state, db.collection("seal_log").doc(reportId));
    await addDocumentIfExists(state, db.collection("seal_outbox").doc(reportId));
    if (documentHash) await addDocumentIfExists(state, db.collection("document_seals").doc(documentHash));
    if (packageCode) await addDocumentIfExists(state, db.collection("package_codes").doc(packageCode));
    if (uid) await addFilesByPrefix(state, bucket, `reports/${uid}/${reportId}/`);
  }

  return state;
}

async function backupCleanupState(
  state: CleanupState,
  backupRoot: string
): Promise<void> {
  fs.mkdirSync(backupRoot, { recursive: true });

  for (const ref of state.documents.values()) {
    const snapshot = await ref.get();
    if (!snapshot.exists) continue;
    state.documentBackups.push({ path: ref.path, data: asPlainRecord(snapshot.data()) });
  }

  for (const file of state.files.values()) {
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    const customMetadata = (metadata.metadata || {}) as Record<string, string>;
    state.fileBackups.push({
      name: file.name,
      bytes,
      contentType: metadata.contentType,
      metadata: customMetadata,
    });
    const target = path.join(backupRoot, "storage", safeBackupPath(file.name));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }

  fs.writeFileSync(
    path.join(backupRoot, "firestore.json"),
    `${JSON.stringify(state.documentBackups, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(backupRoot, "storage-index.json"),
    `${JSON.stringify(
      state.fileBackups.map((item) => ({
        name: item.name,
        sizeBytes: item.bytes.byteLength,
        sha256: sha256(item.bytes),
        contentType: item.contentType || null,
        metadata: item.metadata || {},
      })),
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function deleteDocuments(state: CleanupState): Promise<void> {
  const refs = [...state.documents.values()];
  for (let index = 0; index < refs.length; index += 400) {
    const batch = refs[index].firestore.batch();
    for (const ref of refs.slice(index, index + 400)) batch.delete(ref);
    await batch.commit();
  }
}

async function deleteFiles(state: CleanupState): Promise<void> {
  for (const file of state.files.values()) {
    await file.delete({ ignoreNotFound: true });
  }
}

async function restoreCleanupState(
  db: admin.firestore.Firestore,
  bucket: admin.storage.Bucket,
  state: CleanupState
): Promise<void> {
  for (const backup of state.fileBackups) {
    await bucket.file(backup.name).save(backup.bytes, {
      resumable: false,
      contentType: backup.contentType,
      metadata: { metadata: backup.metadata || {} },
    });
  }
  for (let index = 0; index < state.documentBackups.length; index += 400) {
    const batch = db.batch();
    for (const backup of state.documentBackups.slice(index, index + 400)) {
      batch.set(db.doc(backup.path), backup.data);
    }
    await batch.commit();
  }
}

async function uploadVerified(
  bucket: admin.storage.Bucket,
  objectPath: string,
  bytes: Buffer,
  contentType: string,
  metadata: Record<string, string>
): Promise<{ path: string; sha256: string; sizeBytes: number }> {
  const expectedHash = sha256(bytes);
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
      metadata: { ...metadata, sha256: expectedHash },
    },
  });
  const [readBack] = await file.download();
  if (readBack.byteLength !== bytes.byteLength || sha256(readBack) !== expectedHash) {
    throw new Error(`STORAGE_READBACK_MISMATCH:${objectPath}`);
  }
  return { path: objectPath, sha256: expectedHash, sizeBytes: bytes.byteLength };
}

async function writeFreshPackage(
  db: admin.firestore.Firestore,
  bucket: admin.storage.Bucket,
  pkg: Awaited<ReturnType<typeof buildDossierSealedPackage>>,
  createdDocumentPaths: Set<string>,
  createdFilePaths: Set<string>
): Promise<void> {
  const parsedCase = AuditReadyCaseSchema.parse(pkg.caseData);
  const caseId = parsedCase.caseId!;
  const uid = parsedCase.ownerId!;
  const reportId = dossierReportId(pkg.key);
  const packageCode = dossierPackageCode(pkg.key);
  const generatedAt = String(pkg.manifestResult.manifest.generatedAt);
  const requestId = deterministicUuid(pkg.key);
  const entitlementId = `sandbox-entitlement-${pkg.key.toLowerCase()}`;
  const signature = JSON.parse(pkg.finalized.signatureBytes.toString("utf8")) as {
    manifestHash: string;
    signatureBase64: string;
    keyVersion: string;
    algorithm: string;
  };
  const manifest = pkg.manifestResult.manifest;
  const snapshotBytes = Buffer.from(canonical(parsedCase), "utf8");
  const caseDataHash = sha256(snapshotBytes);

  if (!/^report_[a-f0-9]{64}$/.test(reportId)) throw new Error(`REPORT_ID_INVALID:${reportId}`);
  if (manifest.schemaVersion !== "CBAMVALID-DOSSIER-5.0") throw new Error(`MANIFEST_SCHEMA_INVALID:${pkg.key}`);
  if (manifest.releaseVersion !== DOSSIER_RELEASE_VERSION) throw new Error(`RELEASE_VERSION_INVALID:${pkg.key}`);
  if (manifest.componentContract.requiredCount !== REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5) {
    throw new Error(`COMPONENT_COUNT_INVALID:${pkg.key}`);
  }

  for (const evidence of pkg.evidenceFiles) {
    const record = parsedCase.evidenceRegister.find((item) => item.evidenceId === evidence.evidenceId);
    if (!record) throw new Error(`EVIDENCE_RECORD_MISSING:${evidence.evidenceId}`);
    await uploadVerified(bucket, record.storagePath, evidence.bytes, record.mimeType, {
      qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
      qaSectorKey: pkg.key,
      ownerId: uid,
      caseId,
      evidenceId: evidence.evidenceId,
    });
    createdFilePaths.add(record.storagePath);
  }

  const basePath = `reports/${uid}/${reportId}`;
  const commonMetadata = {
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
    qaSectorKey: pkg.key,
    reportId,
    caseId,
  };
  const storageEntries = await Promise.all([
    uploadVerified(bucket, `${basePath}/dossier.zip`, pkg.finalized.zip, "application/zip", commonMetadata),
    uploadVerified(bucket, `${basePath}/dossier.pdf`, pkg.finalized.primaryPdf, "application/pdf", commonMetadata),
    uploadVerified(bucket, `${basePath}/dossier.xlsx`, pkg.finalized.workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", commonMetadata),
    uploadVerified(bucket, `${basePath}/manifest.json`, Buffer.from(pkg.manifestResult.bytes), "application/json", commonMetadata),
    uploadVerified(bucket, `${basePath}/manifest.sig`, pkg.finalized.signatureBytes, "application/vnd.cbamvalid.kms-signature+json", commonMetadata),
    uploadVerified(bucket, `${basePath}/case-snapshot.json`, snapshotBytes, "application/json", commonMetadata),
  ]);
  for (const entry of storageEntries) createdFilePaths.add(entry.path);

  if (storageEntries[0].sha256 !== pkg.finalized.zipHash) {
    throw new Error(`PACKAGE_HASH_MISMATCH:${pkg.key}`);
  }

  const storage = Object.fromEntries(
    storageEntries.map((entry) => [path.posix.basename(entry.path), entry])
  );
  const packageMetadata = {
    schemaVersion: manifest.schemaVersion,
    requiredTopLevelComponentCount: REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
    actualTopLevelComponentCount: REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
    manifestFileCount: manifest.files.length,
    evidenceFileCount: pkg.evidenceFiles.length,
    primaryDossierFileName: "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf",
    technicalCompilationFileName: "Complete Dossier Compilation.pdf",
    operatorEmissionsReportFileName: "Operator Emissions Report.pdf",
  };
  const reportRecord: JsonRecord = {
    reportId,
    packageCode,
    uid,
    caseId,
    entitlementId,
    requestId,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    documentHash: signature.manifestHash,
    manifestHash: signature.manifestHash,
    packageHash: pkg.finalized.zipHash,
    status: "SEALED",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    calculation: asPlainRecord(pkg.calculation),
    caseDataHash,
    rulesetVersion: String(pkg.calculation.ruleset),
    sourceHash: manifest.legalSourceRegistryHash,
    kmsKeyVersion: signature.keyVersion,
    kmsAlgorithm: signature.algorithm,
    signatureBase64: signature.signatureBase64,
    storage,
    packageTopLevelComponentCount: REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
    automatedReadiness: "OPERATOR_PREPARATION_COMPLETE",
    operatorReadinessStatus: "OPERATOR_PREPARATION_COMPLETE",
    independentVerifierStatus: "NOT_REVIEWED",
    verificationMaterialityRate: 0.05,
    installationName: String(parsedCase.installation.name.value),
    dossierSchemaVersion: "CBAMVALID-DOSSIER-5.0",
    packageMetadata,
    productCode: DOSSIER_PRODUCT_CODE,
    releaseContractVersion: DOSSIER_RELEASE_CONTRACT_VERSION,
    publicVerificationState: "ACTIVE",
    isCurrentRelease: true,
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
    qaSectorKey: pkg.key,
    syntheticData: true,
  };

  const requestDigest = sha256(`${FOUR_DOSSIER_FIXTURE_SET}\u0000${pkg.key}\u0000${requestId}`);
  const casePayload = asPlainRecord({
    ...parsedCase,
    uid,
    latestReleaseId: reportId,
    latestPackageCode: packageCode,
    latestReleaseVersion: DOSSIER_RELEASE_VERSION,
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
    qaSectorKey: pkg.key,
    syntheticData: true,
    updatedAt: generatedAt,
  });

  const refs = {
    case: db.collection("cbam_cases").doc(caseId),
    report: db.collection("cbam_reports").doc(reportId),
    seal: db.collection("document_seals").doc(signature.manifestHash),
    request: db.collection("report_requests").doc(requestDigest),
    sealLog: db.collection("seal_log").doc(reportId),
    packageCode: db.collection("package_codes").doc(packageCode),
  };
  const batch = db.batch();
  batch.set(refs.case, casePayload);
  batch.set(refs.report, reportRecord);
  batch.set(refs.seal, {
    valid: true,
    documentHash: signature.manifestHash,
    reportId,
    packageCode,
    caseId,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    issuedAt: generatedAt,
    manifestHash: signature.manifestHash,
    packageHash: pkg.finalized.zipHash,
    signatureBase64: signature.signatureBase64,
    kmsKeyVersion: signature.keyVersion,
    kmsAlgorithm: signature.algorithm,
    commercialStatus: "SANDBOX_ACTIVE",
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
    qaSectorKey: pkg.key,
    syntheticData: true,
  });
  batch.set(refs.request, {
    uid,
    caseId,
    entitlementId,
    requestId,
    reportId,
    inputHash: caseDataHash,
    status: "COMPLETED",
    generatedAt,
    updatedAt: generatedAt,
    packageCode,
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
  });
  batch.set(refs.sealLog, {
    state: "SEAL_ACTIVATED",
    timestamp: generatedAt,
    documentHash: signature.manifestHash,
    packageHash: pkg.finalized.zipHash,
    packageCode,
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
  });
  batch.set(refs.packageCode, {
    packageCode,
    reportId,
    uid,
    digest: requestDigest,
    createdAt: generatedAt,
    qaFixtureSet: FOUR_DOSSIER_FIXTURE_SET,
  });
  await batch.commit();
  for (const ref of Object.values(refs)) createdDocumentPaths.add(ref.path);

  const [caseReadback, reportReadback, sealReadback] = await Promise.all([
    refs.case.get(),
    refs.report.get(),
    refs.seal.get(),
  ]);
  if (!caseReadback.exists || caseReadback.data()?.latestReleaseId !== reportId) {
    throw new Error(`CASE_READBACK_FAILED:${pkg.key}`);
  }
  if (!reportReadback.exists || reportReadback.data()?.packageHash !== pkg.finalized.zipHash) {
    throw new Error(`REPORT_READBACK_FAILED:${pkg.key}`);
  }
  if (!sealReadback.exists || sealReadback.data()?.valid !== true) {
    throw new Error(`SEAL_READBACK_FAILED:${pkg.key}`);
  }
}

async function removeCreatedState(
  db: admin.firestore.Firestore,
  bucket: admin.storage.Bucket,
  documentPaths: Set<string>,
  filePaths: Set<string>
): Promise<void> {
  for (const filePath of filePaths) {
    await bucket.file(filePath).delete({ ignoreNotFound: true });
  }
  const refs = [...documentPaths].map((documentPath) => db.doc(documentPath));
  for (let index = 0; index < refs.length; index += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(index, index + 400)) batch.delete(ref);
    await batch.commit();
  }
}

async function verifyFreshState(
  db: admin.firestore.Firestore,
  packages: Awaited<ReturnType<typeof buildDossierSealedPackage>>[]
): Promise<void> {
  for (const pkg of packages) {
    const caseId = pkg.caseData.caseId!;
    const reportId = dossierReportId(pkg.key);
    const reports = await db.collection("cbam_reports").where("caseId", "==", caseId).get();
    const seals = await db.collection("document_seals").where("caseId", "==", caseId).get();
    if (reports.size !== 1 || reports.docs[0].id !== reportId) {
      throw new Error(`REPORT_CARDINALITY_FAILED:${pkg.key}:${reports.size}`);
    }
    if (seals.size !== 1 || seals.docs[0].data().reportId !== reportId) {
      throw new Error(`SEAL_CARDINALITY_FAILED:${pkg.key}:${seals.size}`);
    }
    const legacy = await db.collection("cbam_reports").doc(legacyDossierReportId(pkg.key)).get();
    if (legacy.exists) throw new Error(`LEGACY_REPORT_STILL_PRESENT:${pkg.key}`);
  }
}

async function main(): Promise<void> {
  const projectId = resolveProjectId();
  if (admin.apps.length === 0) admin.initializeApp({ projectId });
  const db = admin.firestore();
  if (emulator) {
    const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    const [hostname, port] = host.split(":");
    db.settings({ host: hostname, port: Number(port || 8080), ssl: false });
  }
  const bucket = admin.storage().bucket();

  console.log(`FOUR_DOSSIER_REFRESH_PROJECT=${projectId}`);
  console.log(`FOUR_DOSSIER_REFRESH_MODE=${apply ? "APPLY" : "DRY_RUN"}`);
  console.log(`FOUR_DOSSIER_FIXTURE_SET=${FOUR_DOSSIER_FIXTURE_SET}`);

  // Build and validate all four new packages before touching persisted data.
  const packages = [] as Awaited<ReturnType<typeof buildDossierSealedPackage>>[];
  for (const key of FOUR_DOSSIER_KEYS) {
    const pkg = await buildDossierSealedPackage(key);
    AuditReadyCaseSchema.parse(pkg.caseData);
    if (pkg.manifestResult.manifest.componentContract.requiredCount !== REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5) {
      throw new Error(`PREBUILD_COMPONENT_CONTRACT_FAILED:${key}`);
    }
    packages.push(pkg);
    console.log(
      `PREBUILT ${key}: report=${dossierReportId(key)} release=${DOSSIER_RELEASE_VERSION} ` +
      `components=${pkg.manifestResult.manifest.componentContract.requiredCount} zip=${pkg.finalized.zipHash}`
    );
  }

  const cleanup = await discoverCleanupState(db, bucket, packages);
  console.log(`OLD_DOCUMENTS=${cleanup.documents.size}`);
  console.log(`OLD_STORAGE_OBJECTS=${cleanup.files.size}`);

  if (!apply) {
    console.log("REFRESH_STATUS=DRY_RUN");
    console.log("No data changed. Re-run with --apply after reviewing the counts above.");
    return;
  }

  const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.resolve(
    process.cwd(),
    "artifacts",
    "four-complete-dossiers",
    "refresh-backup",
    backupStamp
  );
  await backupCleanupState(cleanup, backupRoot);
  console.log(`BACKUP_PATH=${backupRoot}`);

  const createdDocumentPaths = new Set<string>();
  const createdFilePaths = new Set<string>();
  try {
    await deleteFiles(cleanup);
    await deleteDocuments(cleanup);
    for (const pkg of packages) {
      await writeFreshPackage(db, bucket, pkg, createdDocumentPaths, createdFilePaths);
      console.log(`REFRESHED ${pkg.key}: ${dossierReportId(pkg.key)}`);
    }
    await verifyFreshState(db, packages);
    console.log("FOUR_DOSSIER_REFRESH=PASS");
  } catch (error) {
    console.error("FOUR_DOSSIER_REFRESH=FAILED");
    console.error(error);
    try {
      await removeCreatedState(db, bucket, createdDocumentPaths, createdFilePaths);
      await restoreCleanupState(db, bucket, cleanup);
      console.error("ROLLBACK=RESTORED_PREVIOUS_SYNTHETIC_STATE");
    } catch (rollbackError) {
      console.error("ROLLBACK=FAILED");
      console.error(rollbackError);
    }
    process.exitCode = 1;
  }
}

void main();
