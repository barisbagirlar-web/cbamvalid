#!/usr/bin/env node
/**
 * teb232 kalıntı temizliği — reset-teb232-two-scenarios.ts'in atladığı
 * ikincil kayıtları kaldırır:
 *  - cbam_reports (uid == teb232) ve bağlı report_requests / seal_log /
 *    seal_outbox / document_seals / package_codes
 *  - package_codes koleksiyonundaki uid == teb232 tüm kayıtlar
 *  - reports/{uid}/ storage objeleri
 *
 * Dokunmaz: cbam_cases (2 senaryo korunur), entitlements (ödeme akışı),
 * evidence/{uid}/ objeleri (2 senaryonun kanıtları).
 *
 * Varsayılan DRY_RUN; EXECUTE=1 ile uygulanır.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const EMAIL = "teb232@gmail.com";
const EXECUTE = process.env.EXECUTE === "1";

function readEnvLocal() {
  const result = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    result[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

async function main() {
  const env = readEnvLocal();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_MISSING");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: bucketName,
    });
  }
  const auth = admin.auth();
  const db = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const user = await auth.getUserByEmail(EMAIL);
  if (user.uid !== UID) throw new Error(`UID_MISMATCH:${user.uid}`);

  const deleteRefs = new Set();

  // 1) cbam_reports (uid == teb232)
  const reports = await db.collection("cbam_reports").where("uid", "==", UID).get();
  const reportIds = [];
  for (const doc of reports.docs) {
    const data = doc.data() || {};
    const rid = String(data.reportId || doc.id);
    reportIds.push(rid);
    deleteRefs.add(doc.ref.path);
    // document_seals documentHash ile
    if (data.documentHash) deleteRefs.add(`document_seals/${data.documentHash}`);
    if (data.packageCode) deleteRefs.add(`package_codes/${data.packageCode}`);
    deleteRefs.add(`seal_log/${rid}`);
    deleteRefs.add(`seal_outbox/${rid}`);
  }

  // 2) report_requests (uid == teb232) ve requestId ilişkili kuyruk kayıtları
  const requests = await db.collection("report_requests").where("uid", "==", UID).get();
  for (const doc of requests.docs) {
    const data = doc.data() || {};
    deleteRefs.add(doc.ref.path);
    const reqId = String(data.requestId || doc.id);
    for (const col of ["seal_log", "seal_outbox", "document_seals", "package_codes"]) {
      deleteRefs.add(`${col}/${reqId}`);
    }
  }

  // 3) seal_log / seal_outbox (requestId == teb232, genel)
  for (const col of ["seal_log", "seal_outbox"]) {
    try {
      const owned = await db.collection(col).where("uid", "==", UID).get();
      for (const doc of owned.docs) deleteRefs.add(doc.ref.path);
    } catch { /* alan yok */ }
    try {
      const byReq = await db.collection(col).where("requestId", "==", reportIds.length ? "does-not-exist" : "none").get();
      void byReq;
    } catch { /* yoksay */ }
  }

  // 4) package_codes (uid == teb232)
  const codes = await db.collection("package_codes").where("uid", "==", UID).get();
  for (const doc of codes.docs) deleteRefs.add(doc.ref.path);

  // 5) document_seals (uid == teb232)
  try {
    const seals = await db.collection("document_seals").where("uid", "==", UID).get();
    for (const doc of seals.docs) deleteRefs.add(doc.ref.path);
  } catch { /* alan yok */ }

  // 6) reports/{uid}/ storage objeleri
  const [reportFiles] = await bucket.getFiles({ prefix: `reports/${UID}/` });

  console.log(`PROJECT=cbam-desk`);
  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);
  console.log(`REPORTS=${reports.size}`);
  console.log(`REPORT_REQUESTS=${requests.size}`);
  console.log(`PACKAGE_CODES=${codes.size}`);
  console.log(`STORAGE_OBJECTS=${reportFiles.length}`);
  console.log(`TOTAL_DOCUMENTS_TO_DELETE=${deleteRefs.size}`);
  const reportSample = reportIds.length ? reportIds.slice(0, 5) : [];
  console.log(`REPORT_IDS_SAMPLE=${reportSample.join(",")}`);
  console.log(`PACKAGE_CODES_SAMPLE=${codes.docs.slice(0, 5).map((d) => d.id).join(",")}`);

  if (!EXECUTE) {
    console.log("TEB232_ORPHAN_CLEANUP=DRY_RUN_PASS");
    return;
  }

  const refs = [...deleteRefs].map((p) => db.doc(p));
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  for (const file of reportFiles) await file.delete({ ignoreNotFound: true });

  // Doğrulama
  const afterReports = await db.collection("cbam_reports").where("uid", "==", UID).get();
  const afterCodes = await db.collection("package_codes").where("uid", "==", UID).get();
  const [afterFiles] = await bucket.getFiles({ prefix: `reports/${UID}/` });
  if (afterReports.size !== 0) throw new Error(`REPORTS_STILL_PRESENT:${afterReports.size}`);
  if (afterCodes.size !== 0) throw new Error(`PACKAGE_CODES_STILL_PRESENT:${afterCodes.size}`);
  if (afterFiles.length !== 0) throw new Error(`STORAGE_STILL_PRESENT:${afterFiles.length}`);
  console.log("TEB232_ORPHAN_CLEANUP=PASS");
  console.log("REPORTS_AFTER=0");
  console.log("PACKAGE_CODES_AFTER=0");
  console.log("STORAGE_AFTER=0");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
