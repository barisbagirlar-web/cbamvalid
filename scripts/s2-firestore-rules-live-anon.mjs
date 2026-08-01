/**
 * S2 Release Mandate — anonymous/no-auth behavior against LIVE production rules.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envRaw = readFileSync(resolve(".env.production"), "utf8");
for (const line of envRaw.split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, collection, setDoc } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
for (const [k, v] of Object.entries(config)) {
  if (!v) throw new Error(`MISSING_ENV:${k}`);
}

const OTHER_ENT_ID = "ent_test_9bfaa6ff4194eb67fe9fa0876a0a363c2fc11588";
const results = [];

async function deny(name, fn) {
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

const app = initializeApp(config, "s2-anon");
const db = getFirestore(app);

await deny("no-auth read other-uid entitlement", () => getDoc(doc(db, "entitlements", OTHER_ENT_ID)));
await deny("no-auth read commerce_ledger", () => getDocs(collection(db, "commerce_ledger")));
await deny("no-auth read audit_events", () => getDocs(collection(db, "audit_events")));
await deny("no-auth read paddle_events", () => getDocs(collection(db, "paddle_events")));
await deny("no-auth write entitlement", () =>
  setDoc(doc(db, "entitlements", "forged-ent"), { uid: "hacker", status: "AVAILABLE" })
);
await deny("no-auth write case", () =>
  setDoc(doc(db, "cbam_cases", "forged-case"), { uid: "hacker" })
);

const pass = results.every((r) => r.pass);
console.log(JSON.stringify({ project: config.projectId, actor: "anonymous-no-auth", results }, null, 2));
if (!pass) {
  console.error("S2_LIVE_ANON_FAIL");
  process.exit(1);
}
console.log("S2_LIVE_ANON_PASS");
process.exit(0);
