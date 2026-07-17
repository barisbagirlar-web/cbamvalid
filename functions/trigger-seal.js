const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load .env.local values manually
const envFile = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found");
  process.exit(1);
}

const b64 = match[1];
const serviceAccountString = Buffer.from(b64, "base64").toString("utf8");

// Write to a temporary file
const tempKeyPath = path.resolve(__dirname, "../temp-admin-key.json");
fs.writeFileSync(tempKeyPath, serviceAccountString, "utf8");

// Set environment variables before any firebase imports
process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
process.env.CBAM_KMS_KEY_VERSION = "projects/cbam-desk/locations/europe-west1/keyRings/cbam-ring/cryptoKeys/cbam-key/cryptoKeyVersions/1";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

// Now import firebase modules
const { adminDb } = require("./build/firebase-admin");
const admin = require("firebase-admin");

async function run() {
  const uid = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
  const caseId = "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542";
  const entitlementId = "ent_seed_teb232_prod_72085120";

  console.log("=== RESETTING DRAFT STATUS ===");
  await adminDb.collection("cbam_cases").doc(caseId).update({
    status: "DRAFT",
    latestReleaseId: admin.firestore.FieldValue.delete()
  });

  console.log("=== CREATING ENTITLEMENT ===");
  await adminDb.collection("entitlements").doc(entitlementId).set({
    entitlementId,
    uid,
    orderId: "ORDER_SEED_UNBOUND_TEB232_PROD",
    productCode: "premium_dossier",
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    releasesCount: 0,
    releasesList: []
  });

  const requestId = crypto.randomUUID();
  const sha256 = (str) => crypto.createHash("sha256").update(str).digest("hex");
  const digest = sha256(`${uid}\u0000${caseId}\u0000${entitlementId}\u0000${requestId}`);
  const reportId = `report_${digest}`;

  console.log(`=== DELETING EXISTING REQUEST & REPORT RECORD ===`);
  await adminDb.collection("report_requests").doc(digest).delete();
  await adminDb.collection("cbam_reports").doc(reportId).delete();

  console.log("=== EXECUTING SEALING ===");
  const { sealReport } = require("./build/cbam/report/seal-service.js");
  const caseDoc = await adminDb.collection("cbam_cases").doc(caseId).get();
  const caseData = caseDoc.data().data;

  // Ensure case data has correct structure
  caseData.caseId = caseId;
  caseData.ownerId = uid;

  const result = await sealReport({
    uid,
    caseId,
    entitlementId,
    requestId,
    inputData: caseData,
  });

  console.log("=== SEALING COMPLETED SUCCESSFULLY ===");
  console.log(JSON.stringify(result, null, 2));
}

// Clean up key on exit
process.on("exit", () => {
  try {
    fs.unlinkSync(tempKeyPath);
  } catch (err) {}
});

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
