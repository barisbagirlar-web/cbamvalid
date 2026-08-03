#!/usr/bin/env npx tsx

import crypto from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "cbam-desk";
const TARGET_EMAIL = "teb232@gmail.com";
const TARGET_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const TARGET_CREDITS = 100_000;
const EXECUTE = process.env.EXECUTE === "1";

function requireProject(): void {
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId;
  if (project !== PROJECT_ID) {
    throw new Error(`PROJECT_MISMATCH:${String(project || "MISSING")}`);
  }
}

function testAdminEntitlementId(uid: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`test-admin:${uid}`)
    .digest("hex")
    .slice(0, 40);
  return `ent_test_${digest}`;
}

async function main(): Promise<void> {
  requireProject();
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUserByEmail(TARGET_EMAIL);

  if (user.uid !== TARGET_UID) throw new Error(`UID_MISMATCH:${user.uid}`);
  if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

  const currentClaims = { ...(user.customClaims || {}) } as Record<string, unknown>;
  for (const key of [
    "admin",
    "ownerAdmin",
    "owner",
    "adminVersion",
    "superAdmin",
    "testAdmin",
    "pilot",
  ]) {
    delete currentClaims[key];
  }
  currentClaims.role = "customer";

  const userRef = db.collection("users").doc(TARGET_UID);
  const creditRef = userRef.collection("creditSummary").doc("current");
  const ledgerRef = userRef.collection("creditLedger").doc("teb232_customer_credit_grant_v1");
  const adminIdentityRef = db.collection("admin_identities").doc(TARGET_UID);
  const entitlementRef = db.collection("entitlements").doc(testAdminEntitlementId(TARGET_UID));

  const [creditSnapshot, adminIdentitySnapshot, entitlementSnapshot] = await Promise.all([
    creditRef.get(),
    adminIdentityRef.get(),
    entitlementRef.get(),
  ]);
  const currentCredits = Number(creditSnapshot.data()?.availableCredits || 0);
  const finalCredits = Math.max(currentCredits, TARGET_CREDITS);

  console.log(`PROJECT=${PROJECT_ID}`);
  console.log(`TARGET_EMAIL=${TARGET_EMAIL}`);
  console.log(`TARGET_UID=${TARGET_UID}`);
  console.log(`MODE=${EXECUTE ? "APPLY" : "DRY_RUN"}`);
  console.log(`CURRENT_ADMIN=${user.customClaims?.admin === true || user.customClaims?.ownerAdmin === true}`);
  console.log(`ADMIN_IDENTITY_EXISTS=${adminIdentitySnapshot.exists}`);
  console.log(`TEST_ADMIN_ENTITLEMENT_EXISTS=${entitlementSnapshot.exists}`);
  console.log(`CURRENT_CREDITS=${currentCredits}`);
  console.log(`FINAL_CREDITS=${finalCredits}`);

  if (!EXECUTE) {
    console.log("TEB232_CUSTOMER_CONVERSION=DRY_RUN_PASS");
    return;
  }

  await auth.setCustomUserClaims(TARGET_UID, currentClaims);
  await auth.revokeRefreshTokens(TARGET_UID);

  await db.runTransaction(async (transaction) => {
    const [freshCredit, freshLedger, freshEntitlement] = await Promise.all([
      transaction.get(creditRef),
      transaction.get(ledgerRef),
      transaction.get(entitlementRef),
    ]);
    const now = new Date().toISOString();
    const before = Number(freshCredit.data()?.availableCredits || 0);
    const after = Math.max(before, TARGET_CREDITS);

    transaction.set(userRef, {
      email: TARGET_EMAIL,
      role: "customer",
      admin: false,
      ownerAdmin: false,
      accessModel: "CUSTOMER_CREDIT_BALANCE",
      updatedAt: now,
    }, { merge: true });

    transaction.delete(adminIdentityRef);

    transaction.set(creditRef, {
      availableCredits: after,
      updatedAt: now,
      accessModel: "CUSTOMER_CREDIT_BALANCE",
    }, { merge: true });

    if (!freshLedger.exists && after > before) {
      transaction.create(ledgerRef, {
        uid: TARGET_UID,
        amount: after - before,
        type: "OWNER_CUSTOMER_CREDIT_GRANT",
        reason: "Teb232 customer-only product testing balance",
        createdAt: now,
        balanceAfter: after,
        syntheticTest: true,
      });
    }

    if (freshEntitlement.exists) {
      transaction.set(entitlementRef, {
        status: "REVOKED",
        revokedAt: now,
        updatedAt: now,
        revocationReason: "ACCOUNT_CONVERTED_TO_CUSTOMER_CREDIT_ACCESS",
      }, { merge: true });
    }
  });

  const verified = await auth.getUser(TARGET_UID);
  const claims = verified.customClaims || {};
  if (
    claims.admin === true ||
    claims.ownerAdmin === true ||
    claims.owner === true ||
    claims.role !== "customer"
  ) {
    throw new Error("CUSTOMER_CLAIM_READBACK_FAILED");
  }

  const [profileReadback, creditReadback, adminReadback, entitlementReadback] = await Promise.all([
    userRef.get(),
    creditRef.get(),
    adminIdentityRef.get(),
    entitlementRef.get(),
  ]);

  if (profileReadback.data()?.role !== "customer") throw new Error("CUSTOMER_PROFILE_READBACK_FAILED");
  if (Number(creditReadback.data()?.availableCredits || 0) < TARGET_CREDITS) {
    throw new Error("CUSTOMER_CREDIT_READBACK_FAILED");
  }
  if (adminReadback.exists) throw new Error("ADMIN_IDENTITY_DELETE_FAILED");
  if (entitlementReadback.exists && entitlementReadback.data()?.status !== "REVOKED") {
    throw new Error("TEST_ADMIN_ENTITLEMENT_REVOKE_FAILED");
  }

  console.log("ADMIN_CLAIMS=REMOVED");
  console.log("ADMIN_IDENTITY=REMOVED");
  console.log("TEST_ADMIN_ENTITLEMENT=REVOKED");
  console.log(`CUSTOMER_CREDITS=${Number(creditReadback.data()?.availableCredits || 0)}`);
  console.log("REFRESH_TOKENS=REVOKED");
  console.log("TEB232_CUSTOMER_CONVERSION=PASS");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
