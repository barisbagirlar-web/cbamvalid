import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

const PROJ = "demo-cbam-test";
const BUCKET = "demo-cbam-test.firebasestorage.app";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n%CBAM\n"), Buffer.alloc(256, 1)]);
const EXE = Buffer.concat([Buffer.from("MZ\x90\x00\x03"), Buffer.alloc(100, 1)]);
const ZERO = Buffer.alloc(0);
const HUGE = Buffer.alloc(21 * 1024 * 1024);

let pass = 0, fail = 0;
function expect(pred, label) {
  if (pred) { pass++; } else { fail++; console.log(`FAIL: ${label}`); }
}

console.log("[S9] loading real storage.rules + permissive firestore rules (backend ownsCase bridge)");
const env = await initializeTestEnvironment({
  projectId: PROJ,
  firestore: {
    host: "127.0.0.1", port: 8080,
    rules: readFileSync(new URL("./firestore-rules-permissive.rules", import.meta.url), "utf8"),
  },
  storage: {
    host: "127.0.0.1", port: 9199,
    rules: readFileSync(new URL("../storage.rules", import.meta.url), "utf8"),
  },
});

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await db.doc("cbam_cases/case_a").set({ uid: "userA", status: "DRAFT" });
  await db.doc("cbam_cases/case_b").set({ uid: "userB", status: "DRAFT" });
});

const anon = env.unauthenticatedContext();
const userA = env.authenticatedContext("userA", { email: "a@test.com", email_verified: true });
const userB = env.authenticatedContext("userB", { email: "b@test.com", email_verified: true });

const ref = (u, path) => u.storage(BUCKET).ref(path);
const meta = (ownerId, caseId, evidenceId) => ({ contentType: "application/pdf", customMetadata: { ownerId, caseId, evidenceId, sha256: "a".repeat(64) } });

// ---- 1. Case ownership: userA uploads own case evidence -> ALLOW
try {
  await assertSucceeds(ref(userA, "evidence/userA/case_a/ev1/f.pdf").put(PDF, meta("userA", "case_a", "ev1")));
  expect(true, "1. userA uploads own-case evidence");
} catch (e) { expect(false, `1. userA uploads own-case evidence: ${e}`); }

// ---- 2. Wrong owner rejection: userB uploads into userA's case path -> DENY
try {
  await assertFails(ref(userB, "evidence/userA/case_a/ev2/g.pdf").put(PDF, meta("userA", "case_a", "ev2")));
  expect(true, "2. userB upload into userA case path denied");
} catch (e) { expect(false, `2. userB upload into userA case path denied: ${e}`); }

// ---- 3. Wrong path: userA uploads evidence claiming case_b (owned by userB) -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_b/ev3/h.pdf").put(PDF, meta("userA", "case_b", "ev3")));
  expect(true, "3. userA upload into foreign case path denied");
} catch (e) { expect(false, `3. userA upload into foreign case path denied: ${e}`); }

// ---- 4. Metadata spoof: ownerId metadata mismatch -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev4/i.pdf").put(PDF, meta("userB", "case_a", "ev4")));
  expect(true, "4. spoofed ownerId metadata denied");
} catch (e) { expect(false, `4. spoofed ownerId metadata denied: ${e}`); }

// ---- 5. Metadata caseId mismatch -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev5/j.pdf").put(PDF, { contentType: "application/pdf", customMetadata: { ownerId: "userA", caseId: "case_b", evidenceId: "ev5", sha256: "a".repeat(64) } }));
  expect(true, "5. spoofed caseId metadata denied");
} catch (e) { expect(false, `5. spoofed caseId metadata denied: ${e}`); }

// ---- 6. Metadata evidenceId mismatch -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev6/k.pdf").put(PDF, { contentType: "application/pdf", customMetadata: { ownerId: "userA", caseId: "case_a", evidenceId: "different", sha256: "a".repeat(64) } }));
  expect(true, "6. spoofed evidenceId metadata denied");
} catch (e) { expect(false, `6. spoofed evidenceId metadata denied: ${e}`); }

// ---- 7. Invalid sha256 -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev7/l.pdf").put(PDF, { contentType: "application/pdf", customMetadata: { ownerId: "userA", caseId: "case_a", evidenceId: "ev7", sha256: "not-a-hash" } }));
  expect(true, "7. invalid sha256 denied");
} catch (e) { expect(false, `7. invalid sha256 denied: ${e}`); }

// ---- 8. Unsupported content type -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev8/m.bin").put(EXE, { contentType: "application/x-msdownload", customMetadata: { ownerId: "userA", caseId: "case_a", evidenceId: "ev8", sha256: "a".repeat(64) } }));
  expect(true, "8. unsupported content-type denied");
} catch (e) { expect(false, `8. unsupported content-type denied: ${e}`); }

