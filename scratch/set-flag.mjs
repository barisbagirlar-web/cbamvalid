import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk",
});

const db = getFirestore();

async function setFlag() {
  console.log("Setting system/config.disableV5Sealing = true...");
  await db.collection("system").doc("config").set({ disableV5Sealing: true }, { merge: true });
  console.log("Successfully set system/config.disableV5Sealing = true.");
}

setFlag().catch(console.error);
