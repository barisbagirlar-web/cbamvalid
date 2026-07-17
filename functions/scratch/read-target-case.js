const fs = require("fs");
const path = require("path");

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
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key-2.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

const { adminDb } = require("../build/firebase-admin");

async function run() {
  const caseId = "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542";
  const doc = await adminDb.collection("cbam_cases").doc(caseId).get();
  if (!doc.exists) {
    console.error("Document not found!");
    return;
  }
  const data = doc.data().data;
  console.log("=== TARGET CASE carbonPriceRecords ===");
  console.log(JSON.stringify(data.carbonPriceRecords, null, 2));
  console.log("=== TARGET CASE installationCountry ===");
  console.log(data.installationCountry || data.installation?.country?.value);
}

process.on("exit", () => {
  try {
    fs.unlinkSync(tempKeyPath);
  } catch (err) {}
});

run().catch(console.error);
