import crypto from "node:crypto";
import { adminDb, getStorageBucket } from "../../firebase-admin";
import { reserveEntitlement, consumeEntitlement, releaseEntitlementReservation } from "../../commerce/entitlement-service";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../schema";
import { performDossierCalculations } from "../calculator";
import { runQualityControls } from "../validation/quality-controls";
import { assessCaseReadiness } from "../validation/readiness-assessor";
import { getActiveRuleset } from "../registry/rulesets";
import { assertKmsSigningConfigured, signManifestWithKms } from "./kms-signature";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type EvidenceBinary,
} from "./verifier-package-builder";

export type SealState =
  | "SEAL_REQUESTED"
  | "ENTITLEMENT_RESERVED"
  | "QC_VALIDATED"
  | "DATA_FROZEN"
  | "CALCULATION_COMPLETE"
  | "ARTIFACTS_GENERATED"
  | "KMS_SIGNED"
  | "ARTIFACTS_COMMITTED"
  | "ENTITLEMENT_CONSUMED"
  | "SEAL_ACTIVATED"
  | "FAILED";

export interface SealingResult {
  reportId: string;
  releaseVersion: number;
  documentHash: string;
  manifestHash: string;
  packageHash: string;
  status: "SEALED";
}

type SealRequestMarker = {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  reportId: string;
  inputHash: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  leaseOwner: string;
  leaseExpiresAt: string;
  generatedAt: string;
  updatedAt: string;
  error?: string;
};

type SealedReportRecord = SealingResult & {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  createdAt: string;
  updatedAt: string;
  calculation: ReturnType<typeof performDossierCalculations>;
  caseDataHash: string;
  rulesetVersion: string;
  sourceHash: string;
  kmsKeyVersion: string;
  kmsAlgorithm: string;
  signatureBase64: string;
  storage: Record<string, { path: string; sha256: string; sizeBytes: number }>;
};

function sha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function assertRequestId(requestId: string): string {
  const normalized = requestId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error("SEAL_REQUEST_ID_INVALID");
  }
  return normalized;
}

function deriveSealIdentity(params: { uid: string; caseId: string; entitlementId: string; requestId: string }) {
  const requestId = assertRequestId(params.requestId);
  const digest = sha256(`${params.uid}\u0000${params.caseId}\u0000${params.entitlementId}\u0000${requestId}`);
  return { requestId, digest, reportId: `report_${digest}` };
}

function resultFromReport(data: unknown): SealingResult {
  if (!data || typeof data !== "object") throw new Error("SEALED_REPORT_RECORD_INVALID");
  const source = data as Partial<SealedReportRecord>;
  if (
    source.status !== "SEALED" ||
    typeof source.reportId !== "string" ||
    typeof source.releaseVersion !== "number" ||
    typeof source.documentHash !== "string" ||
    typeof source.manifestHash !== "string" ||
    typeof source.packageHash !== "string"
  ) throw new Error("SEALED_REPORT_RECORD_INVALID");
  return {
    reportId: source.reportId,
    releaseVersion: source.releaseVersion,
    documentHash: source.documentHash,
    manifestHash: source.manifestHash,
    packageHash: source.packageHash,
    status: "SEALED",
  };
}

