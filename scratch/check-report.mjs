import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk",
});

const db = getFirestore();

async function checkReport() {
  const reportId = "report_23f400da8b1f70f43494011ced5ea987a36553dd9410607601178cfd70f5cd80";
  const doc = await db.collection("cbam_reports").doc(reportId).get();
  if (!doc.exists) {
    console.log("Report does not exist!");
    return;
  }
  const data = doc.data();
  console.log("Report exists!");
  console.log("Keys:", Object.keys(data));
  console.log("uid:", data.uid);
  console.log("status:", data.status);
  console.log("storage:", data.storage);
}

checkReport().catch(console.error);
