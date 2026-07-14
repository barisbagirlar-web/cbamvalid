import { adminDb } from "../../firebase-admin";
import { CaseOwnershipViolationError } from "../../commerce/commerce-errors";
import { validateIdentifier } from "../../firestore-validator";
import { AuditReadyCaseSchema } from "../schema";

export interface CbamCase {
  caseId: string;
  uid: string;
  data: any;
  status: "DRAFT" | "COMPLETED" | "REFUNDED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper to sanitize case data on write (Phase 2 & Phase 3 evidence status verification)
 */
function sanitizeCaseData(submittedData: any, existingData?: any): any {
  // Parse with schema
  const parsed = AuditReadyCaseSchema.parse(submittedData);
  
  // Sanitize evidence records
  const existingEvidences = existingData?.evidenceRegister || [];
  const existingMap = new Map<string, any>(existingEvidences.map((e: any) => [e.evidenceId, e]));
  
  parsed.evidenceRegister = parsed.evidenceRegister.map(ev => {
    const existing = existingMap.get(ev.evidenceId);
    if (existing) {
      // Force status back to PENDING if they try to escalate it without admin approval
      const reviewStatus = ev.reviewStatus === "APPROVED" && existing.reviewStatus !== "APPROVED" ? "PENDING" : ev.reviewStatus;
      const supportStatus = ev.supportStatus === "SUPPORTED" && existing.supportStatus !== "SUPPORTED" ? "PENDING" : ev.supportStatus;
      return {
        ...ev,
        reviewStatus,
        supportStatus
      };
    } else {
      // New evidence must start as PENDING
      return {
        ...ev,
        reviewStatus: "PENDING",
        supportStatus: "PENDING"
      };
    }
  });

  // Recalculate carbon price reduction based on approved evidence records
  const approvedEvidenceIds = new Set(
    parsed.evidenceRegister
      .filter(e => e.reviewStatus === "APPROVED" && e.supportStatus === "SUPPORTED")
      .map(e => e.evidenceId)
  );

  parsed.carbonPriceRecords = parsed.carbonPriceRecords.map(rec => {
    if (!rec.proofOfPaymentEvidenceId || !approvedEvidenceIds.has(rec.proofOfPaymentEvidenceId)) {
      return {
        ...rec,
        eligibleCertificateReduction: 0
      };
    }
    return rec;
  });

  return parsed;
}

/**
 * Retrieve case data by ID
 */
export async function getCase(caseId: string): Promise<CbamCase | null> {
  validateIdentifier("caseId", caseId);
  const doc = await adminDb.collection("cbam_cases").doc(caseId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as CbamCase;
}

/**
 * Verify if the case belongs to the given user UID
 */
export async function verifyCaseOwner(caseId: string, uid: string): Promise<CbamCase> {
  validateIdentifier("caseId", caseId);
  validateIdentifier("uid", uid);
  const cbamCase = await getCase(caseId);
  if (!cbamCase) {
    throw new Error(`Case with ID ${caseId} was not found.`);
  }
  if (cbamCase.uid !== uid) {
    throw new CaseOwnershipViolationError(caseId);
  }
  return cbamCase;
}

/**
 * Create a new draft case document
 */
export async function createCase(uid: string, data: any): Promise<CbamCase> {
  validateIdentifier("uid", uid);
  
  const caseRef = adminDb.collection("cbam_cases").doc();
  const caseId = `case_${caseRef.id}`;
  const now = new Date().toISOString();

  // Attach generated caseId to data
  const caseData = { ...data, caseId, ownerId: uid };
  const sanitized = sanitizeCaseData(caseData);

  const cbamCase: CbamCase = {
    caseId,
    uid,
    data: sanitized,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  await caseRef.set(cbamCase);
  return cbamCase;
}

/**
 * Update an existing draft case document
 */
export async function updateCase(caseId: string, uid: string, data: any): Promise<CbamCase> {
  validateIdentifier("caseId", caseId);
  validateIdentifier("uid", uid);

  const cbamCase = await verifyCaseOwner(caseId, uid);
  const now = new Date().toISOString();

  // Ensure caseId is bound correctly
  const caseData = { ...data, caseId, ownerId: uid };
  const sanitized = sanitizeCaseData(caseData, cbamCase.data);

  const updated: Partial<CbamCase> = {
    data: sanitized,
    updatedAt: now,
  };

  await adminDb.collection("cbam_cases").doc(caseId).update(updated);
  return { ...cbamCase, ...updated };
}

export async function getCasesForUser(uid: string): Promise<CbamCase[]> {
  validateIdentifier("uid", uid);
  const snapshot = await adminDb.collection("cbam_cases").where("uid", "==", uid).get();
  return snapshot.docs.map((doc: any) => ({ caseId: doc.id, ...doc.data() })) as CbamCase[];
}
