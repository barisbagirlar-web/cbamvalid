import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

async function main() {
  const txnId = "test_b0c8be18dd431106076338939fb";
  console.log(`=== Searching for transaction: ${txnId} ===`);

  // Search commerce_orders
  console.log("\nSearching commerce_orders...");
  const orderDocs = await db.collection("commerce_orders").get();
  orderDocs.forEach(doc => {
    const data = doc.data();
    if (JSON.stringify(data).includes(txnId) || doc.id.includes(txnId)) {
      console.log(`FOUND ORDER [${doc.id}]:`, data);
    }
  });

  // Search entitlements
  console.log("\nSearching entitlements...");
  const entitlementDocs = await db.collection("entitlements").get();
  entitlementDocs.forEach(doc => {
    const data = doc.data();
    if (JSON.stringify(data).includes(txnId) || doc.id.includes(txnId)) {
      console.log(`FOUND ENTITLEMENT [${doc.id}]:`, data);
    }
  });

  // Search commerce_ledger
  console.log("\nSearching commerce_ledger...");
  const ledgerDocs = await db.collection("commerce_ledger").get();
  ledgerDocs.forEach(doc => {
    const data = doc.data();
    if (JSON.stringify(data).includes(txnId) || doc.id.includes(txnId)) {
      console.log(`FOUND LEDGER ENTRY [${doc.id}]:`, data);
    }
  });

  // Search idempotency
  console.log("\nSearching idempotency...");
  const idempotencyDocs = await db.collection("idempotency").get();
  idempotencyDocs.forEach(doc => {
    const data = doc.data();
    if (JSON.stringify(data).includes(txnId) || doc.id.includes(txnId)) {
      console.log(`FOUND IDEMPOTENCY LOCK [${doc.id}]:`, data);
    }
  });
}

main().catch(err => {
  console.error("Error:", err);
});
