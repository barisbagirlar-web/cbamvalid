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

export async function createCase(uid: string, data: unknown): Promise<CbamCaseRecord> {
  validateIdentifier("uid", uid);
  const collection = adminDb.collection("cbam_cases");
  const rawDocumentId = collection.doc().id;
  const timestamp = new Date().toISOString();
  const record = buildCaseRecord({ rawDocumentId, uid, data, timestamp });
  const sanitizedData = sanitizeCaseData(record.data);
  const persistedRecord: CbamCaseRecord = { ...record, data: sanitizedData };

  // The Firestore document ID and public caseId must be identical. This is the
  // invariant that prevents create-success/read-failure redirect loops.
  await collection.doc(persistedRecord.caseId).create(persistedRecord);
  return persistedRecord;
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
