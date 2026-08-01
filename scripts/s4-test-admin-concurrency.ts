/**
 * S4 Release Mandate — Test-Admin Bypass concurrency/idempotency verification.
 *
 * Runs ensureTestAdminEntitlement 20x concurrently against production Firestore
 * and asserts exactly one entitlement + one synthetic ledger entry are produced.
 * Uses the same compiled production code path (functions/build) that is deployed.
 */
import { adminDb } from "../functions/build/firebase-admin.js";
import { ensureTestAdminEntitlement } from "../functions/build/commerce/test-admin-access.js";

const PROJECT = "cbam-desk";
const TEST_UID = "s4-concurrency-verify";
const TEST_EMAIL = "s4-verify@cbamvalid.test";

async function main() {
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      adminDb.runTransaction((tx) => ensureTestAdminEntitlement(tx, TEST_UID, TEST_EMAIL))
    )
  );

  const entitlementDocs = await adminDb
    .collection("entitlements")
    .where("uid", "==", TEST_UID)
    .get();
  const ledgerDocs = await adminDb
    .collection("commerce_ledger")
    .where("uid", "==", TEST_UID)
    .get();

  const entitlementIds = entitlementDocs.docs.map((d) => d.id);
  const ledgerIds = ledgerDocs.docs.map((d) => d.id);
  const idempotencyKeys = ledgerDocs.docs.map((d) => d.data().idempotencyKey as string);
  const uniqueKeys = new Set(idempotencyKeys);

  const synthetic = ledgerDocs.docs.every((d) => d.data().syntheticTest === true);
  const envSandbox = ledgerDocs.docs.every((d) => d.data().environment === "sandbox");

  const report = {
    project: PROJECT,
    testUid: TEST_UID,
    parallelCalls: 20,
    elapsedMs: Date.now() - started,
    callResults: results.length,
    uniqueCallResults: new Set(results.map((r) => r.entitlementId)).size,
    entitlementCount: entitlementIds.length,
    entitlementIds,
    ledgerEntryCount: ledgerIds.length,
    ledgerIds,
    uniqueIdempotencyKeys: uniqueKeys.size,
    allLedgerSynthetic: synthetic,
    allLedgerSandbox: envSandbox,
    pass: entitlementIds.length === 1 && ledgerIds.length === 1 && uniqueKeys.size === 1 && synthetic && envSandbox,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error("S4_CONCURRENCY_FAIL");
    process.exit(1);
  }
  console.log("S4_CONCURRENCY_PASS");
  process.exit(0);
}

main().catch((error) => {
  console.error("S4_CONCURRENCY_ERROR", error);
  process.exit(2);
});
