#!/usr/bin/env node
/**
 * teb232 CEMENT_EG üzerindeki başarısız mühürleme denemesinden kalan
 * FAILED rapor + request + storage objelerini temizler.
 *
 * Hedef: CEMENT_EG (case_a70c36b5348782cc69c7a2c9863bec28f8bb2ad8ac1bff1c6afe7a62966d4c62)
 * başarısız deneme raporu: report_d6bc7e6bbf86191f84afa3af694c1018cc26123b547c410d61adb715c69a0cf3
 *
 * Varsayılan DRY_RUN; EXECUTE=1 ile uygulanır.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const CASE_ID = "case_a70c36b5348782cc69c7a2c9863bec28f8bb2ad8ac1bff1c6afe7a62966d4c62";
const REPORT_IDS = [
  "report_d6bc7e6bbf86191f84afa3af694c1018cc26123b547c410d61adb715c69a0cf3",
];
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
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: bucketName,
    });
  }
  const db = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);

  const deletePaths = new Set();
  const reportIds = [];

  for (const rid of REPORT_IDS) {
    const snap = await db.collection("cbam_reports").doc(rid).get();
    if (snap.exists) {
      const d = snap.data() || {};
      reportIds.push(rid);
      deletePaths.add(`cbam_reports/${rid}`);
      if (d.documentHash) deletePaths.add(`document_seals/${d.documentHash}`);
      if (d.packageCode) deletePaths.add(`package_codes/${d.packageCode}`);
      deletePaths.add(`seal_log/${rid}`);
      deletePaths.add(`seal_outbox/${rid}`);
    }
  }

  // case'e ait tüm FAILED raporlar ve request'ler
  const reports = await db.collection("cbam_reports").where("caseId", "==", CASE_ID).get();
  for (const doc of reports.docs) {
    const d = doc.data() || {};
    const status = String(d.status || "");
    const rid = String(d.reportId || doc.id);
    if (status === "FAILED" || status === "ERROR") {
      reportIds.push(rid);
      deletePaths.add(`cbam_reports/${doc.id}`);
      if (d.documentHash) deletePaths.add(`document_seals/${d.documentHash}`);
      if (d.packageCode) deletePaths.add(`package_codes/${d.packageCode}`);
      deletePaths.add(`seal_log/${rid}`);
      deletePaths.add(`seal_outbox/${rid}`);
    }
  }

  const requests = await db.collection("report_requests").where("caseId", "==", CASE_ID).get();
  for (const doc of requests.docs) {
    const d = doc.data() || {};
    const status = String(d.status || "");
    if (status === "FAILED" || status === "ERROR" || !status) {
      deletePaths.add(`report_requests/${doc.id}`);
      const reqId = String(d.requestId || doc.id);
      deletePaths.add(`seal_log/${reqId}`);
      deletePaths.add(`seal_outbox/${reqId}`);
    }
  }

  // storage objeleri
  const storagePaths = [];
  for (const rid of [...new Set(reportIds)]) {
    const [files] = await bucket.getFiles({ prefix: `reports/${UID}/${rid}/` });
    for (const f of files) storagePaths.push(f.name);
  }

  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);
  console.log(`CASE_ID=${CASE_ID}`);
  console.log(`REPORTS=${reportIds.length}`);
  console.log(`STORAGE_OBJECTS=${storagePaths.length}`);
  console.log(`DOCUMENTS_TO_DELETE=${deletePaths.size}`);
  if (reportIds.length) console.log(`REPORT_IDS=${reportIds.join(",")}`);
  if (storagePaths.length) console.log(`STORAGE_SAMPLE=${storagePaths.slice(0, 3).join(",")}`);

  if (!EXECUTE) {
    console.log("TEB232_FAILED_SEAL_CLEANUP=DRY_RUN_PASS");
    return;
  }

  const refs = [...deletePaths].map((p) => db.doc(p));
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  for (const name of storagePaths) await bucket.file(name).delete({ ignoreNotFound: true });

  const afterReports = await db.collection("cbam_reports").where("caseId", "==", CASE_ID).get();
  const afterRequests = await db.collection("report_requests").where("caseId", "==", CASE_ID).get();
  const [afterFiles] = await bucket.getFiles({ prefix: `reports/${UID}/` });
  if (afterReports.size !== 0) throw new Error(`REPORTS_STILL_PRESENT:${afterReports.size}`);
  if (afterRequests.size !== 0) throw new Error(`REQUESTS_STILL_PRESENT:${afterRequests.size}`);
  if (afterFiles.length !== 0) throw new Error(`STORAGE_STILL_PRESENT:${afterFiles.length}`);
  console.log("TEB232_FAILED_SEAL_CLEANUP=PASS");
  console.log("REPORTS_AFTER=0");
  console.log("REQUESTS_AFTER=0");
  console.log("STORAGE_AFTER=0");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
