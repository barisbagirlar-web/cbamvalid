import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk",
});

const db = getFirestore();

async function setFlag() {
  console.log("Setting system/config flags...");
  await db.collection("system").doc("config").set({
    disableV5Sealing: false,
    publicPaidLaunchEnabled: false
  }, { merge: true });
  console.log("Successfully updated system/config flags.");
}

setFlag().catch(console.error);
