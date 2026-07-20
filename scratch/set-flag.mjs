import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GCLOUD_PROJECT = "cbam-desk";

initializeApp({
  projectId: "cbam-desk",
});

const db = getFirestore();

async function setFlag() {
  console.log("Setting system/config deployment info...");
  await db.collection("system").doc("config").set({
    disableV5Sealing: false,
    publicPaidLaunchEnabled: true,
    deployedSha: "e4962fcea4d219e50b2fae3165f3ed5ff1a43d90",
    deployedFrom: "origin/main",
    deployedAtUtc: new Date().toISOString()
  }, { merge: true });
  console.log("Successfully updated system/config deployment info.");
}

setFlag().catch(console.error);
