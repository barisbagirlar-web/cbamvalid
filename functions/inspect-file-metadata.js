const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const envFile = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found");
  process.exit(1);
}

const b64 = match[1];
const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

// Initialize Firebase Admin with correct storage configuration
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "cbam-desk.firebasestorage.app"
});

const db = admin.firestore();
const storage = admin.storage();

async function run() {
  const filePath = "evidence/r3Sv0U5YqEcLLylbw5ndwK1Zg652/case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542/eori-proof.pdf";
  const file = storage.bucket().file(filePath);
  const [metadata] = await file.getMetadata();
  console.log("=== FILE METADATA ===");
  console.log("size:", metadata.size);
  console.log("contentType:", metadata.contentType);
  console.log("customMetadata:", metadata.metadata);
  
  console.log("=== CASE EVIDENCE RECORD ===");
  const cid = "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542";
  const caseDoc = await db.collection("cbam_cases").doc(cid).get();
  const caseData = caseDoc.data().data;
  const ev = caseData.evidenceRegister[0];
  console.log("ev.sizeBytes:", ev.sizeBytes);
  console.log("ev.mimeType:", ev.mimeType);
  console.log("ev.fileHash:", ev.fileHash);
}

run().catch(console.error);
