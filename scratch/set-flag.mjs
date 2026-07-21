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
    publicPaidLaunchEnabled: false,
    allowControlledClockInProduction: false,
    allowDirectSmokeDataMutation: false,
    n8nProductionAutomationsEnabled: false,
    deployedSha: "5ce7e7c14fad2aac702ab5b2f0711c09e96effca",
    deployedFrom: "origin/main",
    deployedAtUtc: new Date().toISOString()
  }, { merge: true });
  console.log("Successfully updated system/config deployment info.");
}

setFlag().catch(console.error);
