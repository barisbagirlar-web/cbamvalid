const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const envFile = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const match = envFile.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_B64="([^"]+)"/);
const serviceAccount = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function findNaN(obj, path = "") {
  if (typeof obj === "number" && (isNaN(obj) || !isFinite(obj))) {
    console.log(`NaN/Inf at: ${path} = ${obj}`);
    return true;
  } else if (obj && typeof obj === "object") {
    let found = false;
    for (const [k, v] of Object.entries(obj)) {
      if (findNaN(v, `${path}.${k}`)) found = true;
    }
    return found;
  }
  return false;
}

async function run() {
  // Scan all sealed reports for this user
  const snap = await db.collection("cbam_reports")
    .where("uid", "==", "r3Sv0U5YqEcLLylbw5ndwK1Zg652")
    .where("status", "==", "SEALED")
    .get();

  console.log(`Found ${snap.docs.length} sealed reports`);
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(`\n=== Report: ${doc.id} ===`);
    const hasNaN = findNaN(data);
    if (!hasNaN) console.log("  No NaN/Inf found");
    // Also log the JSON serialization test
    try {
      JSON.stringify(data);
      console.log("  JSON.stringify: OK");
    } catch (e) {
      console.log(`  JSON.stringify FAILED: ${e.message}`);
    }
  }
}

run().catch(console.error);
