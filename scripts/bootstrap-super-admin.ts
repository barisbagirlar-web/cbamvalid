/**
 * bootstrap-super-admin.ts
 * One-time privileged bootstrap script to establish the universal owner.
 * Usage: npx tsx scripts/bootstrap-super-admin.ts [--dry-run]
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

const SUPER_ADMIN_EMAIL = "barisbagirlar@gmail.com";

async function bootstrap() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log(`[BOOTSTRAP] Starting super admin bootstrap for: ${SUPER_ADMIN_EMAIL}`);
  if (isDryRun) {
    console.log(`[BOOTSTRAP] Running in DRY RUN mode. No changes will be applied.`);
  }

  // Initialize Firebase Admin (ensure credentials exist)
  if (getApps().length === 0) {
    // Attempt to load from standard location or environment variable
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS 
      || path.resolve(process.cwd(), "service-account.json");
    
    if (fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(serviceAccountPath)
      });
    } else {
      // Fallback to default application credentials if running in environment with them
      initializeApp();
    }
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    // 1. Fetch user by email
    const userRecord = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
    console.log(`[BOOTSTRAP] Found user. UID: ${userRecord.uid}`);

    // 2. Require emailVerified
    if (!userRecord.emailVerified) {
      console.error(`[BOOTSTRAP] ERROR: User email is NOT verified. Cannot bootstrap.`);
      process.exit(1);
    }

    const customClaims = {
      role: "super_admin",
      owner: true,
      adminVersion: 1
    };

    if (!isDryRun) {
      // 3. Set custom claims
      await auth.setCustomUserClaims(userRecord.uid, customClaims);
      console.log(`[BOOTSTRAP] Set custom claims successfully.`);

      // 4. Create protected admin identity record
      const identityRef = db.collection("admin_identities").doc(userRecord.uid);
      await identityRef.set({
        email: userRecord.email,
        role: "super_admin",
        owner: true,
        createdAt: new Date().toISOString(),
        lastBootstrappedAt: new Date().toISOString(),
        adminVersion: 1
      }, { merge: true });
      console.log(`[BOOTSTRAP] Updated admin_identities in Firestore.`);
    }

    console.log(`\n[BOOTSTRAP] SUCCESS: Super Admin identity established.`);
    console.log(`SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}`);
    console.log(`SUPER_ADMIN_UID=${userRecord.uid}`);
    console.log(`Please add SUPER_ADMIN_UID to your secure server environment variables if not already present.`);
    
  } catch (error: any) {
    console.error(`[BOOTSTRAP] ERROR:`, error.message);
    process.exit(1);
  }
}

bootstrap();
