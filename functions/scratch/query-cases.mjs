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
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key-query.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

admin.initializeApp();
const db = admin.firestore();

async function run() {
  console.log("=== CASES ===");
  const casesSnapshot = await db.collection("cbam_cases").get();
  casesSnapshot.docs.forEach(doc => {
    console.log(`\nCase ID: ${doc.id}`);
    console.log(`  status: ${doc.data().status}`);
    console.log(`  latestReleaseId: ${doc.data().latestReleaseId}`);
  });

  console.log("\n=== ENTITLEMENTS ===");
  const entitlementsSnapshot = await db.collection("entitlements").get();
  entitlementsSnapshot.docs.forEach(doc => {
    console.log(`\nEntitlement ID: ${doc.id}`);
    console.log(`  status: ${doc.data().status}`);
    console.log(`  scopeCaseId: ${doc.data().scopeCaseId}`);
    console.log(`  releasesCount: ${doc.data().releasesCount}`);
  });
}

run().catch(console.error).finally(() => {
  try { fs.unlinkSync(tempKeyPath); } catch {}
});
