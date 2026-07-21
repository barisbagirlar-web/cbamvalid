import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk"
});

const db = getFirestore();

async function main() {
  const reportsSnap = await db.collection("cbam_reports").get();

  console.log("Total reports found:", reportsSnap.size);
  let count = 0;
  for (const doc of reportsSnap.docs) {
    const data = doc.data();
    if (data.uid && !data.uid.startsWith("smoke") && data.status === "SEALED") {
      count++;
      console.log("-----------------------------------------");
      console.log("Report ID:", doc.id);
      console.log("Case ID:", data.caseId);
      console.log("Owner ID (uid):", data.uid);
      console.log("Version:", data.releaseVersion);
      console.log("Created At:", data.createdAt);
      console.log("Status:", data.status);
      console.log("Entitlement ID:", data.entitlementId);
      console.log("Storage Dossier PDF size:", data.storage?.["dossier.pdf"]?.sizeBytes);
      console.log("Storage Dossier ZIP size:", data.storage?.["dossier.zip"]?.sizeBytes);
    }
  }
  console.log("Total non-smoke sealed reports:", count);
}

main().catch(console.error);
