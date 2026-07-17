const admin = require("firebase-admin");
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
const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "cbam-desk.firebasestorage.app"
});

const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

async function run() {
  const uid = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
  const caseId = "case_seed_teb232_prod_72085120";

  console.log(`=== FETCHING CASE ${caseId} ===`);
  const caseDoc = await db.collection("cbam_cases").doc(caseId).get();
  if (!caseDoc.exists) {
    console.error("Case not found!");
    return;
  }
  const caseRecord = caseDoc.data();
  const caseData = caseRecord.data;

  console.log("=== FIXING STORAGE METADATA & FIRESTORE REGISTER ===");
  for (let i = 0; i < caseData.evidenceRegister.length; i++) {
    const evidence = caseData.evidenceRegister[i];
    const file = bucket.file(evidence.storagePath);
    
    // 1. Download file bytes
    console.log(`Downloading ${evidence.fileName} from ${evidence.storagePath}...`);
    const [bytes] = await file.download();
    
    // 2. Compute size and hash
    const sizeBytes = bytes.byteLength;
    const fileHash = sha256(bytes);
    console.log(`Computed size: ${sizeBytes} bytes, hash: ${fileHash}`);

    // 3. Update Storage Metadata
    console.log(`Updating custom metadata in Storage for ${evidence.fileName}...`);
    await file.setMetadata({
      metadata: {
        ownerId: uid,
        caseId: caseId,
        evidenceId: evidence.evidenceId,
        sha256: fileHash
      }
    });

    // 4. Update Case Register fields
    evidence.sizeBytes = sizeBytes;
    evidence.fileHash = fileHash;
  }

  // Save the updated case document back to Firestore
  console.log("=== SAVING UPDATED CASE DATA TO FIRESTORE ===");
  await db.collection("cbam_cases").doc(caseId).update({
    data: caseData
  });

  console.log("=== FIRESTORE AND STORAGE SYNC COMPLETED SUCCESSFULLY ===");
}

run().catch(console.error);
