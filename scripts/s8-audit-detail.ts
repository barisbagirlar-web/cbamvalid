import { adminDb } from "../functions/build/firebase-admin.js";

type LedgerEntry = { id: string } & Record<string, unknown>;
type EntitlementEntry = { id: string } & Record<string, unknown>;

async function main() {
  const [ledgerDocs, entitlementDocs] = await Promise.all([
    adminDb.collection("commerce_ledger").orderBy("createdAt", "asc").get(),
    adminDb.collection("entitlements").get(),
  ]);
  const ledger: LedgerEntry[] = ledgerDocs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entitlements: EntitlementEntry[] = entitlementDocs.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log("=== ENTITLEMENTS WITHOUT ISSUED LEDGER ===");
  const issuedPairs = new Set(ledger.filter((e) => e.type === "ENTITLEMENT_ISSUED").map((e) => `${e.uid}|${e.orderId}`));
  for (const e of entitlements.filter((e) => !issuedPairs.has(`${e.uid}|${e.orderId}`))) {
    console.log(JSON.stringify({ id: e.id, uid: e.uid, orderId: e.orderId, status: e.status, billingModel: e.billingModel, syntheticTest: e.syntheticTest, createdAt: e.createdAt }));
  }

  console.log("\n=== ORPHAN LEDGER ENTRIES (detail) ===");
  const entPairs = new Set(entitlements.map((e) => `${e.uid}|${e.orderId}`));
  for (const entry of ledger.filter((e) =>
    ["PAYMENT_CAPTURED", "ENTITLEMENT_ISSUED", "ENTITLEMENT_RESERVED", "ENTITLEMENT_CONSUMED"].includes(String(e.type)) &&
    !entPairs.has(`${e.uid}|${e.orderId}`))) {
    console.log(JSON.stringify({ entryId: entry.entryId, type: entry.type, uid: entry.uid, orderId: entry.orderId, transactionId: entry.transactionId, syntheticTest: entry.syntheticTest, createdAt: entry.createdAt }));
  }

  console.log("\n=== HASH CHAIN — break candidates ===");
  const hashes = new Set(ledger.map((e) => String(e.entryHash)));
  for (const entry of ledger) {
    const prev = String(entry.previousEntryHash || "");
    if (prev && !hashes.has(prev)) {
      console.log(JSON.stringify({ entryId: entry.entryId, type: entry.type, createdAt: entry.createdAt, prevHash: prev.slice(0, 16), syntheticTest: entry.syntheticTest }));
    }
  }

  console.log("\n=== TOTALS ===");
  console.log(JSON.stringify({ ledgerTotal: ledger.length, entitlementTotal: entitlements.length }));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
