import { adminDb } from "../../firebase-admin";
import { CaseOwnershipViolationError } from "../../commerce/commerce-errors";
import { validateIdentifier } from "../../firestore-validator";

export interface CbamCase {
  caseId: string;
  uid: string;
  data: any;
  status: "DRAFT" | "COMPLETED" | "ARCHIVED" | "REFUNDED";
  latestReleaseId?: string;
  latestReleaseVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export async function getCase(caseId: string): Promise<CbamCase | null> {
  validateIdentifier("caseId", caseId);
  const doc = await adminDb.collection("cbam_cases").doc(caseId).get();
  if (!doc.exists) return null;
  return doc.data() as CbamCase;
}

export async function verifyCaseOwner(caseId: string, uid: string): Promise<CbamCase> {
  validateIdentifier("caseId", caseId);
  validateIdentifier("uid", uid);
  const cbamCase = await getCase(caseId);
  if (!cbamCase) throw new Error(`Case with ID ${caseId} was not found.`);
  if (cbamCase.uid !== uid) throw new CaseOwnershipViolationError(caseId);
  return cbamCase;
}

export async function createCase(uid: string, data: any): Promise<CbamCase> {
  validateIdentifier("uid", uid);
  const caseRef = adminDb.collection("cbam_cases").doc();
  const caseId = `case_${caseRef.id}`;
  const now = new Date().toISOString();

  const cbamCase: CbamCase = {
    caseId,
    uid,
    data: { ...data, caseId, ownerId: uid },
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection("cbam_cases").doc(caseId).set(cbamCase);
  return cbamCase;
}

export async function updateCase(caseId: string, uid: string, data: any): Promise<CbamCase> {
  validateIdentifier("caseId", caseId);
  validateIdentifier("uid", uid);
  const cbamCase = await verifyCaseOwner(caseId, uid);
  if (cbamCase.status !== "DRAFT") {
    throw new Error("CASE_NOT_EDITABLE");
  }

  const now = new Date().toISOString();
  const normalizedData = { ...data, caseId, ownerId: uid };
  const updated: Partial<CbamCase> = {
    data: normalizedData,
    updatedAt: now,
  };

  await adminDb.collection("cbam_cases").doc(caseId).update(updated);
  return { ...cbamCase, ...updated };
}

export async function getCasesForUser(uid: string): Promise<CbamCase[]> {
  validateIdentifier("uid", uid);
  const snapshot = await adminDb.collection("cbam_cases").where("uid", "==", uid).get();
  return snapshot.docs
    .map((doc: any) => ({ caseId: doc.id, ...doc.data() }))
    .sort((a: CbamCase, b: CbamCase) => String(b.updatedAt).localeCompare(String(a.updatedAt))) as CbamCase[];
}
