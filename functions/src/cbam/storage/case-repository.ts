import { adminDb } from "@/firebase-admin";
import { CaseOwnershipViolationError } from "../../commerce/commerce-errors";
import { validateIdentifier } from "@/firestore-validator";

export interface CbamCase {
  caseId: string;
  uid: string;
  data: any;
  status: "DRAFT" | "COMPLETED" | "REFUNDED";
  createdAt: string;
  updatedAt: string;
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
  if (data?.cnCode) {
    validateIdentifier("cnCode", data.cnCode);
  }
  const caseRef = adminDb.collection("cbam_cases").doc();
  const caseId = `case_${caseRef.id}`;
  const now = new Date().toISOString();

  const cbamCase: CbamCase = {
    caseId,
    uid,
    data,
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
  if (data?.cnCode) {
    validateIdentifier("cnCode", data.cnCode);
  }
  const cbamCase = await verifyCaseOwner(caseId, uid);
  const now = new Date().toISOString();

  const updated: Partial<CbamCase> = {
    data,
    updatedAt: now,
  };

  await adminDb.collection("cbam_cases").doc(caseId).update(updated);
  return { ...cbamCase, ...updated };
}

export async function getCasesForUser(uid: string): Promise<CbamCase[]> {
  validateIdentifier("uid", uid);
  const snapshot = await adminDb.collection("cbam_cases").where("uid", "==", uid).get();
  return snapshot.docs.map(doc => doc.data() as CbamCase);
}
