import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK
// You must have GOOGLE_APPLICATION_CREDENTIALS set or be authenticated via firebase CLI
const app = getApps().length === 0 ? initializeApp() : getApp();
const auth = getAuth(app);

const TARGET_EMAILS = ["barisbagirlar@gmail.com", "teb232@gmail.com"];

async function bootstrapOwnerAdmin() {
  let failures = 0;
  for (const TARGET_EMAIL of TARGET_EMAILS) {
    try {
      console.log(`[BOOTSTRAP] Looking up user by email: ${TARGET_EMAIL}`);
      const userRecord = await auth.getUserByEmail(TARGET_EMAIL);

      if (!userRecord) {
        console.error(`[BOOTSTRAP] [FAIL] User with email ${TARGET_EMAIL} does not exist.`);
        failures += 1;
        continue;
      }

      if (!userRecord.emailVerified) {
        console.error(`[BOOTSTRAP] [FAIL] Email ${TARGET_EMAIL} is not verified. Admin privileges require a verified email.`);
        failures += 1;
        continue;
      }

      // Preserve existing claims and add admin and ownerAdmin
      const currentClaims = userRecord.customClaims || {};
      const newClaims = {
        ...currentClaims,
        admin: true,
        ownerAdmin: true,
        owner: true,
        role: "super_admin",
      };

      console.log(`[BOOTSTRAP] Assigning admin and ownerAdmin claims to uid: ${userRecord.uid}`);
      await auth.setCustomUserClaims(userRecord.uid, newClaims);

      console.log(`[BOOTSTRAP] [SUCCESS] Claims assigned successfully.`);
      console.log(`uid: ${userRecord.uid}`);
      console.log(`email: ${userRecord.email}`);
      console.log(`claim assignment status: OK`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[BOOTSTRAP] [ERROR] ${message}`);
      failures += 1;
    }
  }
  if (failures > 0) process.exit(1);
  process.exit(0);
}

bootstrapOwnerAdmin();