async function acquireSealLease(params: {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  inputHash: string;
}) {
  const identity = deriveSealIdentity(params);
  const leaseOwner = crypto.randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const markerRef = adminDb.collection("report_requests").doc(identity.digest);
  const reportRef = adminDb.collection("cbam_reports").doc(identity.reportId);

  return adminDb.runTransaction(async (transaction) => {
    const [markerSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(markerRef),
      transaction.get(reportRef),
    ]);
    if (reportSnapshot.exists) return { identity, leaseOwner: "", generatedAt: "", existing: resultFromReport(reportSnapshot.data()) };
    if (markerSnapshot.exists) {
      const marker = markerSnapshot.data() as Partial<SealRequestMarker>;
      if (marker.uid !== params.uid || marker.caseId !== params.caseId || marker.entitlementId !== params.entitlementId || marker.requestId !== identity.requestId) {
        throw new Error("SEAL_REQUEST_ID_COLLISION");
      }
      if (marker.inputHash !== params.inputHash) throw new Error("SEAL_REQUEST_INPUT_CHANGED");
      if (marker.status === "COMPLETED") throw new Error("SEAL_COMPLETED_REPORT_MISSING");
      const leaseActive = marker.status === "IN_PROGRESS" && typeof marker.leaseExpiresAt === "string" && new Date(marker.leaseExpiresAt).getTime() > now.getTime();
      if (leaseActive) throw new Error("SEAL_REQUEST_IN_PROGRESS");
      transaction.update(markerRef, {
        status: "IN_PROGRESS",
        leaseOwner,
        leaseExpiresAt,
        updatedAt: now.toISOString(),
        error: null,
      });
      return { identity, leaseOwner, generatedAt: String(marker.generatedAt || now.toISOString()), existing: null };
    }

    const marker: SealRequestMarker = {
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: identity.requestId,
      reportId: identity.reportId,
      inputHash: params.inputHash,
      status: "IN_PROGRESS",
      leaseOwner,
      leaseExpiresAt,
      generatedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    transaction.create(markerRef, marker);
    transaction.create(reportRef, {
      reportId: identity.reportId,
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: identity.requestId,
      status: "STAGING",
      createdAt: marker.generatedAt,
      updatedAt: marker.generatedAt,
    });
    return { identity, leaseOwner, generatedAt: marker.generatedAt, existing: null };
  });
}

async function setState(reportId: string, state: SealState, metadata: Record<string, unknown> = {}): Promise<void> {
  await adminDb.collection("seal_log").doc(reportId).set({
    state,
    timestamp: new Date().toISOString(),
    ...metadata,
  }, { merge: true });
}

function safeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
  return normalized || "evidence.bin";
}

async function loadEvidenceFiles(caseData: AuditReadyCase, uid: string, caseId: string): Promise<EvidenceBinary[]> {
  const evidenceFiles: EvidenceBinary[] = [];
  for (const evidence of caseData.evidenceRegister) {
    if (evidence.reviewStatus !== "APPROVED" || evidence.malwareScanStatus !== "CLEAN") {
      throw new Error(`EVIDENCE_NOT_APPROVED_OR_CLEAN:${evidence.evidenceId}`);
    }
    const expectedPrefix = `evidence/${uid}/${caseId}/${evidence.evidenceId}/`;
    if (!evidence.storagePath.startsWith(expectedPrefix)) throw new Error("EVIDENCE_STORAGE_PATH_OWNERSHIP_MISMATCH");
    const file = getStorageBucket().file(evidence.storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`EVIDENCE_FILE_NOT_FOUND:${evidence.evidenceId}`);
    const [metadata] = await file.getMetadata();
    if (
      Number(metadata.size) !== evidence.sizeBytes ||
      metadata.contentType !== evidence.mimeType ||
      metadata.metadata.ownerId !== uid ||
      metadata.metadata.caseId !== caseId ||
      metadata.metadata.evidenceId !== evidence.evidenceId ||
      metadata.metadata.sha256?.toLowerCase() !== evidence.fileHash.toLowerCase()
    ) throw new Error(`EVIDENCE_STORAGE_METADATA_MISMATCH:${evidence.evidenceId}`);
    const [bytes] = await file.download();
    if (bytes.byteLength !== evidence.sizeBytes || sha256(bytes) !== evidence.fileHash.toLowerCase()) {
      throw new Error(`EVIDENCE_FILE_INTEGRITY_MISMATCH:${evidence.evidenceId}`);
    }
    evidenceFiles.push({ evidenceId: evidence.evidenceId, fileName: safeFileName(evidence.fileName), bytes });
  }
  return evidenceFiles;
}

