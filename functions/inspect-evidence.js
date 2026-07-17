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
  const cid = "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542";
  const snap = await db.collection("cbam_cases").doc(cid).get();
  if (snap.exists) {
    const d = snap.data();
    console.log("=== case evidenceRegister ===");
    d.data.evidenceRegister.forEach(ev => {
      console.log(`ID: ${ev.evidenceId}`);
      console.log(`fileName: ${ev.fileName}`);
      console.log(`storagePath: ${ev.storagePath}`);
      console.log("------------------");
    });
  }
}

run().catch(console.error);
