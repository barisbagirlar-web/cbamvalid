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

/**
 * Appends a new entry to the immutable commerce ledger within a transaction context
 */
export async function writeLedgerEntry(
  dbTransaction: admin.firestore.Transaction,
  entryParams: Omit<LedgerEntry, "entryId" | "createdAt" | "previousEntryHash" | "entryHash">
): Promise<LedgerEntry> {
  const ledgerCollection = adminDb.collection("commerce_ledger");

  // 1. Check if an entry with this idempotency key already exists to prevent duplicate operations
  const existingQuery = await dbTransaction.get(
    ledgerCollection.where("idempotencyKey", "==", entryParams.idempotencyKey).limit(1)
  );

  if (!existingQuery.empty) {
    const doc = existingQuery.docs[0];
    return doc.data() as LedgerEntry;
  }

  // 2. Fetch the latest ledger entry to construct the chain link
  const latestSnapshot = await dbTransaction.get(
    ledgerCollection.orderBy("createdAt", "desc").limit(1)
  );

  let previousEntryHash = "";
  if (!latestSnapshot.empty) {
    const latestDoc = latestSnapshot.docs[0].data() as LedgerEntry;
    previousEntryHash = latestDoc.entryHash;
  }

  // 3. Construct the new entry
  const entryId = ledgerCollection.doc().id;
  const createdAt = new Date().toISOString();

  const entryData: Omit<LedgerEntry, "entryHash"> = {
    ...entryParams,
    entryId,
    createdAt,
    previousEntryHash,
  };

  const entryHash = calculateEntryHash(entryData);
  const finalEntry: LedgerEntry = {
    ...entryData,
    entryHash,
  };

  // 4. Save to firestore within the transactional context
  dbTransaction.set(ledgerCollection.doc(entryId), finalEntry);

  return finalEntry;
}
