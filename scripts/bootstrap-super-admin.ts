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

const SUPER_ADMIN_EMAILS: string[] = [
  "barisbagirlar@gmail.com",
  "teb232@gmail.com",
];

async function bootstrapOne(email: string) {
  console.log(`[BOOTSTRAP] Starting super admin bootstrap for: ${email}`);

  const auth = getAuth();
  const db = getFirestore();

  try {
    // 1. Fetch user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log(`[BOOTSTRAP] Found user. UID: ${userRecord.uid}`);

    // 2. Require emailVerified
    if (!userRecord.emailVerified) {
      console.error(`[BOOTSTRAP] ERROR: User email is NOT verified. Cannot bootstrap.`);
      process.exit(1);
    }

    const customClaims = {
      role: "super_admin",
      owner: true,
      // Header navigation and post-login routing gate on claims.admin / ownerAdmin.
      admin: true,
      ownerAdmin: true,
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
    console.log(`SUPER_ADMIN_EMAIL=${email}`);
    console.log(`SUPER_ADMIN_UID=${userRecord.uid}`);
    console.log(`Please add SUPER_ADMIN_UID to your secure server environment variables if not already present.`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[BOOTSTRAP] ERROR:`, message);
    process.exit(1);
  }
}

async function bootstrap() {
  const args = process.argv.slice(2);
  isDryRun = args.includes("--dry-run");

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

  for (const email of SUPER_ADMIN_EMAILS) {
    await bootstrapOne(email);
  }
}

let isDryRun = false;
bootstrap();
