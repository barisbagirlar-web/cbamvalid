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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("=== ALL CASES ===");
  const snapshot = await db.collection("cbam_cases").get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Case ID: ${doc.id}`);
    console.log(`UID: ${data.uid}`);
    console.log(`Status: ${data.status}`);
    console.log(`Latest Release: ${data.latestReleaseId}`);
    console.log(`Data.status: ${data.data?.status}`);
    console.log("------------------------");
  });
}

run().catch(console.error);
