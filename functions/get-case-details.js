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
  const cases = ["case_89d9ccc7c9b8e6d92ea35a08f4368da52f51b1a4b8e28382dca672346b197481", "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542", "case_seed_teb232_prod_72085120"];
  for (const cid of cases) {
    const snap = await db.collection("cbam_cases").doc(cid).get();
    if (snap.exists) {
      const d = snap.data();
      console.log(`=== CASE ${cid} ===`);
      console.log("exporter:", d.data?.exporterIdentity?.legalName?.value || d.data?.exporterName);
      console.log("importer:", d.data?.importerIdentity?.eoriNumber?.value || d.data?.declarantEORI);
      console.log("installation:", d.data?.installation?.name?.value || d.data?.installationName);
      console.log("year:", d.data?.reportingPeriod?.year?.value || d.data?.importYear);
      console.log("status:", d.status);
      console.log("latestRelease:", d.latestReleaseId);
      console.log("data.status:", d.data?.status);
    }
  }
}

run().catch(console.error);