async function commitImmutableArtifact(params: {
  path: string;
  bytes: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}) {
  const file = getStorageBucket().file(params.path);
  const digest = sha256(params.bytes);
  await file.save(params.bytes, {
    resumable: false,
    validation: "crc32c",
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType: params.contentType,
      cacheControl: "private, no-store, max-age=0",
      metadata: { ...params.metadata, sha256: digest },
    },
  });
  const [metadata] = await file.getMetadata();
  const [stored] = await file.download();
  if (Number(metadata.size) !== params.bytes.byteLength || metadata.metadata.sha256 !== digest || !stored.equals(params.bytes) || sha256(stored) !== digest) {
    throw new Error(`IMMUTABLE_ARTIFACT_VERIFY_FAILED:${params.path}`);
  }
  return { path: params.path, sha256: digest, sizeBytes: params.bytes.byteLength };
}

async function resolveCaseDocumentId(caseId: string): Promise<string> {
  const canonical = await adminDb.collection("cbam_cases").doc(caseId).get();
  if (canonical.exists) return canonical.id;
  const legacy = await adminDb.collection("cbam_cases").where("caseId", "==", caseId).limit(2).get();
  if (legacy.empty) throw new Error("CASE_NOT_FOUND");
  if (legacy.docs.length !== 1) throw new Error("CASE_ID_COLLISION");
  return legacy.docs[0].id;
}

async function markFailed(params: { digest: string; reportId: string; leaseOwner: string; error: unknown }) {
  const message = params.error instanceof Error ? params.error.message : "SEALING_FAILED";
  try {
    await adminDb.runTransaction(async (transaction) => {
      const markerRef = adminDb.collection("report_requests").doc(params.digest);
      const reportRef = adminDb.collection("cbam_reports").doc(params.reportId);
      const markerSnapshot = await transaction.get(markerRef);
      if (markerSnapshot.exists && markerSnapshot.data()?.leaseOwner === params.leaseOwner) {
        transaction.update(markerRef, { status: "FAILED", error: message, updatedAt: new Date().toISOString(), leaseExpiresAt: new Date().toISOString() });
      }
      const reportSnapshot = await transaction.get(reportRef);
      if (reportSnapshot.exists && reportSnapshot.data()?.status !== "SEALED") transaction.update(reportRef, { status: "FAILED", error: message, updatedAt: new Date().toISOString() });
    });
    await setState(params.reportId, "FAILED", { error: message });
  } catch (markError) {
    console.error("[SEALING] Failure state persistence failed", markError);
  }
}