// ---- 9. Zero-byte rejection -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev9/n.pdf").put(ZERO, meta("userA", "case_a", "ev9")));
  expect(true, "9. zero-byte upload denied");
} catch (e) { expect(false, `9. zero-byte upload denied: ${e}`); }

// ---- 10. Over-limit file size -> DENY
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev10/o.pdf").put(HUGE, meta("userA", "case_a", "ev10")));
  expect(true, "10. 21MB upload denied");
} catch (e) { expect(false, `10. 21MB upload denied: ${e}`); }

// ---- 11. MIME spoof: .exe bytes declared as pdf -> rules-level cannot detect magic bytes (server verifies); content-type is pdf so rule allows; verify server-side magic-byte guard separately
try {
  await assertSucceeds(ref(userA, "evidence/userA/case_a/ev11/p.pdf").put(EXE, { contentType: "application/pdf", customMetadata: { ownerId: "userA", caseId: "case_a", evidenceId: "ev11", sha256: "a".repeat(64) } }));
  expect(true, "11. MIME-spoof file uploads at rules layer (magic-byte enforcement is server-side)");
} catch (e) { expect(false, `11. MIME-spoof file upload at rules layer: ${e}`); }

// ---- 12. Overwrite policy: existing object cannot be updated (update: false) -> DENY
// NOTE: emulator treats a second put() to an existing path as create; the
// authoritative overwrite gate is the `update: if false` rule, tested via updateMetadata.
try {
  await assertFails(ref(userA, "evidence/userA/case_a/ev1/f.pdf").updateMetadata({ contentType: "application/pdf" }));
  expect(true, "12. update (overwrite) of existing evidence denied");
} catch (e) { expect(false, `12. update (overwrite) of existing evidence denied: ${e}`); }

// ---- 13. Anonymous read of own-path evidence -> DENY
try {
  await assertFails(ref(anon, "evidence/userA/case_a/ev1/f.pdf").getMetadata());
  expect(true, "13. anonymous read denied");
} catch (e) { expect(false, `13. anonymous read denied: ${e}`); }

// ---- 14. Anonymous upload -> DENY
try {
  await assertFails(ref(anon, "evidence/userA/case_a/ev12/q.pdf").put(PDF, meta("userA", "case_a", "ev12")));
  expect(true, "14. anonymous upload denied");
} catch (e) { expect(false, `14. anonymous upload denied: ${e}`); }

// ---- 15. userB read of userA evidence -> DENY
try {
  await assertFails(ref(userB, "evidence/userA/case_a/ev1/f.pdf").getMetadata());
  expect(true, "15. cross-user read denied");
} catch (e) { expect(false, `15. cross-user read denied: ${e}`); }

// ---- 16. userA read of own evidence -> ALLOW
try {
  await assertSucceeds(ref(userA, "evidence/userA/case_a/ev1/f.pdf").getMetadata());
  expect(true, "16. owner reads own evidence");
} catch (e) { expect(false, `16. owner reads own evidence: ${e}`); }

// ---- 17. userA delete own evidence -> ALLOW
try {
  await assertSucceeds(ref(userA, "evidence/userA/case_a/ev11/p.pdf").delete());
  expect(true, "17. owner deletes own evidence");
} catch (e) { expect(false, `17. owner deletes own evidence: ${e}`); }

// ---- 18. userB delete userA evidence -> DENY
try {
  await assertFails(ref(userB, "evidence/userA/case_a/ev1/f.pdf").delete());
  expect(true, "18. cross-user delete denied");
} catch (e) { expect(false, `18. cross-user delete denied: ${e}`); }

// ---- 19. Outside evidence path (other than /evidence) -> DENY
try {
  await assertFails(ref(userA, "some/other/userA/case_a/x.pdf").put(PDF, meta("userA", "case_a", "x")));
  expect(true, "19. non-evidence path write denied");
} catch (e) { expect(false, `19. non-evidence path write denied: ${e}`); }

// ---- 20/21. reports path: admin seeds report object, owner read ALLOW / cross-user read DENY
await env.withSecurityRulesDisabled(async (context) => {
  const st = context.storage(BUCKET);
  await st.ref("reports/userA/r1/report.pdf").put(PDF, { contentType: "application/pdf" });
});
try {
  await assertSucceeds(ref(userA, "reports/userA/r1/report.pdf").getMetadata());
  expect(true, "20. owner reads own report path");
} catch (e) { expect(false, `20. owner reads own report path: ${e}`); }
try {
  await assertFails(ref(userB, "reports/userA/r1/report.pdf").getMetadata());
  expect(true, "21. cross-user report read denied");
} catch (e) { expect(false, `21. cross-user report read denied: ${e}`); }

console.log(`[S9] RESULT pass=${pass} fail=${fail}`);
await env.cleanup();
process.exit(fail === 0 ? 0 : 1);
