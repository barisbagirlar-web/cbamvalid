import { createHash } from "node:crypto";
import { adminDb, getStorageBucket } from "../../firebase-admin";
import { CaseOwnershipViolationError } from "../../commerce/commerce-errors";
import { validateIdentifier } from "../../firestore-validator";
import {
  AuditReadyCaseSchema,
  type AuditReadyCase,
  type EvidenceRecord,
  type EvidenceSupportStatus,
} from "../schema";
import { createCanonicalCaseId } from "../case-id";
import { buildCaseRecord, type CbamCaseRecord } from "./case-contract";
import {
  decideCaseCreationState,
  deriveCaseCreationIdentity,
  parseCaseCreationMarker,
  type CaseCreationMarker,
} from "./case-creation-idempotency";

export type CbamCase = CbamCaseRecord;

type ResolvedCaseDocument = {
  documentId: string;
  record: CbamCaseRecord;
};

type EvidenceReviewDecision = "APPROVED" | "REJECTED";
type EvidenceScanStatus = "CLEAN" | "INFECTED";

function parseStoredCase(data: unknown, documentId: string): CbamCaseRecord {
  if (!data || typeof data !== "object") throw new Error("CASE_RECORD_INVALID");
  const source = data as Partial<CbamCaseRecord>;
  const uid = typeof source.uid === "string" ? source.uid : "";
  validateIdentifier("uid", uid);

  const caseId = createCanonicalCaseId(
    typeof source.caseId === "string" && source.caseId.trim() ? source.caseId : documentId
  );
  const parsedData = AuditReadyCaseSchema.parse({
    ...(source.data as Record<string, unknown>),
    caseId,
    ownerId: uid,
  });

  return {
    caseId,
    uid,
    data: parsedData,
    status: source.status ?? "DRAFT",
    latestReleaseId: source.latestReleaseId,
    latestReleaseVersion: source.latestReleaseVersion,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date(0).toISOString(),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date(0).toISOString(),
  };
}

async function resolveCaseDocument(caseId: string): Promise<ResolvedCaseDocument | null> {
  const normalizedCaseId = validateIdentifier("caseId", caseId);
  const collection = adminDb.collection("cbam_cases");

  const canonicalSnapshot = await collection.doc(normalizedCaseId).get();
  if (canonicalSnapshot.exists) {
    return {
      documentId: canonicalSnapshot.id,
      record: parseStoredCase(canonicalSnapshot.data(), canonicalSnapshot.id),
    };
  }

  const legacySnapshot = await collection.where("caseId", "==", normalizedCaseId).limit(2).get();
  if (legacySnapshot.empty) return null;
  if (legacySnapshot.docs.length !== 1) throw new Error("CASE_ID_COLLISION");

  const legacyDocument = legacySnapshot.docs[0];
  return {
    documentId: legacyDocument.id,
    record: parseStoredCase(legacyDocument.data(), legacyDocument.id),
  };
}

