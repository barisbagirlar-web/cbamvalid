import { createHash } from "node:crypto";
import { adminDb } from "../../firebase-admin";
import { CaseOwnershipViolationError } from "../../commerce/commerce-errors";
import { validateIdentifier } from "../../firestore-validator";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../schema";
import { createCanonicalCaseId } from "../case-id";
import { buildCaseRecord, type CbamCaseRecord } from "./case-contract";

export type CbamCase = CbamCaseRecord;

type ResolvedCaseDocument = {
  documentId: string;
  record: CbamCaseRecord;
};

type CaseCreationMarker = {
  uid: string;
  requestId: string;
  caseId: string;
  createdAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function creationDigest(uid: string, requestId: string): string {
  return createHash("sha256").update(`${uid}\u0000${requestId}`).digest("hex");
}

function parseCreationMarker(data: unknown): CaseCreationMarker {
  if (!data || typeof data !== "object") throw new Error("CASE_CREATION_MARKER_INVALID");
  const source = data as Partial<CaseCreationMarker>;
  if (
    typeof source.uid !== "string" ||
    typeof source.requestId !== "string" ||
    typeof source.caseId !== "string" ||
    typeof source.createdAt !== "string"
  ) {
    throw new Error("CASE_CREATION_MARKER_INVALID");
  }
  return {
    uid: source.uid,
    requestId: source.requestId,
    caseId: createCanonicalCaseId(source.caseId),
    createdAt: source.createdAt,
  };
}

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

  // Backward compatibility for historical records written under the raw
  // Firestore auto-ID while storing a prefixed caseId inside the document.
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
      };
    }

    return {
      ...evidence,
      reviewStatus:
        evidence.reviewStatus === "APPROVED" && existing.reviewStatus !== "APPROVED"
          ? "PENDING"
          : evidence.reviewStatus,
      supportStatus:
        evidence.supportStatus === "SUPPORTED" && existing.supportStatus !== "SUPPORTED"
          ? "PENDING"
          : evidence.supportStatus,
    };
  });

  const approvedEvidenceIds = new Set(
    parsed.evidenceRegister
      .filter((evidence) => evidence.reviewStatus === "APPROVED" && evidence.supportStatus === "SUPPORTED")
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
  const normalizedUid = validateIdentifier("uid", uid);
  const normalizedRequestId = requestId.trim();
  if (!UUID_PATTERN.test(normalizedRequestId)) {
    throw new Error("CASE_CREATION_REQUEST_ID_INVALID");
  }

  const digest = creationDigest(normalizedUid, normalizedRequestId);
  const timestamp = new Date().toISOString();
  const record = buildCaseRecord({
    rawDocumentId: digest,
    uid: normalizedUid,
    data,
    timestamp,
  });
  const persistedRecord: CbamCaseRecord = {
    ...record,
    data: sanitizeCaseData(record.data),
  };

  const caseRef = adminDb.collection("cbam_cases").doc(persistedRecord.caseId);
  const markerRef = adminDb.collection("case_creation_requests").doc(digest);

  return adminDb.runTransaction(async (transaction) => {
    // Every read occurs before any write. Concurrent calls with the same
    // requestId conflict on markerRef and converge on the first committed case.
    const markerSnapshot = await transaction.get(markerRef);
    const caseSnapshot = await transaction.get(caseRef);

    if (markerSnapshot.exists) {
      const marker = parseCreationMarker(markerSnapshot.data());
      if (
        marker.uid !== normalizedUid ||
        marker.requestId !== normalizedRequestId ||
        marker.caseId !== persistedRecord.caseId
      ) {
        throw new Error("CASE_CREATION_IDEMPOTENCY_COLLISION");
      }
      if (!caseSnapshot.exists) {
        throw new Error("CASE_CREATION_IDEMPOTENCY_BROKEN");
      }
      return parseStoredCase(caseSnapshot.data(), caseSnapshot.id);
    }

    if (caseSnapshot.exists) {
      throw new Error("CASE_CREATION_IDEMPOTENCY_BROKEN");
    }

    const marker: CaseCreationMarker = {
      uid: normalizedUid,
      requestId: normalizedRequestId,
      caseId: persistedRecord.caseId,
      createdAt: timestamp,
    };
    transaction.create(caseRef, persistedRecord);
    transaction.create(markerRef, marker);
    return persistedRecord;
  });
}

export async function updateCase(caseId: string, uid: string, data: unknown): Promise<CbamCaseRecord> {
  validateIdentifier("uid", uid);
  const resolved = await resolveCaseDocument(caseId);
  if (!resolved) throw new Error("CASE_NOT_FOUND");
  if (resolved.record.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  if (resolved.record.status !== "DRAFT") throw new Error("CASE_NOT_EDITABLE");

  const timestamp = new Date().toISOString();
  const sanitizedData = sanitizeCaseData(
    { ...(data as Record<string, unknown>), caseId: resolved.record.caseId, ownerId: uid },
    resolved.record.data
  );
  const update = { data: sanitizedData, updatedAt: timestamp };
  await adminDb.collection("cbam_cases").doc(resolved.documentId).update(update);
  return { ...resolved.record, ...update };
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
