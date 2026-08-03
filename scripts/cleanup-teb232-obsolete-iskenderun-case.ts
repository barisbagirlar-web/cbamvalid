#!/usr/bin/env npx tsx

import admin from "firebase-admin";

const PROJECT = "cbam-desk";
const EXPECTED_EMAIL = "teb232@gmail.com";
const EXPECTED_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const OBSOLETE_CASE_ID = "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8";
const EXECUTE = process.env.EXECUTE === "1";

if (process.env.GCLOUD_PROJECT !== PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== PROJECT) {
  throw new Error(`PROJECT_MISMATCH:${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "unset"}`);
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
const auth = admin.auth();
const db = admin.firestore();
const bucket = admin.storage().bucket();

async function main(): Promise<void> {
  const user = await auth.getUserByEmail(EXPECTED_EMAIL);
  if (user.uid !== EXPECTED_UID) throw new Error(`UID_MISMATCH:${user.uid}`);

  const caseRef = db.collection("cbam_cases").doc(OBSOLETE_CASE_ID);
  const caseSnapshot = await caseRef.get();
  const data = caseSnapshot.data() || {};
  const owner = String(data.uid || data.ownerId || data.data?.ownerId || "");
  if (caseSnapshot.exists && owner !== EXPECTED_UID) {
    throw new Error(`OWNER_MISMATCH:${owner}`);
  }

  const refs = new Map<string, admin.firestore.DocumentReference>();
  if (caseSnapshot.exists) refs.set(caseRef.path, caseRef);
  for (const collection of ["cbam_reports", "document_seals", "report_requests"]) {
    const snapshot = await db.collection(collection).where("caseId", "==", OBSOLETE_CASE_ID).get();
    for (const doc of snapshot.docs) refs.set(doc.ref.path, doc.ref);
  }

  const [evidenceFiles] = await bucket.getFiles({ prefix: `evidence/${EXPECTED_UID}/${OBSOLETE_CASE_ID}/` });

  console.log(`PROJECT=${PROJECT}`);
  console.log(`USER=${EXPECTED_EMAIL}`);
  console.log(`CASE=${OBSOLETE_CASE_ID}`);
  console.log(`DOCUMENTS=${refs.size}`);
  console.log(`STORAGE_OBJECTS=${evidenceFiles.length}`);
  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);

  if (!EXECUTE) {
    console.log("TEB232_OBSOLETE_ISKENDERUN_CLEANUP=DRY_RUN_PASS");
    return;
  }

  for (const file of evidenceFiles) await file.delete({ ignoreNotFound: true });
  const documents = [...refs.values()];
  for (let offset = 0; offset < documents.length; offset += 400) {
    const batch = db.batch();
    documents.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  const readback = await caseRef.get();
  if (readback.exists) throw new Error("CASE_DELETE_READBACK_FAILED");
  console.log("TEB232_OBSOLETE_ISKENDERUN_CLEANUP=PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
