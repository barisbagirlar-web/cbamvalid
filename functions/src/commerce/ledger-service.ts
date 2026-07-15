import crypto from "node:crypto";
import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";

export interface LedgerEntry {
  entryId: string;
  uid: string;
  orderId: string;
  transactionId: string;
  eventId: string;
  type:
    | "PAYMENT_CAPTURED"
    | "CREDITS_GRANTED"
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
  previousEntryHash: string;
  entryHash: string;
}

interface LedgerHead {
  entryId: string;
  entryHash: string;
  sequence: number;
  updatedAt: string;
}

export interface PreparedLedgerEntry {
  entry: LedgerEntry;
  entryRef: admin.firestore.DocumentReference;
  headRef: admin.firestore.DocumentReference;
  nextHead: LedgerHead;
  idempotentReplay: boolean;
}

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
    previousEntryHash: entry.previousEntryHash,
  });
  return crypto.createHash("sha256").update(dataString).digest("hex");
}

function deterministicEntryId(idempotencyKey: string): string {
  return `led_${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`;
}

export async function prepareLedgerEntry(
  transaction: admin.firestore.Transaction,
  entryParams: Omit<LedgerEntry, "entryId" | "createdAt" | "previousEntryHash" | "entryHash"> & {
    createdAt?: string;
  }
): Promise<PreparedLedgerEntry> {
  if (!entryParams.idempotencyKey.trim()) throw new Error("LEDGER_IDEMPOTENCY_KEY_REQUIRED");
  if (!Number.isSafeInteger(entryParams.quantity) || entryParams.quantity <= 0) throw new Error("LEDGER_QUANTITY_INVALID");
  if (entryParams.amountMinor !== undefined && (!Number.isSafeInteger(entryParams.amountMinor) || entryParams.amountMinor < 0)) {
    throw new Error("LEDGER_AMOUNT_INVALID");
  }

  const entryId = deterministicEntryId(entryParams.idempotencyKey);
  const entryRef = adminDb.collection("commerce_ledger").doc(entryId);
  const headRef = adminDb.collection("commerce_ledger_state").doc("head");
  const [existingSnapshot, headSnapshot] = await Promise.all([
    transaction.get(entryRef),
    transaction.get(headRef),
  ]);

  if (existingSnapshot.exists) {
    const existing = existingSnapshot.data() as LedgerEntry;
    if (
      existing.idempotencyKey !== entryParams.idempotencyKey ||
      existing.uid !== entryParams.uid ||
      existing.orderId !== entryParams.orderId ||
      existing.transactionId !== entryParams.transactionId ||
      existing.type !== entryParams.type ||
      existing.quantity !== entryParams.quantity ||
      existing.amountMinor !== entryParams.amountMinor ||
      existing.currency !== entryParams.currency
    ) throw new Error("LEDGER_IDEMPOTENCY_COLLISION");
    return {
      entry: existing,
      entryRef,
      headRef,
      nextHead: headSnapshot.exists ? headSnapshot.data() as LedgerHead : {
        entryId: existing.entryId,
        entryHash: existing.entryHash,
        sequence: 0,
        updatedAt: existing.createdAt,
      },
      idempotentReplay: true,
    };
  }

  const head = headSnapshot.exists ? headSnapshot.data() as LedgerHead : null;
  const createdAt = entryParams.createdAt || new Date().toISOString();
  const entryData: Omit<LedgerEntry, "entryHash"> = {
    ...entryParams,
    entryId,
    createdAt,
    previousEntryHash: head?.entryHash || "",
  };
  const entry: LedgerEntry = { ...entryData, entryHash: calculateEntryHash(entryData) };
  return {
    entry,
    entryRef,
    headRef,
    nextHead: {
      entryId,
      entryHash: entry.entryHash,
      sequence: (head?.sequence || 0) + 1,
      updatedAt: createdAt,
    },
    idempotentReplay: false,
  };
}

export function commitLedgerEntry(
  transaction: admin.firestore.Transaction,
  prepared: PreparedLedgerEntry
): void {
  if (prepared.idempotentReplay) return;
  transaction.create(prepared.entryRef, prepared.entry);
  transaction.set(prepared.headRef, prepared.nextHead);
}

export async function writeLedgerEntry(
  transaction: admin.firestore.Transaction,
  entryParams: Omit<LedgerEntry, "entryId" | "createdAt" | "previousEntryHash" | "entryHash"> & {
    createdAt?: string;
  }
): Promise<LedgerEntry> {
  const prepared = await prepareLedgerEntry(transaction, entryParams);
  commitLedgerEntry(transaction, prepared);
  return prepared.entry;
}
