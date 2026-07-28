/**
 * WP-02 mandatory — delta between two sealed calculation root / SEE snapshots.
 */
export interface SealedSnapshot {
  readonly packageId: string;
  readonly calculationRootHash: string;
  readonly seePricedByGood: Readonly<Record<string, string>>;
  readonly totalPriced: string;
}

export interface SealedDelta {
  readonly changed: boolean;
  readonly rootHashChanged: boolean;
  readonly valueDiffs: readonly { readonly key: string; readonly before: string; readonly after: string }[];
  readonly customerAction: string;
}

export function diffSealedSnapshots(before: SealedSnapshot, after: SealedSnapshot): SealedDelta {
  const valueDiffs: { key: string; before: string; after: string }[] = [];
  if (before.totalPriced !== after.totalPriced) {
    valueDiffs.push({ key: "totalPriced", before: before.totalPriced, after: after.totalPriced });
  }
  const keys = new Set([...Object.keys(before.seePricedByGood), ...Object.keys(after.seePricedByGood)]);
  for (const key of keys) {
    const b = before.seePricedByGood[key] ?? "";
    const a = after.seePricedByGood[key] ?? "";
    if (b !== a) valueDiffs.push({ key: `seePriced.${key}`, before: b, after: a });
  }
  const rootHashChanged = before.calculationRootHash !== after.calculationRootHash;
  const changed = rootHashChanged || valueDiffs.length > 0;
  return {
    changed,
    rootHashChanged,
    valueDiffs,
    customerAction: changed
      ? "NOTIFY_AND_REISSUE_FREE_OF_CHARGE"
      : "NO_CUSTOMER_ACTION",
  };
}
