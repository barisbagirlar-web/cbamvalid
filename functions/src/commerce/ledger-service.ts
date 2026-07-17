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
  const [idempotencySnapshot, latestSnapshot] = await Promise.all([
    dbTransaction.get(ledgerCollection.where("idempotencyKey", "==", idempotencyKey).limit(1)),
    dbTransaction.get(ledgerCollection.orderBy("createdAt", "desc").limit(1)),
  ]);
  return { idempotencySnapshot, latestSnapshot };
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
  const idempotencySnapshot = readCache
    ? readCache.idempotencySnapshot
    : await dbTransaction.get(ledgerCollection.where("idempotencyKey", "==", entryParams.idempotencyKey).limit(1));

  if (!idempotencySnapshot.empty) {
    const doc = idempotencySnapshot.docs[0];
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
  return finalEntry;
}