function sanitizeCaseData(submittedData: unknown, existingData?: AuditReadyCase): AuditReadyCase {
  const parsed = AuditReadyCaseSchema.parse(submittedData);
  const existingEvidence = existingData?.evidenceRegister ?? [];
  const existingMap = new Map(existingEvidence.map((evidence) => [evidence.evidenceId, evidence]));

  parsed.evidenceRegister = parsed.evidenceRegister.map((evidence) => {
    const existing = existingMap.get(evidence.evidenceId);
    if (!existing) {
      return {
        ...evidence,
        reviewStatus: "PENDING" as const,
        supportStatus: "PENDING" as const,
        malwareScanStatus: "PENDING" as const,
        reviewerNotes: undefined,
      };
    }

    return {
      ...evidence,
      storagePath: existing.storagePath,
      fileName: existing.fileName,
      mimeType: existing.mimeType,
      sizeBytes: existing.sizeBytes,
      fileHash: existing.fileHash,
      uploadTimestamp: existing.uploadTimestamp,
      uploader: existing.uploader,
      reviewStatus: existing.reviewStatus,
      supportStatus: existing.supportStatus,
      malwareScanStatus: existing.malwareScanStatus,
      reviewerNotes: existing.reviewerNotes,
    };
  });

  const approvedEvidenceIds = new Set(
    parsed.evidenceRegister
      .filter((evidence) =>
        evidence.reviewStatus === "APPROVED" &&
        evidence.malwareScanStatus === "CLEAN" &&
        ["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(evidence.supportStatus)
      )
      .map((evidence) => evidence.evidenceId)
  );

  parsed.carbonPriceRecords = parsed.carbonPriceRecords.map((record) => {
    if (!record.proofOfPaymentEvidenceId || !approvedEvidenceIds.has(record.proofOfPaymentEvidenceId)) {
      return { ...record, eligibleCertificateReduction: 0 };
    }
    return record;
  });

  return parsed;
}

function appendAuditEvent(
  caseData: AuditReadyCase,
  actor: string,
  action: string,
  metadata: Record<string, unknown>
): AuditReadyCase {
  return AuditReadyCaseSchema.parse({
    ...caseData,
    auditEvents: [
      ...caseData.auditEvents,
      {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor,
        action,
        metadata,
      },
    ],
  });
}

async function verifyEvidenceObject(
  caseId: string,
  uid: string,
  evidence: EvidenceRecord
): Promise<void> {
  const expectedPrefix = `evidence/${uid}/${caseId}/${evidence.evidenceId}/`;
  if (!evidence.storagePath.startsWith(expectedPrefix)) {
    throw new Error("EVIDENCE_STORAGE_PATH_OWNERSHIP_MISMATCH");
  }

  const file = getStorageBucket().file(evidence.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("EVIDENCE_FILE_NOT_FOUND");

  const [metadata] = await file.getMetadata();
  const customMetadata = metadata.metadata ?? {};
  const storedSha256 =
    typeof customMetadata.sha256 === "string"
      ? customMetadata.sha256.toLowerCase()
      : "";
  if (
    Number(metadata.size) !== evidence.sizeBytes ||
    metadata.contentType !== evidence.mimeType ||
    customMetadata.ownerId !== uid ||
    customMetadata.caseId !== caseId ||
    customMetadata.evidenceId !== evidence.evidenceId ||
    storedSha256 !== evidence.fileHash.toLowerCase()
  ) {
    throw new Error("EVIDENCE_STORAGE_METADATA_MISMATCH");
  }

  const [buffer] = await file.download();
  const actualHash = createHash("sha256").update(buffer).digest("hex");
  if (buffer.byteLength !== evidence.sizeBytes || actualHash !== evidence.fileHash.toLowerCase()) {
    throw new Error("EVIDENCE_FILE_INTEGRITY_MISMATCH");
  }
}

async function persistTrustedCaseData(
  resolved: ResolvedCaseDocument,
  caseData: AuditReadyCase
): Promise<CbamCaseRecord> {
  const updatedAt = new Date().toISOString();
  const parsed = AuditReadyCaseSchema.parse(caseData);
  await adminDb.collection("cbam_cases").doc(resolved.documentId).update({
    data: parsed,
    updatedAt,
  });
  return { ...resolved.record, data: parsed, updatedAt };
}

export async function getCase(caseId: string): Promise<CbamCaseRecord | null> {
  const resolved = await resolveCaseDocument(caseId);
  return resolved?.record ?? null;
}

export async function verifyCaseOwner(caseId: string, uid: string): Promise<CbamCaseRecord> {
  validateIdentifier("uid", uid);
  const cbamCase = await getCase(caseId);
  if (!cbamCase) throw new Error(`Case with ID ${caseId} was not found.`);
  if (cbamCase.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  return cbamCase;
}

export async function createCase(
  uid: string,
  data: unknown,
  requestId: string
): Promise<CbamCaseRecord> {
  const identity = deriveCaseCreationIdentity(validateIdentifier("uid", uid), requestId);
  const timestamp = new Date().toISOString();
  const record = buildCaseRecord({
    rawDocumentId: identity.digest,
    uid: identity.uid,
    data,
    timestamp,
  });
  const persistedRecord: CbamCaseRecord = {
    ...record,
    data: sanitizeCaseData(record.data),
  };
  if (persistedRecord.caseId !== identity.caseId) {
    throw new Error("CASE_CREATION_IDENTITY_MISMATCH");
  }

  const caseRef = adminDb.collection("cbam_cases").doc(identity.caseId);
  const markerRef = adminDb.collection("case_creation_requests").doc(identity.digest);

  return adminDb.runTransaction(async (transaction) => {
    const markerSnapshot = await transaction.get(markerRef);
    const caseSnapshot = await transaction.get(caseRef);
    const marker = markerSnapshot.exists
      ? parseCaseCreationMarker(markerSnapshot.data())
      : null;
    const decision = decideCaseCreationState({
      identity,
      marker,
      caseExists: caseSnapshot.exists,
    });

    if (decision === "RETURN_EXISTING") {
      return parseStoredCase(caseSnapshot.data(), caseSnapshot.id);
    }

    const creationMarker: CaseCreationMarker = {
      uid: identity.uid,
      requestId: identity.requestId,
      caseId: identity.caseId,
      createdAt: timestamp,
    };
    transaction.create(caseRef, persistedRecord);
    transaction.create(markerRef, creationMarker);
    return persistedRecord;
  });
}

export async function updateCase(caseId: string, uid: string, data: unknown): Promise<CbamCaseRecord> {
  validateIdentifier("uid", uid);
  const resolved = await resolveCaseDocument(caseId);
  if (!resolved) throw new Error("CASE_NOT_FOUND");
  if (resolved.record.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  if (resolved.record.status !== "DRAFT") throw new Error("CASE_NOT_EDITABLE");

  const sanitizedData = sanitizeCaseData(
    { ...(data as Record<string, unknown>), caseId: resolved.record.caseId, ownerId: uid },
    resolved.record.data
  );
  return persistTrustedCaseData(resolved, sanitizedData);
}

export async function reviewCaseEvidence(params: {
  caseId: string;
  uid: string;
  evidenceId: string;
  decision: EvidenceReviewDecision;
  supportStatus: EvidenceSupportStatus;
  reviewerNotes: string;
}): Promise<CbamCaseRecord> {
  const resolved = await resolveCaseDocument(params.caseId);
  if (!resolved) throw new Error("CASE_NOT_FOUND");
  if (resolved.record.uid !== params.uid) throw new CaseOwnershipViolationError(params.caseId);
  if (resolved.record.status !== "DRAFT") throw new Error("CASE_NOT_EDITABLE");

  const evidence = resolved.record.data.evidenceRegister.find(
    (record) => record.evidenceId === params.evidenceId
  );
  if (!evidence) throw new Error("EVIDENCE_NOT_FOUND");
  await verifyEvidenceObject(resolved.record.caseId, params.uid, evidence);

  if (params.decision === "APPROVED") {
    if (evidence.malwareScanStatus !== "CLEAN") throw new Error("EVIDENCE_MALWARE_SCAN_NOT_CLEAN");
    if (!["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_REQUIRED"].includes(params.supportStatus)) {
      throw new Error("EVIDENCE_SUPPORT_STATUS_INVALID");
    }
  }

  const updatedEvidence = resolved.record.data.evidenceRegister.map((record) =>
    record.evidenceId === params.evidenceId
      ? {
          ...record,
          reviewStatus: params.decision,
          supportStatus:
            params.decision === "APPROVED" ? params.supportStatus : "UNSUPPORTED" as const,
          reviewerNotes: params.reviewerNotes.trim(),
        }
      : record
  );

  const nextData = appendAuditEvent(
    { ...resolved.record.data, evidenceRegister: updatedEvidence },
    params.uid,
    "EVIDENCE_INTERNAL_REVIEWED",
    {
      evidenceId: params.evidenceId,
      decision: params.decision,
      supportStatus: params.decision === "APPROVED" ? params.supportStatus : "UNSUPPORTED",
    }
  );
  return persistTrustedCaseData(resolved, nextData);
}

export async function recordEvidenceMalwareScan(params: {
  caseId: string;
  evidenceId: string;
  status: EvidenceScanStatus;
  scannerReference: string;
  actorUid: string;
}): Promise<CbamCaseRecord> {
  const resolved = await resolveCaseDocument(params.caseId);
  if (!resolved) throw new Error("CASE_NOT_FOUND");
  const evidence = resolved.record.data.evidenceRegister.find(
    (record) => record.evidenceId === params.evidenceId
  );
  if (!evidence) throw new Error("EVIDENCE_NOT_FOUND");
  await verifyEvidenceObject(resolved.record.caseId, resolved.record.uid, evidence);

  const updatedEvidence = resolved.record.data.evidenceRegister.map((record) =>
    record.evidenceId === params.evidenceId
      ? {
          ...record,
          malwareScanStatus: params.status,
          reviewStatus: params.status === "INFECTED" ? "REJECTED" as const : record.reviewStatus,
          supportStatus: params.status === "INFECTED" ? "UNSUPPORTED" as const : record.supportStatus,
        }
      : record
  );

  const nextData = appendAuditEvent(
    { ...resolved.record.data, evidenceRegister: updatedEvidence },
    params.actorUid,
    "EVIDENCE_MALWARE_SCAN_RECORDED",
    {
      evidenceId: params.evidenceId,
      status: params.status,
      scannerReference: params.scannerReference,
    }
  );
  return persistTrustedCaseData(resolved, nextData);
}

export async function archiveCase(caseId: string, uid: string): Promise<void> {
  const resolved = await resolveCaseDocument(caseId);
  if (!resolved || resolved.record.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  await adminDb.collection("cbam_cases").doc(resolved.documentId).update({
    status: "ARCHIVED",
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCase(caseId: string, uid: string): Promise<void> {
  const resolved = await resolveCaseDocument(caseId);
  if (!resolved || resolved.record.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  if (resolved.record.latestReleaseId) throw new Error("CASE_WITH_RELEASE_CANNOT_BE_DELETED");
  await adminDb.collection("cbam_cases").doc(resolved.documentId).delete();
}

export async function getCasesForUser(uid: string): Promise<CbamCaseRecord[]> {
  validateIdentifier("uid", uid);
  const snapshot = await adminDb.collection("cbam_cases").where("uid", "==", uid).get();
  const byCaseId = new Map<string, { documentId: string; record: CbamCaseRecord }>();

  for (const document of snapshot.docs) {
    const record = parseStoredCase(document.data(), document.id);
    const existing = byCaseId.get(record.caseId);
    const shouldReplace =
      !existing ||
      document.id === record.caseId ||
      (existing.documentId !== record.caseId && record.updatedAt > existing.record.updatedAt);
    if (shouldReplace) byCaseId.set(record.caseId, { documentId: document.id, record });
  }

  return [...byCaseId.values()]
    .map(({ record }) => record)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
