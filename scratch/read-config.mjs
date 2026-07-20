import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk",
});

const db = getFirestore();

async function readConfig() {
  const snap = await db.collection("system").doc("config").get();
  console.log("FIRESTORE_CONFIG_READBACK=" + JSON.stringify(snap.data()));
}

readConfig().catch(console.error);
