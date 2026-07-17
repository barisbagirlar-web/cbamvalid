import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  if (getApps().length === 0) {
    initializeApp({ projectId: "cbam-desk" });
  }
  const db = getFirestore();
  const caseId = "case_c89fb9166f284cf65c3b171a81bc7e1bf373a0ef9f430ca04847e1bfc45f6542";
  const snap = await db.collection("cbam_cases").doc(caseId).get();
  if (!snap.exists) {
    console.log("Case not found");
    return;
  }
  const data = snap.data();
  console.log("Precursors in DB:", JSON.stringify(data?.data?.precursors, null, 2));
  console.log("Direct Emissions in DB:", JSON.stringify(data?.data?.directEmissions, null, 2));
}
main();
