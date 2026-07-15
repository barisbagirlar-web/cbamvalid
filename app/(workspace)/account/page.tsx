"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, History, Loader2, ShieldAlert, User } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";
import {
  getTypedAccountOverview,
  getTypedCreditLedger,
  getTypedPurchaseHistory,
  submitAccountClosure,
} from "@/lib/functions/account-client";
import type {
  AccountCreditLedgerEntry,
  AccountOverview,
  PurchaseHistoryEntry,
} from "@/lib/functions/commerce-types";

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Account data could not be loaded.";
}

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export default function AccountPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [ledger, setLedger] = useState<AccountCreditLedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closureConfirmation, setClosureConfirmation] = useState(false);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [closureStatus, setClosureStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([
      getTypedAccountOverview(),
      getTypedCreditLedger(),
      getTypedPurchaseHistory(),
    ])
      .then(([overviewData, ledgerData, purchaseData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setLedger(ledgerData);
        setPurchases(purchaseData);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error("Account load failed", loadError);
        setError(describeError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requestClosure = async () => {
    setClosureSubmitting(true);
    setClosureStatus("");
    try {
      await submitAccountClosure();
      setClosureStatus("Account closure request recorded for administrative review.");
      setClosureConfirmation(false);
    } catch (closureError: unknown) {
      setClosureStatus(describeError(closureError));
    } finally {
      setClosureSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-muted" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading account controls
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <Link href="/cbam" className="flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Return to Dashboard
      </Link>

      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-bold">Account, credits and Preparation Packs</h1>
        <p className="mt-2 text-sm text-muted">Commercial records are derived from server orders, signed payment fulfillment and immutable credit-ledger entries.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {overview?.commerceHold.active && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Commerce hold active.</strong> {overview.commerceHold.reason || "A refund-related balance deficit requires review."} Deficit: {overview.commerceHold.deficitCredits} credits. New pack unlocks and seals are blocked until resolution.
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-surface p-6 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center gap-2"><User className="h-5 w-5" /><h2 className="font-serif text-xl font-bold">Profile</h2></div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Email</dt><dd className="mt-1 font-mono">{overview?.profile.email || user?.email || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Verified</dt><dd className="mt-1">{overview?.profile.emailVerified ? "Yes" : "No"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Display name</dt><dd className="mt-1">{overview?.profile.displayName || "Not set"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Company</dt><dd className="mt-1">{overview?.profile.company || "Not set"}</dd></div>
          </dl>
        </article>

        <article className="rounded-xl border border-accent/25 bg-accent/5 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-accent"><CreditCard className="h-5 w-5" /><h2 className="font-serif text-xl font-bold">Credits</h2></div>
          <div className="font-mono text-4xl font-bold text-accent">{overview?.credits.availableCredits ?? 0}</div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits unlock one selected case with {COMMERCIAL_CONTRACT.releasesPerPack} sealed versions.</p>
          <Link href="/credits/buy" className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline">Buy {COMMERCIAL_CONTRACT.creditsGranted} credits for {formatCommercialPrice()}</Link>
        </article>

        <article className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold">Active packs</h2>
          <div className="mt-4 font-mono text-4xl font-bold">{overview?.preparationPacks.activeCount ?? 0}</div>
          <p className="mt-2 text-xs text-muted">{overview?.preparationPacks.releasesRemaining ?? 0} sealed release{overview?.preparationPacks.releasesRemaining === 1 ? "" : "s"} remaining across unlocked cases.</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-neutral-soft p-6"><div className="flex items-center gap-2"><History className="h-5 w-5" /><h2 className="font-serif text-xl font-bold">Credit ledger</h2></div></div>
        <div className="overflow-x-auto p-6">
          {ledger.length === 0 ? <p className="text-sm text-muted">No credit history found.</p> : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs uppercase tracking-wider text-muted"><th className="pb-3">Date</th><th className="pb-3">Type</th><th className="pb-3">Reason</th><th className="pb-3">Amount</th><th className="pb-3 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {ledger.map((entry) => (
                  <tr key={entry.entryId}><td className="py-3">{new Date(entry.createdAt).toLocaleString()}</td><td className="py-3 font-mono text-xs">{entry.type}</td><td className="py-3">{entry.reason}</td><td className={`py-3 font-mono font-bold ${entry.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</td><td className="py-3 text-right font-mono">{entry.balanceAfter}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-neutral-soft p-6"><h2 className="font-serif text-xl font-bold">Purchase history</h2></div>
        <div className="overflow-x-auto p-6">
          {purchases.length === 0 ? <p className="text-sm text-muted">No purchases found.</p> : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs uppercase tracking-wider text-muted"><th className="pb-3">Date</th><th className="pb-3">Order</th><th className="pb-3">Amount</th><th className="pb-3">Transaction</th><th className="pb-3 text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {purchases.map((purchase) => (
                  <tr key={purchase.orderId}><td className="py-3">{new Date(purchase.createdAt).toLocaleString()}</td><td className="py-3 font-mono text-xs">{purchase.orderId}</td><td className="py-3 font-mono">{money(purchase.amountMinor, purchase.currency)}</td><td className="py-3 font-mono text-xs">{purchase.paddleTransactionId || "Pending"}</td><td className="py-3 text-right font-semibold">{purchase.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="flex items-start gap-4 rounded-xl border border-red-300 bg-red-50 p-6">
        <ShieldAlert className="h-6 w-6 shrink-0 text-red-700" />
        <div className="flex-1">
          <h2 className="font-serif text-lg font-bold text-red-800">Account closure</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-red-900/80">A closure request enters administrative review. Statutory accounting, payment, fraud-prevention and sealed-report records may require retention or anonymization.</p>
          {closureStatus && <p role="status" className="mt-3 text-sm font-semibold text-red-800">{closureStatus}</p>}
          {!closureConfirmation ? (
            <button type="button" onClick={() => setClosureConfirmation(true)} className="mt-4 rounded-md border border-red-500 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Request account closure</button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-red-800">Confirm submission for administrative review?</span>
              <button type="button" onClick={() => void requestClosure()} disabled={closureSubmitting} className="rounded-md bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{closureSubmitting ? "Submitting…" : "Confirm request"}</button>
              <button type="button" onClick={() => setClosureConfirmation(false)} disabled={closureSubmitting} className="rounded-md border border-red-400 px-4 py-2 text-xs font-semibold text-red-800">Cancel</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
