import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CASE_ID = "case_89d9ccc7c9b8e6d92ea35a08f4368da52f51b14b8e28382dca672346b197481";

async function main() {
  if (getApps().length === 0) {
    initializeApp({ projectId: "cbam-desk" });
  }

  const db = getFirestore();
  const doc = await db.collection("cbam_cases").doc(CASE_ID).get();
  if (doc.exists) {
    console.log(`CASE STATUS for ${CASE_ID}:`, doc.data()?.status);
  } else {
    console.log(`CASE ${CASE_ID} not found.`);
  }
}

main().catch(console.error);
