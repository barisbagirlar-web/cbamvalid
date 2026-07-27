/**
 * Enable public paid checkout gate: system/config.publicPaidLaunchEnabled = true
 * Usage: npx tsx scripts/enable-public-paid-launch.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  const b64 =
    process.env.ADMIN_SERVICE_ACCOUNT_B64 ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("Missing ADMIN_SERVICE_ACCOUNT_B64 / FIREBASE_ADMIN_SERVICE_ACCOUNT_B64");
  }
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(sa), projectId: "cbam-desk" });
  }

  const db = getFirestore();
  const ref = db.doc("system/config");
  const before = await ref.get();
  console.log("BEFORE=", JSON.stringify(before.exists ? before.data() : null));

  await ref.set(
    {
      publicPaidLaunchEnabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: "scripts/enable-public-paid-launch.ts",
      paymentMode: "paddle_sandbox",
    },
    { merge: true }
  );

  const after = await ref.get();
  const enabled = after.data()?.publicPaidLaunchEnabled === true;
  console.log("AFTER=", JSON.stringify(after.data()));
  console.log("publicPaidLaunchEnabled=", enabled);
  if (!enabled) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
