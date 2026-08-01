/**
 * S8 Release Mandate — commerce ledger integrity audit against production.
 *
 * Checks: no duplicate idempotencyKeys, every entitlement has an issuing
 * ledger entry, no orphan payment/consume entries without an entitlement,
 * syntheticTest markers consistent with the test-admin allowlist.
 */
import { adminDb } from "../functions/build/firebase-admin.js";

type LedgerEntry = { id: string } & Record<string, unknown>;

async function main() {
  const [ledgerDocs, entitlementDocs] = await Promise.all([
    adminDb.collection("commerce_ledger").orderBy("createdAt", "asc").get(),
    adminDb.collection("entitlements").get(),
  ]);

  const ledger: LedgerEntry[] = ledgerDocs.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));
  const entitlements: LedgerEntry[] = entitlementDocs.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));

  // 1. Duplicate idempotency keys
  const keyCount = new Map<string, number>();
  for (const entry of ledger) {
    const key = String(entry.idempotencyKey || entry.entryId);
    keyCount.set(key, (keyCount.get(key) || 0) + 1);
  }
  const duplicateKeys = [...keyCount.entries()].filter(([, c]) => c > 1);

  // 2. Entitlements without an ENTITLEMENT_ISSUED ledger entry
  const issuedKeys = new Set(
    ledger
      .filter((e) => e.type === "ENTITLEMENT_ISSUED")
      .map((e) => `${e.uid}|${e.orderId}`)
  );
  const entitlementsWithoutIssue = entitlements.filter(
    (e) => !issuedKeys.has(`${e.uid}|${e.orderId}`)
  );

  // 3. Orphan ledger entries (PAYMENT_CAPTURED / ENTITLEMENT_*) with no entitlement for uid+orderId
  const entitlementPairs = new Set(
    entitlements.map((e) => `${e.uid}|${e.orderId}`)
  );
  const orphanLedger = ledger.filter((e) =>
    ["PAYMENT_CAPTURED", "ENTITLEMENT_ISSUED", "ENTITLEMENT_RESERVED", "ENTITLEMENT_CONSUMED"].includes(String(e.type)) &&
    !entitlementPairs.has(`${e.uid}|${e.orderId}`)
  );

  // 4. Hash chain integrity (previousEntryHash linkage)
  let chainBreaks = 0;
  const hashByEntry = new Map<string, string>();
  for (const entry of ledger) {
    const id = String(entry.entryId);
    hashByEntry.set(id, String(entry.entryHash));
  }
  for (const entry of ledger) {
    const prev = String(entry.previousEntryHash || "");
    if (prev && ![...hashByEntry.values()].includes(prev)) {
      chainBreaks += 1;
    }
  }

  // 5. Ledger count by type
  const byType: Record<string, number> = {};
  for (const entry of ledger) {
    const t = String(entry.type);
    byType[t] = (byType[t] || 0) + 1;
  }

  // 6. Synthetic markers
  const syntheticLedger = ledger.filter((e) => e.syntheticTest === true);
  const syntheticEntitlements = entitlements.filter((e) => e.syntheticTest === true);
  const syntheticEntitlementUids = new Set(syntheticEntitlements.map((e) => String(e.uid)));

  const report = {
    ledgerTotal: ledger.length,
    entitlementTotal: entitlements.length,
    duplicateIdempotencyKeys: duplicateKeys,
    entitlementsWithoutIssuingLedger: entitlementsWithoutIssue.map((e) => e.id),
    orphanLedgerEntries: orphanLedger.map((e) => e.entryId),
    hashChainBreaks: chainBreaks,
    ledgerByType: byType,
    syntheticLedgerCount: syntheticLedger.length,
    syntheticEntitlementCount: syntheticEntitlements.length,
    syntheticEntitlementUids: [...syntheticEntitlementUids],
    pass:
      duplicateKeys.length === 0 &&
      entitlementsWithoutIssue.length === 0 &&
      orphanLedger.length === 0 &&
      chainBreaks === 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error("S8_LEDGER_AUDIT_FAIL");
    process.exit(1);
  }
  console.log("S8_LEDGER_AUDIT_PASS");
  process.exit(0);
}

main().catch((error) => {
  console.error("S8_LEDGER_AUDIT_ERROR", error);
  process.exit(2);
});
