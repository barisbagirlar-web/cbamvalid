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
  entryHash: string;
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

export function deriveLedgerEntryId(idempotencyKey: string): string {
  if (!idempotencyKey.trim()) throw new Error("LEDGER_IDEMPOTENCY_KEY_REQUIRED");
  return `led_${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`;
}

export function calculateEntryHash(entry: Omit<LedgerEntry, "entryHash">): string {
  return crypto.createHash("sha256").update(canonical(entry)).digest("hex");
}

export async function writeLedgerEntry(
  transaction: admin.firestore.Transaction,
  entryParams: Omit<LedgerEntry, "entryId" | "createdAt" | "entryHash">
): Promise<LedgerEntry> {
  if (!Number.isSafeInteger(entryParams.quantity) || entryParams.quantity <= 0) {
    throw new Error("LEDGER_QUANTITY_INVALID");
  }
  if (entryParams.amountMinor !== undefined && (!Number.isSafeInteger(entryParams.amountMinor) || entryParams.amountMinor < 0)) {
    throw new Error("LEDGER_AMOUNT_INVALID");
  }

  const entryId = deriveLedgerEntryId(entryParams.idempotencyKey);
  const entryData: Omit<LedgerEntry, "entryHash"> = {
    ...entryParams,
    entryId,
    createdAt: new Date().toISOString(),
  };
  const finalEntry: LedgerEntry = {
    ...entryData,
    entryHash: calculateEntryHash(entryData),
  };
  transaction.create(adminDb.collection("commerce_ledger").doc(entryId), finalEntry);
  return finalEntry;
}
