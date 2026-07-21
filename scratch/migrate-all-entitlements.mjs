import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk"
});

const db = getFirestore();

async function main() {
  const snap = await db.collection("entitlements").get();

  console.log(`Scanning all ${snap.size} entitlements...`);
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.productCode === "CBAM_EXPORTER_FINAL_REPORT" || data.productCode === "premium_dossier") {
      count++;
      console.log(`Migrating entitlement ${doc.id} (Owner: ${data.uid}, Old Code: ${data.productCode}) to pack_premium_dossier_v5...`);
      await doc.ref.update({
        productCode: "pack_premium_dossier_v5",
        updatedAt: new Date().toISOString()
      });
    }
  }
  console.log(`Migration complete. Updated ${count} entitlements.`);
}

main().catch(console.error);
