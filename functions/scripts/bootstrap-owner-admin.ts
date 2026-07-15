import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = getApps().length === 0 ? initializeApp() : getApp();
const auth = getAuth(app);

async function bootstrapOwnerAdmin() {
  const targetEmail = process.env.OWNER_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const expectedUid = process.env.OWNER_ADMIN_UID?.trim() || "";
  if (!targetEmail || !expectedUid) throw new Error("OWNER_ADMIN_IDENTITY_CONFIGURATION_MISSING");

  const userRecord = await auth.getUserByEmail(targetEmail);
  if (userRecord.uid !== expectedUid) throw new Error("OWNER_ADMIN_UID_MISMATCH");
  if (!userRecord.emailVerified) throw new Error("OWNER_ADMIN_EMAIL_NOT_VERIFIED");

  await auth.setCustomUserClaims(userRecord.uid, {
    ...(userRecord.customClaims || {}),
    role: "super_admin",
    owner: true,
    admin: false,
    ownerAdmin: false,
  });
  console.log("OWNER_SUPER_ADMIN_BOOTSTRAP=PASS");
  console.log(`OWNER_UID=${userRecord.uid}`);
}

bootstrapOwnerAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "OWNER_ADMIN_BOOTSTRAP_FAILED";
  console.error(`OWNER_SUPER_ADMIN_BOOTSTRAP=FAIL:${message}`);
  process.exitCode = 1;
});
