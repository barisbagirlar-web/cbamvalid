/**
 * S2 Release Mandate — Firestore rules authorization matrix (emulator).
 *
 * Runs against the LOCAL firestore.rules which was verified byte-identical to
 * the ruleset deployed on production (project cbam-desk, 2026-07-22).
 */
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

const RULES = readFileSync("firestore.rules", "utf8");
const PROJECT = "cbam-desk";

const results = [];
function record(name, expected, actual, pass) {
  results.push({ check: name, expected, actual, pass });
}
async function deny(name, fn) {
  try {
    await fn();
    record(name, "DENY", "ALLOW", false);
  } catch (error) {
    const code = error?.code || "";
    const msg = String(error?.message || error);
    const denied = code.includes("permission-denied") || msg.includes("PERMISSION_DENIED");
    record(name, "DENY", denied ? "DENY" : `ERR(${code})`, denied);
  }
}
async function allow(name, fn) {
  try {
    await fn();
    record(name, "ALLOW", "ALLOW", true);
  } catch (error) {
    const code = error?.code || "";
    record(name, "ALLOW", `ERR(${code})`, false);
  }
}

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: RULES },
});

// Seed backend-owned docs bypassing rules (simulates server-side state).
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const seed = (path, data) => db.doc(path).set(data);
  await seed("users/U1", { role: "user", tokens: 0 });
  await seed("users/U2", { role: "user", tokens: 0 });
  await seed("users/testadmin", { role: "user", tokens: 0 });
  await seed("entitlements/ent_u1", { uid: "U1", status: "AVAILABLE", quantity: 1, orderId: "o1" });
  await seed("entitlements/ent_u2", { uid: "U2", status: "AVAILABLE", quantity: 1, orderId: "o2" });
  await seed("entitlements/ent_testadmin", { uid: "testadmin", status: "AVAILABLE", quantity: 1, orderId: "o3" });
  await seed("cases/case_u1", { uid: "U1", title: "c1" });
  await seed("cases/case_u2", { uid: "U2", title: "c2" });
  await seed("reports/rep_u1", { uid: "U1" });
  await seed("reports/rep_u2", { uid: "U2" });
  await seed("commerce_ledger/ledger1", { uid: "U1", type: "PAYMENT_CAPTURED", entryHash: "x" });
  await seed("paddle_events/evt1", { eventId: "evt1" });
  await seed("audit_events/audit1", { action: "test" });
  await seed("report_requests/rr1", { uid: "U1" });
});

const actors = [
  { name: "anonymous", ctx: env.unauthenticatedContext() },
  { name: "normal-user", ctx: env.authenticatedContext("U1") },
  { name: "test-admin", ctx: env.authenticatedContext("testadmin", { email: "teb232@gmail.com", email_verified: true }) },
  { name: "revoked-user", ctx: env.authenticatedContext("REVOKED") }, // stale/revoked session behaves as unknown uid
];

for (const { name, ctx } of actors) {
  const db = ctx.firestore();
  const isOwn = name === "normal-user";
  const ownUid = isOwn ? "U1" : name === "test-admin" ? "testadmin" : null;

  // 1. Own resource read (where policy allows)
  if (ownUid) {
    await allow(`${name} read own entitlement`, () => db.doc("entitlements/ent_" + ownUid.toLowerCase()).get());
    await allow(`${name} read own user doc`, () => db.doc("users/" + ownUid).get());
  } else {
    await deny(`${name} read own entitlement (no identity)`, () => db.doc("entitlements/ent_u1").get());
    await deny(`${name} read own user doc (no identity)`, () => db.doc("users/U1").get());
  }

  // 2. Other-user resource read
  await deny(`${name} read other entitlement`, () => db.doc("entitlements/ent_u2").get());
  await deny(`${name} read other case`, () => db.doc("cases/case_u2").get());
  await deny(`${name} read other report`, () => db.doc("reports/rep_u2").get());
  await deny(`${name} read other user doc`, () => db.doc("users/U2").get());

  // 3. Client writes (create/update/delete) always denied
  await deny(`${name} create entitlement`, () => db.doc("entitlements/forged").set({ uid: ownUid || "X", status: "AVAILABLE" }));
  await deny(`${name} update entitlement`, () => db.doc("entitlements/ent_u1").set({ status: "SEALED" }, { merge: true }));
  await deny(`${name} delete entitlement`, () => db.doc("entitlements/ent_u1").delete());
  await deny(`${name} create case`, () => db.doc("cases/forged").set({ uid: ownUid || "X" }));
  await deny(`${name} write report`, () => db.doc("reports/rep_u1").set({ uid: "U1" }, { merge: true }));
  await deny(`${name} create user`, () => db.doc("users/" + (ownUid || "X")).set({ role: "super_admin" }));

  // 4. Protected/backoffice collections — always deny for clients
  await deny(`${name} read commerce_ledger`, () => db.doc("commerce_ledger/ledger1").get());
  await deny(`${name} write commerce_ledger`, () => db.doc("commerce_ledger/forged").set({ uid: "U1" }));
  await deny(`${name} read paddle_events`, () => db.doc("paddle_events/evt1").get());
  await deny(`${name} read audit_events`, () => db.doc("audit_events/audit1").get());
  await deny(`${name} read report_requests`, () => db.doc("report_requests/rr1").get());

  // 5. Collection query ownership bypass
  await deny(`${name} query all entitlements`, () => db.collection("entitlements").get());
  if (ownUid) {
    await allow(`${name} own-scoped entitlement query`, () =>
      db.collection("entitlements").where("uid", "==", ownUid).get()
    );
    await deny(`${name} cross-uid entitlement query`, () =>
      db.collection("entitlements").where("uid", "==", "U2").get()
    );
  }
}

await env.cleanup();
const pass = results.every((r) => r.pass);
console.log(JSON.stringify({ project: PROJECT, results }, null, 2));
if (!pass) {
  console.error("S2_RULES_MATRIX_FAIL");
  process.exit(1);
}
console.log("S2_RULES_MATRIX_PASS");
process.exit(0);
