/**
 * S2 Release Mandate — Firestore authorization matrix against LIVE production.
 *
 * Verifies deployed Firestore Rules behavior with the real client SDK:
 *   anonymous (no auth)        → DENY everywhere
 *   test-admin (custom token)  → own resource ALLOW, others DENY, write DENY
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env parser (no dotenv dependency in root).
const envRaw = readFileSync(resolve(".env.production"), "utf8");
for (const line of envRaw.split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { initializeApp as adminInit } from "firebase-admin/app";
import { getAuth as adminGetAuth } from "firebase-admin/auth";

const TEST_ADMIN_EMAIL = "teb232@gmail.com";
const OTHER_UID = "s4-concurrency-verify"; // existing entitlement doc owned by another uid
const OTHER_ENT_ID = "ent_test_9bfaa6ff4194eb67fe9fa0876a0a363c2fc11588";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

const config = {
  apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

const results = [];

async function expectDenied(name, fn) {
  try {
    await fn();
    results.push({ check: name, expected: "DENY", actual: "ALLOW", pass: false });
  } catch (error) {
    const code = error?.code || "";
    const msg = String(error?.message || error);
    const denied = code.includes("permission-denied") || msg.includes("PERMISSION_DENIED");
    results.push({ check: name, expected: "DENY", actual: denied ? "DENY" : `ERR(${code})`, pass: denied });
  }
}

async function expectAllowed(name, fn) {
  try {
    await fn();
    results.push({ check: name, expected: "ALLOW", actual: "ALLOW", pass: true });
  } catch (error) {
    const code = error?.code || "";
    results.push({ check: name, expected: "ALLOW", actual: `ERR(${code})`, pass: false });
  }
}

async function main() {
  const app = initializeApp(config, "s2-live");
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ---- Phase 0: no auth at all ----
  await expectDenyWithoutAuth("no-auth read entitlements (other uid doc)", () =>
    getDoc(doc(db, "entitlements", OTHER_ENT_ID))
  );
  await expectDenyWithoutAuth("no-auth read commerce_ledger", () =>
    getDocs(collection(db, "commerce_ledger"))
  );
  await expectDenyWithoutAuth("no-auth write entitlements", () =>
    setDoc(doc(db, "entitlements", "forged-ent"), { uid: "hacker", status: "AVAILABLE" })
  );
  await expectDenyWithoutAuth("no-auth read audit_events", () =>
    getDocs(collection(db, "audit_events"))
  );

  // ---- Phase 1: test-admin via admin-generated custom token ----
  const adminApp = adminInit({ projectId: config.projectId });
  const adminAuth = adminGetAuth(adminApp);
  const testUser = await adminAuth.getUserByEmail(TEST_ADMIN_EMAIL);
  const adminUid = testUser.uid;
  const customToken = await adminAuth.createCustomToken(adminUid);
  await signInWithCustomToken(auth, customToken);

  // Own entitlement document (provisioned on read path)
  await expectAllowed("test-admin own entitlements read", async () => {
    const snaps = await getDocs(query(collection(db, "entitlements"), where("uid", "==", adminUid)));
    return snaps; // own-scoped query must not be denied
  });

  await expectDenied("test-admin other uid entitlement read", () =>
    getDoc(doc(db, "entitlements", OTHER_ENT_ID))
  );
  await expectDenied("test-admin other-uid scoped query", () =>
    getDocs(query(collection(db, "entitlements"), where("uid", "==", OTHER_UID)))
  );
  await expectDenied("test-admin client create entitlement", () =>
    setDoc(doc(db, "entitlements", "forged-by-testadmin"), {
      uid: adminUid,
      status: "AVAILABLE",
      quantity: 99,
    })
  );
  await expectDenied("test-admin client update entitlement", async () => {
    const own = await getDocs(query(collection(db, "entitlements"), where("uid", "==", adminUid)));
    if (own.empty) throw new Error("NO_OWN_ENTITLEMENT");
    return setDoc(doc(db, "entitlements", own.docs[0].id), { status: "SEALED" }, { merge: true });
  });
  await expectDenied("test-admin read commerce_ledger", () =>
    getDocs(collection(db, "commerce_ledger"))
  );
  await expectDenied("test-admin read paddle_events", () =>
    getDocs(collection(db, "paddle_events"))
  );
  await expectDenied("test-admin read audit_events", () =>
    getDocs(collection(db, "audit_events"))
  );
  await expectDenied("test-admin read report_requests", () =>
    getDocs(collection(db, "report_requests"))
  );
  await expectDenied("test-admin read other user doc", () =>
    getDoc(doc(db, "users", OTHER_UID))
  );
  await expectAllowed("test-admin read own user doc", () =>
    getDoc(doc(db, "users", adminUid))
  );
  await expectDenied("test-admin write users tokens (client-side)", () =>
    setDoc(doc(db, "users", adminUid), { tokens: 500 }, { merge: true })
  );
  await expectDenied("test-admin read own creditLedger", () =>
    getDocs(collection(db, "users", adminUid, "creditLedger"))
  );
  await expectDenied("test-admin write creditSummary", () =>
    setDoc(doc(db, "users", adminUid, "creditSummary", "current"), { availableCredits: 9999 })
  );

  const pass = results.every((r) => r.pass);
  console.log(JSON.stringify({ project: config.projectId, actor: TEST_ADMIN_EMAIL, results }, null, 2));
  if (!pass) {
    console.error("S2_LIVE_RULES_FAIL");
    process.exit(1);
  }
  console.log("S2_LIVE_RULES_PASS");
  process.exit(0);
}

async function expectDenyWithoutAuth(name, fn) {
  try {
    await fn();
    results.push({ check: name, expected: "DENY", actual: "ALLOW", pass: false });
  } catch (error) {
    const code = error?.code || "";
    const msg = String(error?.message || error);
    const denied = code.includes("permission-denied") || msg.includes("PERMISSION_DENIED") || code === "unavailable";
    results.push({ check: name, expected: "DENY", actual: denied ? "DENY" : `ERR(${code})`, pass: denied });
  }
}

main().catch((error) => {
  console.error("S2_LIVE_RULES_ERROR", error);
  process.exit(2);
});
