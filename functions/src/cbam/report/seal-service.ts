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
import type { SealAssessmentContext } from "./premium-dossier-schema";

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
  publicVerificationToken?: string;
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
  reportId: string;
  digest: string;
  inputHash: string;
  leaseOwner: string;
}): Promise<{ generatedAt: string; completed?: SealingResult }> {
  const markerRef = adminDb.collection("report_requests").doc(params.digest);
  const reportRef = adminDb.collection("cbam_reports").doc(params.reportId);
  return adminDb.runTransaction(async (transaction) => {
    const markerSnapshot = await transaction.get(markerRef);
    const reportSnapshot = await transaction.get(reportRef);
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    if (markerSnapshot.exists) {
      const marker = markerSnapshot.data() as Partial<SealRequestMarker>;
      if (
        marker.uid !== params.uid ||
        marker.caseId !== params.caseId ||
        marker.entitlementId !== params.entitlementId ||
        marker.requestId !== params.requestId ||
        marker.reportId !== params.reportId
      ) throw new Error("SEAL_REQUEST_IDEMPOTENCY_COLLISION");
      if (marker.inputHash !== params.inputHash) throw new Error("SEAL_REQUEST_INPUT_CHANGED");
      if (marker.status === "COMPLETED") {
        if (!reportSnapshot.exists) throw new Error("SEAL_REQUEST_COMPLETED_REPORT_MISSING");
        return { generatedAt: String(marker.generatedAt), completed: resultFromReport(reportSnapshot.data()) };
      }
      if (
        marker.status === "IN_PROGRESS" &&
        marker.leaseOwner !== params.leaseOwner &&
        typeof marker.leaseExpiresAt === "string" &&
        new Date(marker.leaseExpiresAt).getTime() > now.getTime()
      ) throw new Error("SEAL_REQUEST_IN_PROGRESS");
      const generatedAt = String(marker.generatedAt || now.toISOString());
      transaction.update(markerRef, {
        status: "IN_PROGRESS",
        leaseOwner: params.leaseOwner,
        leaseExpiresAt,
        updatedAt: now.toISOString(),
        error: null,
      });
      if (!reportSnapshot.exists) {
        transaction.create(reportRef, {
          reportId: params.reportId,
          uid: params.uid,
          caseId: params.caseId,
          entitlementId: params.entitlementId,
          requestId: params.requestId,
          status: "PROCESSING",
          createdAt: generatedAt,
          updatedAt: now.toISOString(),
        });
      } else {
        transaction.update(reportRef, { status: "PROCESSING", updatedAt: now.toISOString(), error: null });
      }
      return { generatedAt };
    }

    if (reportSnapshot.exists) throw new Error("SEAL_REPORT_WITHOUT_REQUEST_MARKER");
    const generatedAt = now.toISOString();
    const marker: SealRequestMarker = {
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: params.requestId,
      reportId: params.reportId,
      inputHash: params.inputHash,
      status: "IN_PROGRESS",
      leaseOwner: params.leaseOwner,
      leaseExpiresAt,
      generatedAt,
      updatedAt: generatedAt,
    };
    transaction.create(markerRef, marker);
    transaction.create(reportRef, {
      reportId: params.reportId,
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: params.requestId,
      status: "PROCESSING",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
    return { generatedAt };
  });
}

async function setState(reportId: string, state: SealState, details: Record<string, unknown> = {}): Promise<void> {
  await adminDb.collection("seal_log").doc(reportId).set({ state, timestamp: new Date().toISOString(), ...details }, { merge: true });
}

async function resolveCaseDocumentId(caseId: string): Promise<string> {
  const collection = adminDb.collection("cbam_cases");
  const direct = await collection.doc(caseId).get();
  if (direct.exists) return direct.id;
  const legacy = await collection.where("caseId", "==", caseId).limit(2).get();
  if (legacy.docs.length !== 1) throw new Error(legacy.empty ? "CASE_NOT_FOUND" : "CASE_ID_COLLISION");
  return legacy.docs[0].id;
}

async function loadEvidenceFiles(caseData: AuditReadyCase): Promise<EvidenceBinary[]> {
  if (!caseData.caseId) throw new Error("CASE_ID_REQUIRED");
  const bucket = getStorageBucket();
  const files: EvidenceBinary[] = [];
  for (const evidence of caseData.evidenceRegister) {
    const prefix = `evidence/${caseData.ownerId}/${caseData.caseId}/${evidence.evidenceId}/`;
    if (!evidence.storagePath.startsWith(prefix)) throw new Error(`EVIDENCE_STORAGE_PATH_INVALID:${evidence.evidenceId}`);
    const object = bucket.file(evidence.storagePath);
    const [metadata] = await object.getMetadata();
    const custom = metadata.metadata || {};
    if (
      Number(metadata.size) !== evidence.sizeBytes ||
      metadata.contentType !== evidence.mimeType ||
      custom.ownerId !== caseData.ownerId ||
      custom.caseId !== caseData.caseId ||
      custom.evidenceId !== evidence.evidenceId ||
      custom.sha256?.toLowerCase() !== evidence.fileHash.toLowerCase()
    ) throw new Error(`EVIDENCE_METADATA_MISMATCH:${evidence.evidenceId}`);
    const [bytes] = await object.download();
    if (bytes.byteLength !== evidence.sizeBytes || sha256(bytes) !== evidence.fileHash.toLowerCase()) {
      throw new Error(`EVIDENCE_HASH_MISMATCH:${evidence.evidenceId}`);
    }
    files.push({ evidenceId: evidence.evidenceId, fileName: evidence.fileName, bytes });
  }
  return files;
}

async function commitImmutableArtifact(params: {
  path: string;
  bytes: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}): Promise<{ path: string; sha256: string; sizeBytes: number }> {
  const object = getStorageBucket().file(params.path);
  const expectedHash = sha256(params.bytes);
  try {
    await object.save(params.bytes, {
      resumable: false,
      contentType: params.contentType,
      metadata: { cacheControl: "private, max-age=0, no-transform", metadata: { ...params.metadata, sha256: expectedHash } },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (Number(code) !== 412) throw error;
  }
  const [readBack] = await object.download();
  if (readBack.byteLength !== params.bytes.byteLength || sha256(readBack) !== expectedHash) {
    throw new Error(`IMMUTABLE_ARTIFACT_COLLISION_OR_HASH_MISMATCH:${params.path}`);
  }
  return { path: params.path, sha256: expectedHash, sizeBytes: params.bytes.byteLength };
}

async function markFailed(params: {
  digest: string;
  reportId: string;
  leaseOwner: string;
  error: unknown;
}): Promise<void> {
  const message = params.error instanceof Error ? params.error.message : "SEALING_FAILED";
  await adminDb.runTransaction(async (transaction) => {
    const markerRef = adminDb.collection("report_requests").doc(params.digest);
    const reportRef = adminDb.collection("cbam_reports").doc(params.reportId);
    const markerSnapshot = await transaction.get(markerRef);
    const reportSnapshot = await transaction.get(reportRef);
    if (!markerSnapshot.exists) return;
    const marker = markerSnapshot.data() as Partial<SealRequestMarker>;
    if (marker.status === "COMPLETED" || marker.leaseOwner !== params.leaseOwner) return;
    const now = new Date().toISOString();
    transaction.update(markerRef, { status: "FAILED", updatedAt: now, error: message, leaseExpiresAt: now });
    if (reportSnapshot.exists) transaction.update(reportRef, { status: "FAILED", updatedAt: now, error: message });
  });
  await setState(params.reportId, "FAILED", { error: message });
}

export async function sealReport(params: {
  uid: string;
  caseId: string;
  entitlementId: string;
  requestId: string;
  inputData: unknown;
  correctionReason?: string;
}): Promise<SealingResult> {
  assertKmsSigningConfigured();
  const configDoc = await adminDb.collection("system").doc("config").get();
  const disableV5Sealing = configDoc.exists ? configDoc.data()?.disableV5Sealing !== false : true;
  if (disableV5Sealing) {
    throw new Error("V5_SEALING_DISABLED_BY_FEATURE_FLAG");
  }
  let isV5 = false;
  const caseData = AuditReadyCaseSchema.parse(params.inputData);
  if (caseData.caseId !== params.caseId || caseData.ownerId !== params.uid) throw new Error("SEAL_CASE_IDENTITY_MISMATCH");
  const year = Number(caseData.reportingPeriod.year.value);
  if (!Number.isInteger(year)) throw new Error("SEAL_REPORTING_YEAR_INVALID");
  const ruleset = getActiveRuleset(new Date(Date.UTC(year, 0, 1)));
  if (ruleset.period !== "DEFINITIVE" || ruleset.supersessionState !== "ACTIVE") throw new Error("SEAL_RULESET_NOT_ACTIVE_DEFINITIVE");

  const caseDataHash = sha256(canonical(caseData));
  const identity = deriveSealIdentity(params);
  const leaseOwner = crypto.randomUUID();
  const lease = await acquireSealLease({ ...params, ...identity, inputHash: caseDataHash, leaseOwner });
  if (lease.completed) return lease.completed;

    const prevReportsSnap = await adminDb.collection("cbam_reports")
      .where("caseId", "==", params.caseId)
      .get();
    const previousReleases = prevReportsSnap.docs
      .filter(doc => doc.id !== identity.reportId && doc.data().status === "SEALED")
      .map(doc => {
        const data = doc.data();
        return {
          version: Number(data.releaseVersion) || 0,
          reportId: String(data.reportId || ""),
          sealedAt: String(data.createdAt || data.updatedAt || ""),
          status: "SUPERSEDED",
          correctionReason: data.correctionReason ? String(data.correctionReason) : null,
        };
      })
      .sort((left, right) => left.version - right.version);

    let reserved = false;
    try {
      await setState(identity.reportId, "SEAL_REQUESTED", { requestId: identity.requestId, caseDataHash });
      const entitlement = await adminDb.runTransaction((transaction) => reserveEntitlement(transaction, {
        entitlementId: params.entitlementId,
        uid: params.uid,
        reportId: identity.reportId,
        caseId: params.caseId,
        expiresInSeconds: 1800,
      }));
      reserved = true;
      const releaseVersion = entitlement.releasesCount + 1;
      isV5 = releaseVersion >= 5 || process.env.NODE_ENV === "production" || process.env.V5_RELEASE_ACTIVE === "true";
      if (releaseVersion > 1 && !params.correctionReason?.trim()) throw new Error("CORRECTION_REASON_REQUIRED_AFTER_FIRST_RELEASE");

      const assessmentContext: SealAssessmentContext = {
        generatedAt: lease.generatedAt,
        assessmentTimestamp: lease.generatedAt,
        reportId: identity.reportId,
        releaseVersion,
        rulesetVersion: ruleset.version,
        previousReleases,
      };

    const controls = runQualityControls(caseData);
    if (isV5) {
      const { assessReadiness } = await import("../validation/readiness-score");
      const readinessV5 = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: assessmentContext.assessmentTimestamp });
      if (readinessV5.operatorStatus === "NOT_READY" || readinessV5.criticalBlockerCount > 0 || readinessV5.missingMaterialEvidenceCount > 0) {
        throw new Error("SEALING_BLOCKED_BY_V5_READINESS_GATES");
      }
    } else {
      const readiness = assessCaseReadiness(caseData);
      if (!readiness.isEligibleForSealing) {
        const blockers = controls.filter((control) => control.status === "BLOCKER").map((control) => control.ruleId);
        throw new Error(`SEALING_BLOCKED_BY_QUALITY_CONTROLS:${blockers.join(",")}`);
      }
    }

    await setState(identity.reportId, "ENTITLEMENT_RESERVED", { releaseVersion });
    await setState(identity.reportId, "QC_VALIDATED", { controls: controls.length });

    const frozenJson = Buffer.from(canonical(caseData), "utf8");
    if (sha256(frozenJson) !== caseDataHash) throw new Error("CASE_DATA_FREEZE_HASH_MISMATCH");
    await setState(identity.reportId, "DATA_FROZEN", { caseDataHash });

    const calculation = performDossierCalculations(caseData);
    await setState(identity.reportId, "CALCULATION_COMPLETE", { calculationRootHash: calculation.calculationRootHash });
    const evidenceFiles = await loadEvidenceFiles(caseData);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: identity.reportId,
      releaseVersion,
      generatedAt: lease.generatedAt,
      evidenceFiles,
      assessmentContext,
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
    
    const packageResult = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifest.bytes,
      signature,
      generatedAt: lease.generatedAt,
    });

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
    if (packageResult.zipHash !== storageEntries[0].sha256) {
      throw new Error("PACKAGE_RECEIPT_HASH_MISMATCH");
    }
    await setState(identity.reportId, "ARTIFACTS_COMMITTED", { packageHash: packageResult.zipHash });

    const primaryDossier = artifacts.find(a => a.path === "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf");
    const operatorEmissionsReport = artifacts.find(a => a.path === "Operator Emissions Report.pdf");
    const technicalCompilation = artifacts.find(a => a.path === "Complete Dossier Compilation.pdf");
    
    const primaryDossierHash = primaryDossier ? sha256(primaryDossier.bytes) : "";
    const operatorEmissionsReportHash = operatorEmissionsReport ? sha256(operatorEmissionsReport.bytes) : "";
    const technicalCompilationHash = technicalCompilation ? sha256(technicalCompilation.bytes) : "";

    const documentHash = signature.manifestHash; // redefined as manifestHash compatible with old schema
    const caseDocumentId = await resolveCaseDocumentId(params.caseId);
    const reportRecord: any = {
      reportId: identity.reportId,
      uid: params.uid,
      caseId: params.caseId,
      entitlementId: params.entitlementId,
      requestId: identity.requestId,
      releaseVersion,
      documentHash,
      manifestHash: signature.manifestHash,
      packageHash: packageResult.zipHash,
      primaryDossierHash,
      operatorEmissionsReportHash,
      technicalCompilationHash,
      caseDataHash,
      calculationRootHash: calculation.calculationRootHash,
      status: "SEALED",
      createdAt: lease.generatedAt,
      updatedAt: new Date().toISOString(),
      calculation,
      rulesetVersion: ruleset.version,
      sourceHash: ruleset.sourceHash,
      kmsKeyVersion: signature.keyVersion,
      kmsAlgorithm: signature.algorithm,
      signatureBase64: signature.signatureBase64,
      storage: Object.fromEntries(storageEntries.map((entry) => [entry.path.split("/").at(-1) || entry.path, entry])),
      installationName: caseData.installation.name.value || "Sealed dossier",
    };

    let publicVerificationToken: string | undefined;
    if (isV5) {
      const { assessReadiness } = await import("../validation/readiness-score");
      const readinessV5 = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: lease.generatedAt });
      publicVerificationToken = crypto.randomBytes(32).toString("hex");
      const publicVerificationTokenHash = crypto.createHash("sha256").update(publicVerificationToken).digest("hex");

      Object.assign(reportRecord, {
        dossierSchemaVersion: "CBAMVALID-DOSSIER-5.0",
        premiumModelSemanticHash: sha256(canonical(reportRecord.calculation)),
        operatorReadinessStatus: readinessV5.operatorStatus,
        readinessScore: readinessV5.score,
        criticalBlockerCount: readinessV5.criticalBlockerCount,
        materialFindingCount: readinessV5.materialFindingCount,
        openFindingCount: readinessV5.openFindingCount,
        evidenceCoverage: readinessV5.dimensions.find(d => d.dimensionId === "EVIDENCE")?.rawScore || "0",
        crosswalkCoverage: "100.00",
        publicVerificationTokenHash,
        publicVerificationState: "ACTIVE",
        isCurrentRelease: true,
      });
    }

    await adminDb.runTransaction(async (transaction) => {
      const markerRef = adminDb.collection("report_requests").doc(identity.digest);
      const reportRef = adminDb.collection("cbam_reports").doc(identity.reportId);
      const sealRef = adminDb.collection("document_seals").doc(documentHash);
      const caseRef = adminDb.collection("cbam_cases").doc(caseDocumentId);
      const outboxRef = adminDb.collection("seal_outbox").doc(identity.reportId);
      const markerSnapshot = await transaction.get(markerRef);
      const reportSnapshot = await transaction.get(reportRef);
      const sealSnapshot = await transaction.get(sealRef);
      const caseSnapshot = await transaction.get(caseRef);
      if (!markerSnapshot.exists || !reportSnapshot.exists || !caseSnapshot.exists) throw new Error("SEAL_FINALIZATION_PREREQUISITE_MISSING");
      const marker = markerSnapshot.data() as Partial<SealRequestMarker>;
      if (marker.status !== "IN_PROGRESS" || marker.leaseOwner !== leaseOwner || marker.inputHash !== caseDataHash) throw new Error("SEAL_FINALIZATION_LEASE_LOST");
      if (sealSnapshot.exists) throw new Error("DOCUMENT_HASH_ALREADY_SEALED");

      if (isV5) {
        const prevReports = await transaction.get(
          adminDb.collection("cbam_reports")
            .where("caseId", "==", params.caseId)
        );
        await consumeEntitlement(transaction, {
          entitlementId: params.entitlementId,
          uid: params.uid,
          reportId: identity.reportId,
          caseId: params.caseId,
          reportHash: documentHash,
          version: releaseVersion,
          correctionReason: params.correctionReason,
        });
        for (const doc of prevReports.docs) {
          if (doc.id !== identity.reportId) {
            transaction.update(doc.ref, {
              isCurrentRelease: false,
              publicVerificationState: "SUPERSEDED",
            });
          }
        }
      } else {
        await consumeEntitlement(transaction, {
          entitlementId: params.entitlementId,
          uid: params.uid,
          reportId: identity.reportId,
          caseId: params.caseId,
          reportHash: documentHash,
          version: releaseVersion,
          correctionReason: params.correctionReason,
        });
      }
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
      transaction.update(caseRef, {
        latestReleaseId: identity.reportId,
        latestReleaseVersion: releaseVersion,
        updatedAt: reportRecord.updatedAt,
      });
      transaction.set(outboxRef, {
        reportId: identity.reportId,
        documentHash,
        uid: params.uid,
        caseId: params.caseId,
        createdAt: reportRecord.updatedAt,
        state: "PENDING_NOTIFICATION",
      });
      transaction.update(markerRef, {
        status: "COMPLETED",
        updatedAt: reportRecord.updatedAt,
        leaseExpiresAt: reportRecord.updatedAt,
        error: null,
      });
      transaction.set(adminDb.collection("seal_log").doc(identity.reportId), {
        state: "SEAL_ACTIVATED",
        timestamp: reportRecord.updatedAt,
        documentHash,
        packageHash: packageResult.zipHash,
      }, { merge: true });
    });
    reserved = false;
    return {
      ...resultFromReport(reportRecord),
      publicVerificationToken,
    };
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
