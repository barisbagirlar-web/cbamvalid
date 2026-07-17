import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local values manually
const envFile = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found");
  process.exit(1);
}

const b64 = match[1];
const serviceAccountString = Buffer.from(b64, "base64").toString("utf8");

// Write to a temporary file
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key-inspect.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

// Set environment variables before any firebase imports
process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;

// Import firebase-admin
import admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  initializeApp();
}

async function run() {
  const db = getFirestore();
  const cid = "case_89d9ccc7c9b8e6d92ea35a08f4368da52f51b1a4b8e28382dca672346b197481";
  const snap = await db.collection("cbam_cases").doc(cid).get();
  if (snap.exists) {
    console.log("=== CASE DATABASE DETAILS ===");
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("Case not found in DB.");
  }
}

run()
  .catch(console.error)
  .finally(() => {
    try {
      fs.unlinkSync(tempKeyPath);
    } catch (e) {}
  });
