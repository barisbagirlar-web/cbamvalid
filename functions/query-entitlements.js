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
  console.log("=== ALL ENTITLEMENTS ===");
  const snapshot = await db.collection("entitlements").get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Entitlement ID: ${doc.id}`);
    console.log(`UID: ${data.uid}`);
    console.log(`Status: ${data.status}`);
    console.log(`OrderId: ${data.orderId}`);
    console.log(`scopeCaseId: ${data.scopeCaseId}`);
    console.log(`releasesCount: ${data.releasesCount}`);
    console.log("------------------------");
  });
}

run().catch(console.error);
