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
const tempKeyPath = path.resolve(__dirname, "../../temp-admin-key-3.json");
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
  
  // Update carbonPriceRecords to TRY unit
  data.carbonPriceRecords = [
    {
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d4f10",
      amountPaid: 21700,
      currency: "TRY",
      applicableEmissions: 15000,
      paymentPeriod: "2026-Q1",
      legislationReference: "TR Carbon Tax Law 44",
      proofOfPaymentEvidenceId: "1a8427f7-b37d-4bad-9bdd-2b0d7b3d4f11",
      eligibleCertificateReduction: 8.21
    }
  ];

  await adminDb.collection("cbam_cases").doc(caseId).update({ data });
  console.log("=== TARGET CASE SANITIZED SUCCESSFULLY ===");
}

process.on("exit", () => {
  try {
    fs.unlinkSync(tempKeyPath);
  } catch (err) {}
});

run().catch(console.error);
