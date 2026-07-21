import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk"
});

const db = getFirestore();

async function main() {
  const uid = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
  const snap = await db.collection("entitlements")
    .where("uid", "==", uid)
    .get();

  console.log(`Found ${snap.size} entitlements for user ${uid}:`);
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log("-----------------------------------------");
    console.log("Entitlement ID:", doc.id);
    console.log("Product Code:", data.productCode);
    console.log("Status:", data.status);
    console.log("Scope Case ID:", data.scopeCaseId);
    console.log("Releases Count:", data.releasesCount);

    if (data.productCode === "CBAM_EXPORTER_FINAL_REPORT") {
      console.log("Updating productCode to pack_premium_dossier_v5...");
      await doc.ref.update({
        productCode: "pack_premium_dossier_v5",
        updatedAt: new Date().toISOString()
      });
      console.log("Update complete!");
    }
  }
}

main().catch(console.error);
