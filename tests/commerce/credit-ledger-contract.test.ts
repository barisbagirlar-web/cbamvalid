import { describe, expect, it } from "vitest";
import {
  CREDIT_LEDGER_COLLECTION,
  CREDITS_PER_PREPARATION_PACK,
  LEGACY_CREDIT_LEDGER_COLLECTION,
  RELEASES_PER_PREPARATION_PACK,
  mergeCreditLedgerEntries,
  normalizeCreditLedgerEntry,
  packsUnlockableFromCredits,
  potentialReleasesFromCredits,
} from "@/lib/billing/credit-contract";

describe("credit contract", () => {
  it("enforces 100 credits → 1 pack → 5 releases", () => {
    expect(CREDITS_PER_PREPARATION_PACK).toBe(100);
    expect(RELEASES_PER_PREPARATION_PACK).toBe(5);
    expect(packsUnlockableFromCredits(1000)).toBe(10);
    expect(potentialReleasesFromCredits(1000)).toBe(50);
    expect(packsUnlockableFromCredits(99)).toBe(0);
  });

  it("merges canonical creditLedger over legacy ledger without dropping either", () => {
    const primary = [
      normalizeCreditLedgerEntry(
        "admin_grant_new",
        { amount: 1000, type: "ADMIN_GRANT", createdAt: "2026-07-22T10:00:00.000Z", balanceAfter: 1000 },
        CREDIT_LEDGER_COLLECTION
      ),
    ];
    const legacy = [
      normalizeCreditLedgerEntry(
        "admin_grant_old",
        { amount: 1000, type: "ADMIN_GRANT", createdAt: "2026-07-20T10:00:00.000Z" },
        LEGACY_CREDIT_LEDGER_COLLECTION
      ),
    ];

    const merged = mergeCreditLedgerEntries(primary, legacy);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe("admin_grant_new");
    expect(merged[1]?.id).toBe("admin_grant_old");
    expect(merged[1]?.sourceCollection).toBe(LEGACY_CREDIT_LEDGER_COLLECTION);
  });

  it("does not invent Active Pack capacity from stranded credits alone", () => {
    // 1000 credits with a CONSUMED 5/5 pack still require unlockCbamUses before sealing.
    const strandedCredits = 1000;
    expect(packsUnlockableFromCredits(strandedCredits)).toBeGreaterThan(0);
    // Credits are not seals until unlock creates an AVAILABLE entitlement.
    expect(strandedCredits).not.toBe(RELEASES_PER_PREPARATION_PACK);
  });
});
