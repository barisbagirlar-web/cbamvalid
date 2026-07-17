import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found");
  process.exit(1);
}

const b64 = match[1];
const serviceAccountString = Buffer.from(b64, "base64").toString("utf8");
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key-errors.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

admin.initializeApp();
const db = admin.firestore();

async function run() {
  console.log("=== RECENT REPORT REQUESTS ===");
  const requests = await db.collection("report_requests").orderBy("updatedAt", "desc").limit(5).get();
  requests.forEach(doc => {
    const data = doc.data();
    console.log(`Request ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Case ID: ${data.caseId}`);
    console.log(`Error: ${data.error}`);
    console.log(`Updated At: ${data.updatedAt}`);
    console.log("------------------------");
  });

  console.log("=== RECENT CBAM REPORTS ===");
  const reports = await db.collection("cbam_reports").orderBy("updatedAt", "desc").limit(5).get();
  reports.forEach(doc => {
    const data = doc.data();
    console.log(`Report ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Case ID: ${data.caseId}`);
    console.log(`Error: ${data.error}`);
    console.log(`Updated At: ${data.updatedAt}`);
    console.log("------------------------");
  });
}

run().catch(console.error).finally(() => {
  try { fs.unlinkSync(tempKeyPath); } catch {}
});
