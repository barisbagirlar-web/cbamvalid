/** Canonical commercial unit: 100 account credits unlock 1 Preparation Pack with 5 seals. */
export const CREDITS_PER_PREPARATION_PACK = 100;
export const RELEASES_PER_PREPARATION_PACK = 5;
export const CREDITS_PER_SEALED_RELEASE =
  CREDITS_PER_PREPARATION_PACK / RELEASES_PER_PREPARATION_PACK;

export const CREDIT_LEDGER_COLLECTION = "creditLedger";
/** Legacy admin-grant collection used before creditLedger unification. */
export const LEGACY_CREDIT_LEDGER_COLLECTION = "ledger";

export type NormalizedCreditLedgerEntry = {
  id: string;
  amount: number;
  type: string;
  reason: string;
  createdAt: string;
  balanceAfter: number | null;
  sourceCollection: typeof CREDIT_LEDGER_COLLECTION | typeof LEGACY_CREDIT_LEDGER_COLLECTION;
};

function toIsoTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString();
    }
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000).toISOString();
    }
  }
  return "";
}

export function normalizeCreditLedgerEntry(
  id: string,
  data: Record<string, unknown>,
  sourceCollection: NormalizedCreditLedgerEntry["sourceCollection"]
): NormalizedCreditLedgerEntry {
  const amount = Number(data.amount);
  const balanceAfterRaw = data.balanceAfter;
  const balanceAfter =
    balanceAfterRaw === null || balanceAfterRaw === undefined
      ? null
      : Number(balanceAfterRaw);

  return {
    id,
    amount: Number.isFinite(amount) ? amount : 0,
    type: typeof data.type === "string" && data.type ? data.type : String(data.reason || "LEDGER_ENTRY"),
    reason: typeof data.reason === "string" ? data.reason : "",
    createdAt: toIsoTimestamp(data.createdAt),
    balanceAfter: Number.isFinite(balanceAfter as number) ? (balanceAfter as number) : null,
    sourceCollection,
  };
}

export function mergeCreditLedgerEntries(
  primary: NormalizedCreditLedgerEntry[],
  legacy: NormalizedCreditLedgerEntry[]
): NormalizedCreditLedgerEntry[] {
  const byId = new Map<string, NormalizedCreditLedgerEntry>();
  for (const entry of [...legacy, ...primary]) {
    byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

export function packsUnlockableFromCredits(availableCredits: number): number {
  if (!Number.isFinite(availableCredits) || availableCredits < CREDITS_PER_PREPARATION_PACK) {
    return 0;
  }
  return Math.floor(availableCredits / CREDITS_PER_PREPARATION_PACK);
}

export function potentialReleasesFromCredits(availableCredits: number): number {
  return packsUnlockableFromCredits(availableCredits) * RELEASES_PER_PREPARATION_PACK;
}
