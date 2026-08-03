import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = getApps().length === 0 ? initializeApp() : getApp();
const auth = getAuth(app);

const TARGET_EMAILS = ["barisbagirlar@gmail.com"];

async function bootstrapOwnerAdmin() {
  let failures = 0;
  for (const targetEmail of TARGET_EMAILS) {
    try {
      console.log(`[BOOTSTRAP] Looking up user by email: ${targetEmail}`);
      const userRecord = await auth.getUserByEmail(targetEmail);

      if (!userRecord.emailVerified) {
        console.error(`[BOOTSTRAP] [FAIL] Email ${targetEmail} is not verified.`);
        failures += 1;
        continue;
      }

      const currentClaims = userRecord.customClaims || {};
      const newClaims = {
        ...currentClaims,
        admin: true,
        ownerAdmin: true,
        owner: true,
        role: "super_admin",
      };

      await auth.setCustomUserClaims(userRecord.uid, newClaims);
      console.log(`[BOOTSTRAP] [SUCCESS] Claims assigned to ${targetEmail}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[BOOTSTRAP] [ERROR] ${message}`);
      failures += 1;
    }
  }
  process.exit(failures > 0 ? 1 : 0);
}

void bootstrapOwnerAdmin();
