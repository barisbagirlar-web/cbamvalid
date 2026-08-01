import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

const RULES = readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({
  projectId: "cbam-desk",
  firestore: { rules: RULES },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await db.doc("entitlements/ent_u1").set({ uid: "U1", status: "AVAILABLE", quantity: 1, orderId: "o1" });
  await db.doc("entitlements/ent_testadmin").set({ uid: "testadmin", status: "AVAILABLE", quantity: 1, orderId: "o3" });
});

const authCtx = env.authenticatedContext("U1");
const db = authCtx.firestore();

const snap = await db.doc("entitlements/ent_u1").get();
console.log("READ ent_u1 exists=", snap.exists, "data=", JSON.stringify(snap.data() || null));
const snap2 = await db.doc("entitlements/ent_testadmin").get();
console.log("READ ent_testadmin exists=", snap2.exists, "data=", JSON.stringify(snap2.data() || null));

try {
  await db.collection("entitlements").where("uid", "==", "U1").get();
  console.log("QUERY own ALLOW");
} catch (e) {
  console.log("QUERY own DENY", e.code);
}

await env.cleanup();
process.exit(0);
