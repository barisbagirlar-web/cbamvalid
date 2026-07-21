import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk"
});

const db = getFirestore();

async function main() {
  const doc = await db.collection("entitlements").doc("ent_repair_txn_01kxs5emezdcbbghvj8hd05vht").get();
  console.log("Entitlement data:", doc.data());
}

main().catch(console.error);
