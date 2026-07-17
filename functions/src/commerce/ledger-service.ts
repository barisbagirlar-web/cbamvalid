import crypto from "crypto";
import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";

export interface LedgerEntry {
  entryId: string;
  uid: string;
  orderId: string;
  transactionId: string;
  eventId: string;
  type:
    | "PAYMENT_CAPTURED"
    | "ENTITLEMENT_ISSUED"
    | "ENTITLEMENT_RESERVED"
    | "ENTITLEMENT_CONSUMED"
    | "ENTITLEMENT_RELEASED"
    | "REFUND_APPROVED"
    | "ENTITLEMENT_REVOKED"
    | "MANUAL_ADJUSTMENT";
  quantity: number;
  currency?: string;
  amountMinor?: number;
  createdAt: string;
  idempotencyKey: string;
  previousEntryHash?: string;
  entryHash: string;
}

/**
 * Computes SHA-256 hash for a ledger entry to enforce chain security
 */
export function calculateEntryHash(entry: Omit<LedgerEntry, "entryHash">): string {
  const dataString = JSON.stringify({
    entryId: entry.entryId,
    uid: entry.uid,
    orderId: entry.orderId,
    transactionId: entry.transactionId,
    eventId: entry.eventId,
    type: entry.type,
    quantity: entry.quantity,
    currency: entry.currency || "",
    amountMinor: entry.amountMinor || 0,
    createdAt: entry.createdAt,
    idempotencyKey: entry.idempotencyKey,
    previousEntryHash: entry.previousEntryHash || "",
  });
  return crypto.createHash("sha256").update(dataString).digest("hex");
}

export interface LedgerReadCache {
  idempotencySnapshot: admin.firestore.QuerySnapshot;
  latestSnapshot: admin.firestore.QuerySnapshot;
}
/**
 * Pre-fetch all reads required by writeLedgerEntry before any writes happen in the
 * same transaction. Pass the returned cache into writeLedgerEntry to avoid the
 * Firestore "reads before writes" constraint.
 */
export async function prefetchLedgerReads(
  dbTransaction: admin.firestore.Transaction,
  idempotencyKey: string
): Promise<LedgerReadCache> {
  const ledgerCollection = adminDb.collection("commerce_ledger");
  const idempotencyRef = adminDb.collection("idempotency").doc(idempotencyKey);
  const [idempotencySnapshot, latestSnapshot] = await Promise.all([
    dbTransaction.get(idempotencyRef),
    dbTransaction.get(ledgerCollection.orderBy("createdAt", "desc").limit(1)),
  ]);
  return { idempotencySnapshot, latestSnapshot } as any;
}

/**
 * Appends a new entry to the immutable commerce ledger within a transaction context.
 * Supply a `readCache` (from prefetchLedgerReads) when this function is called after
 * writes have already been queued in the same transaction.
 */
export async function writeLedgerEntry(
  dbTransaction: admin.firestore.Transaction,
  entryParams: Omit<LedgerEntry, "entryId" | "createdAt" | "previousEntryHash" | "entryHash">,
  readCache?: LedgerReadCache
): Promise<LedgerEntry> {
  const ledgerCollection = adminDb.collection("commerce_ledger");

  // 1. Check idempotency — use pre-fetched snapshot if available
  const idempotencyDoc = readCache
    ? (readCache.idempotencySnapshot as any)
    : await dbTransaction.get(adminDb.collection("idempotency").doc(entryParams.idempotencyKey));

  const exists = idempotencyDoc && (
    typeof idempotencyDoc.exists === 'boolean'
      ? idempotencyDoc.exists
      : (typeof idempotencyDoc.empty === 'boolean' ? !idempotencyDoc.empty : false)
  );

  if (exists) {
    const doc = typeof idempotencyDoc.exists === 'boolean' ? idempotencyDoc : idempotencyDoc.docs[0];
    const entryId = doc.data()?.ledgerEntryId || doc.data()?.entryId;
    if (entryId) {
      const existingDoc = await dbTransaction.get(ledgerCollection.doc(entryId));
      if (existingDoc.exists) {
        return existingDoc.data() as LedgerEntry;
      }
    }
    return doc.data() as LedgerEntry;
  }

  // 2. Fetch the latest ledger entry for chain link — use pre-fetched snapshot if available
  const latestSnapshot = readCache
    ? readCache.latestSnapshot
    : await dbTransaction.get(ledgerCollection.orderBy("createdAt", "desc").limit(1));

  let previousEntryHash = "";
  if (!latestSnapshot.empty) {
    const latestDoc = latestSnapshot.docs[0].data() as LedgerEntry;
    previousEntryHash = latestDoc.entryHash;
  }

  // 3. Construct and write the new entry
  const entryId = ledgerCollection.doc().id;
  const createdAt = new Date().toISOString();
  const entryData: Omit<LedgerEntry, "entryHash"> = { ...entryParams, entryId, createdAt, previousEntryHash };
  const entryHash = calculateEntryHash(entryData);
  const finalEntry: LedgerEntry = { ...entryData, entryHash };
  dbTransaction.set(ledgerCollection.doc(entryId), finalEntry);

  // Register the idempotency key to document level lock!
  const idempotencyRef = adminDb.collection("idempotency").doc(entryParams.idempotencyKey);
  dbTransaction.set(idempotencyRef, {
    processedAt: createdAt,
    ledgerEntryId: entryId,
    type: entryParams.type,
  });

  return finalEntry;
}
