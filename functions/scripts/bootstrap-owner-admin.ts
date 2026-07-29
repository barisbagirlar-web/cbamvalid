import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
// You must have GOOGLE_APPLICATION_CREDENTIALS set or be authenticated via firebase CLI
const app = getApps().length === 0 ? initializeApp() : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const TARGET_EMAIL = "barisbagirlar@gmail.com";

async function bootstrapOwnerAdmin() {
  try {
    console.log(`[BOOTSTRAP] Looking up user by email: ${TARGET_EMAIL}`);
    const userRecord = await auth.getUserByEmail(TARGET_EMAIL);

    if (!userRecord) {
      console.error(`[BOOTSTRAP] [FAIL] User with email ${TARGET_EMAIL} does not exist.`);
      process.exit(1);
    }

    if (!userRecord.emailVerified) {
      console.error(`[BOOTSTRAP] [FAIL] Email ${TARGET_EMAIL} is not verified. Admin privileges require a verified email.`);
      process.exit(1);
    }

    const newClaims = {
      role: "super_admin",
      owner: true,
      ownerUid: userRecord.uid,
      adminVersion: 2,
    };

    console.log(`[BOOTSTRAP] Assigning canonical owner claims to uid: ${userRecord.uid}`);
    await auth.setCustomUserClaims(userRecord.uid, newClaims);
    await db.collection("admin_identities").doc(userRecord.uid).set({
      email: TARGET_EMAIL,
      role: "super_admin",
      owner: true,
      adminVersion: 2,
      lastBootstrappedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[BOOTSTRAP] [SUCCESS] Claims assigned successfully.`);
    console.log(`uid: ${userRecord.uid}`);
    console.log(`email: ${userRecord.email}`);
    console.log(`claim assignment status: OK`);
    
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown bootstrap failure";
    console.error(`[BOOTSTRAP] [ERROR] ${message}`);
    process.exit(1);
  }
}

bootstrapOwnerAdmin();