export async function sealReport(params: {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  inputData: AuditReadyCase;
  correctionReason?: string;
}): Promise<SealingResult> {
  assertKmsSigningConfigured();
  const caseData = AuditReadyCaseSchema.parse({ ...params.inputData, caseId: params.caseId, ownerId: params.uid });
  const caseDataHash = sha256(canonical(caseData));
  const lease = await acquireSealLease({ ...params, inputHash: caseDataHash });
  if (lease.existing) return lease.existing;
  const { identity, leaseOwner } = lease;
  let reserved = false;

  try {
    await setState(identity.reportId, "SEAL_REQUESTED", { caseDataHash });
    const reservation = await adminDb.runTransaction((transaction) => reserveEntitlement(transaction, {
      entitlementId: params.entitlementId,
      uid: params.uid,
      reportId: identity.reportId,
      caseId: params.caseId,
      expiresInSeconds: 20 * 60,
    }));
    reserved = true;
    const releaseVersion = reservation.releasesCount + 1;
    if (releaseVersion > 1 && !params.correctionReason?.trim()) throw new Error("CORRECTION_REASON_REQUIRED");
    await setState(identity.reportId, "ENTITLEMENT_RESERVED", { releaseVersion });

    const controls = runQualityControls(caseData);
    const readiness = assessCaseReadiness(caseData);
    const blockers = controls.filter((item) => item.status === "BLOCKER");
    if (blockers.length > 0 || !readiness.ready) {
      throw new Error(`SEAL_BLOCKED:${[...blockers.map((item) => item.ruleId), ...readiness.blockerCodes].join(",")}`);
    }
    await setState(identity.reportId, "QC_VALIDATED", { qualityControlCount: controls.length });

    const rulesetYear = Number(caseData.reportingPeriod.year.value);
    if (!Number.isInteger(rulesetYear) || rulesetYear < 2026) throw new Error("DEFINITIVE_REPORTING_YEAR_INVALID");
    const ruleset = getActiveRuleset(new Date(Date.UTC(rulesetYear, 0, 1)));
    if (ruleset.period !== "DEFINITIVE") throw new Error("TRANSITIONAL_RULESET_CANNOT_SEAL");

    const evidenceFiles = await loadEvidenceFiles(caseData, params.uid, params.caseId);
    const frozenJson = Buffer.from(canonical(caseData), "utf8");
    await setState(identity.reportId, "DATA_FROZEN", { evidenceCount: evidenceFiles.length });

    const calculation = performDossierCalculations(caseData);
    if (calculation.totalEmbeddedEmissions === "NOT_CALCULATED" || calculation.specificEmbeddedEmissions === "NOT_CALCULATED") {
      throw new Error("CALCULATION_INCOMPLETE");
    }
    if (calculation.allocationReconciliationDelta === "NOT_CALCULATED" || Number(calculation.allocationReconciliationDelta) > 0.000001) {
      throw new Error("GOODS_ALLOCATION_NOT_RECONCILED");
    }
    await setState(identity.reportId, "CALCULATION_COMPLETE", { calculationRootHash: calculation.calculationRootHash });

    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: identity.reportId,
      releaseVersion,
      generatedAt: lease.generatedAt,
      evidenceFiles,
    });
    const manifest = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: identity.reportId,
      releaseVersion,
      generatedAt: lease.generatedAt,
      evidenceCount: evidenceFiles.length,
    });
    await setState(identity.reportId, "ARTIFACTS_GENERATED", { manifestFiles: manifest.manifest.files.length });

    const signature = await signManifestWithKms(manifest.bytes);
    await setState(identity.reportId, "KMS_SIGNED", { manifestHash: signature.manifestHash, keyVersion: signature.keyVersion });
    const packageResult = await finalizeVerifierPackage({ artifacts, manifestBytes: manifest.bytes, signature, generatedAt: lease.generatedAt });

    const basePath = `reports/${params.uid}/${identity.reportId}`;
    const commonMetadata = { reportId: identity.reportId, caseId: params.caseId, requestId: identity.requestId };
    const storageEntries = await Promise.all([
      commitImmutableArtifact({ path: `${basePath}/dossier.zip`, bytes: packageResult.zip, contentType: "application/zip", metadata: commonMetadata }),
      commitImmutableArtifact({ path: `${basePath}/dossier.pdf`, bytes: packageResult.primaryPdf, contentType: "application/pdf", metadata: commonMetadata }),
      commitImmutableArtifact({ path: `${basePath}/dossier.xlsx`, bytes: packageResult.workbook, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", metadata: commonMetadata }),
      commitImmutableArtifact({ path: `${basePath}/manifest.json`, bytes: manifest.bytes, contentType: "application/json", metadata: commonMetadata }),
      commitImmutableArtifact({ path: `${basePath}/manifest.sig`, bytes: packageResult.signatureBytes, contentType: "application/vnd.cbamvalid.kms-signature+json", metadata: commonMetadata }),
      commitImmutableArtifact({ path: `${basePath}/case-snapshot.json`, bytes: frozenJson, contentType: "application/json", metadata: commonMetadata }),
    ]);
    await setState(identity.reportId, "ARTIFACTS_COMMITTED", { packageHash: packageResult.zipHash });

    const documentHash = signature.manifestHash;
    const caseDocumentId = await resolveCaseDocumentId(params.caseId);
    const reportRecord: SealedReportRecord = {
      reportId: identity.reportId,
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: identity.requestId,
      releaseVersion,
      documentHash,
      manifestHash: signature.manifestHash,
      packageHash: packageResult.zipHash,
      status: "SEALED",
      createdAt: lease.generatedAt,
      updatedAt: new Date().toISOString(),
      calculation,
      caseDataHash,
      rulesetVersion: ruleset.version,
      sourceHash: ruleset.sourceHash,
      kmsKeyVersion: signature.keyVersion,
      kmsAlgorithm: signature.algorithm,
      signatureBase64: signature.signatureBase64,
      storage: Object.fromEntries(storageEntries.map((entry) => [entry.path.split("/").at(-1) || entry.path, entry])),
    };

    await adminDb.runTransaction(async (transaction) => {
      const markerRef = adminDb.collection("report_requests").doc(identity.digest);
      const reportRef = adminDb.collection("cbam_reports").doc(identity.reportId);
      const sealRef = adminDb.collection("document_seals").doc(documentHash);
      const caseRef = adminDb.collection("cbam_cases").doc(caseDocumentId);
      const outboxRef = adminDb.collection("seal_outbox").doc(identity.reportId);
      const [markerSnapshot, reportSnapshot, sealSnapshot, caseSnapshot] = await Promise.all([
        transaction.get(markerRef),
        transaction.get(reportRef),
        transaction.get(sealRef),
        transaction.get(caseRef),
      ]);
      if (!markerSnapshot.exists || !reportSnapshot.exists || !caseSnapshot.exists) throw new Error("SEAL_FINALIZATION_PREREQUISITE_MISSING");
      const marker = markerSnapshot.data() as Partial<SealRequestMarker>;
      if (marker.status !== "IN_PROGRESS" || marker.leaseOwner !== leaseOwner || marker.inputHash !== caseDataHash) throw new Error("SEAL_FINALIZATION_LEASE_LOST");
      if (sealSnapshot.exists) throw new Error("DOCUMENT_HASH_ALREADY_SEALED");

      await consumeEntitlement(transaction, {
        entitlementId: params.entitlementId,
        uid: params.uid,
        reportId: identity.reportId,
        caseId: params.caseId,
        reportHash: documentHash,
        version: releaseVersion,
        correctionReason: params.correctionReason,
      });
      transaction.create(sealRef, {
        valid: true,
        documentHash,
        reportId: identity.reportId,
        caseId: params.caseId,
        releaseVersion,
        issuedAt: reportRecord.updatedAt,
        manifestHash: signature.manifestHash,
        packageHash: packageResult.zipHash,
        signatureBase64: signature.signatureBase64,
        kmsKeyVersion: signature.keyVersion,
        kmsAlgorithm: signature.algorithm,
        commercialStatus: "ACTIVE",
      });
      transaction.set(reportRef, reportRecord);
      transaction.update(caseRef, { latestReleaseId: identity.reportId, latestReleaseVersion: releaseVersion, updatedAt: reportRecord.updatedAt });
      transaction.set(outboxRef, { reportId: identity.reportId, documentHash, uid: params.uid, caseId: params.caseId, createdAt: reportRecord.updatedAt, state: "PENDING_NOTIFICATION" });
      transaction.update(markerRef, { status: "COMPLETED", updatedAt: reportRecord.updatedAt, leaseExpiresAt: reportRecord.updatedAt, error: null });
      transaction.set(adminDb.collection("seal_log").doc(identity.reportId), { state: "SEAL_ACTIVATED", timestamp: reportRecord.updatedAt, documentHash, packageHash: packageResult.zipHash }, { merge: true });
    });
    reserved = false;
    return resultFromReport(reportRecord);
  } catch (error) {
    if (reserved) {
      try {
        await adminDb.runTransaction((transaction) => releaseEntitlementReservation(transaction, {
          entitlementId: params.entitlementId,
          uid: params.uid,
          reportId: identity.reportId,
        }));
      } catch (releaseError) {
        console.error("[SEALING] Entitlement reservation release failed", releaseError);
      }
    }
    await markFailed({ digest: identity.digest, reportId: identity.reportId, leaseOwner, error });
    throw error;
  }
}
