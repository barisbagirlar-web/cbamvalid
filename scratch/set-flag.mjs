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
    deployedSha: "8519d5ec423d2ae6d6b1d4ef633aa9cf1d9efc5b",
    deployedFrom: "origin/main",
    deployedAtUtc: new Date().toISOString()
  }, { merge: true });
  console.log("Successfully updated system/config deployment info.");
}

setFlag().catch(console.error);
