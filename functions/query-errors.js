const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const envFile = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
if (!match) {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 not found in .env.local");
  process.exit(1);
}

const b64 = match[1];
const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("=== RECENT REPORT REQUESTS ===");
  const requests = await db.collection("report_requests").orderBy("updatedAt", "desc").limit(10).get();
  requests.forEach(doc => {
    const data = doc.data();
    console.log(`Request ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Case ID: ${data.caseId}`);
    console.log(`Error: ${data.error}`);
    console.log(`Updated At: ${data.updatedAt}`);
    console.log("------------------------");
  });
}

run().catch(console.error);
