"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, History, Loader2, ShieldAlert, User } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { AccountOverview, CreditLedgerEntry, PurchaseHistoryEntry } from "@/lib/account-contract";
import { PREPARATION_PACK, releasesFromCredits } from "@/lib/commerce/preparation-pack";
import {
  getAccountOverview,
  listCreditLedger,
  listPurchaseHistory,
  requestAccountClosure,
} from "@/lib/functions/client";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Account data could not be loaded.";
}

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

export default function AccountPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closureConfirm, setClosureConfirm] = useState("");
  const [closureStatus, setClosureStatus] = useState("");
  const [closureLoading, setClosureLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([getAccountOverview(), listCreditLedger(), listPurchaseHistory()])
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
        setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requestClosure = async () => {
    if (closureConfirm !== "CLOSE MY ACCOUNT") return;
    setClosureLoading(true);
    setClosureStatus("");
    try {
      const result = await requestAccountClosure();
      setClosureStatus(`Closure request recorded at ${result.requestedAt}.`);
      setClosureConfirm("");
    } catch (closureError: unknown) {
      setClosureStatus(errorMessage(closureError));
    } finally {
      setClosureLoading(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-accent" aria-label="Loading account" /></main>;
  }

  const credits = overview?.creditSummary.availableCredits || 0;
  const possibleSeals = releasesFromCredits(credits);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      <Link href="/cbam" className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" />Return to Dashboard</Link>
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-black">Account and Commercial Ledger</h1>
        <p className="mt-2 text-sm text-muted">Profile, account credits, successful-seal debits and verified payment events.</p>
      </header>

      {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><User className="h-5 w-5" /><h2 className="font-serif text-xl">Profile</h2></div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs font-semibold uppercase text-muted">Email</dt><dd className="mt-1 font-mono">{overview?.profile.email || user?.email || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Display name</dt><dd className="mt-1">{overview?.profile.displayName || "Not set"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Company</dt><dd className="mt-1">{overview?.profile.companyName || "Not set"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Country</dt><dd className="mt-1">{overview?.profile.country || "Not set"}</dd></div>
          </dl>
        </article>

        <article className="rounded-xl border border-accent/20 bg-accent/5 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-accent"><CreditCard className="h-5 w-5" /><h2 className="font-serif text-xl">Available Seal Credits</h2></div>
          <div className="font-mono text-4xl font-bold text-accent">{credits}</div>
          <p className="mt-2 text-sm text-muted">Up to {possibleSeals} successful seal{possibleSeals === 1 ? "" : "s"} at {PREPARATION_PACK.creditsPerRelease} credits each.</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">A {PREPARATION_PACK.accountCredits}-credit purchase funds {PREPARATION_PACK.maxReleases} successful sealed versions. Failed or blocked seals consume zero credits.</p>
          <Link href="/credits/buy" className="mt-5 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-surface">Purchase Preparation Pack</Link>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-neutral-soft p-6"><div className="flex items-center gap-2"><History className="h-5 w-5" /><h2 className="font-serif text-xl">Credit Ledger</h2></div></div>
        <div className="overflow-x-auto p-6">
          {ledger.length === 0 ? <p className="text-sm text-muted">No credit entries found.</p> : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs uppercase text-muted"><th className="pb-3">Date</th><th className="pb-3">Type</th><th className="pb-3">Reason</th><th className="pb-3">Amount</th><th className="pb-3 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-border/60">{ledger.map((entry) => <tr key={entry.id}><td className="py-3">{date(entry.createdAt)}</td><td className="py-3 font-mono text-xs">{entry.type}</td><td className="py-3">{entry.reason}</td><td className={`py-3 font-bold ${entry.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</td><td className="py-3 text-right font-mono">{entry.balanceAfter}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-neutral-soft p-6"><h2 className="font-serif text-xl">Paddle Event History</h2></div>
        <div className="overflow-x-auto p-6">
          {purchases.length === 0 ? <p className="text-sm text-muted">No verified payment events found.</p> : (
            <table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase text-muted"><th className="pb-3">Date</th><th className="pb-3">Event</th><th className="pb-3">Transaction</th><th className="pb-3">Order</th><th className="pb-3 text-right">Processing</th></tr></thead><tbody className="divide-y divide-border/60">{purchases.map((purchase) => <tr key={purchase.eventId}><td className="py-3">{date(purchase.occurredAt)}</td><td className="py-3">{purchase.eventType}</td><td className="py-3 font-mono text-xs">{purchase.transactionId || "—"}</td><td className="py-3 font-mono text-xs">{purchase.orderId || "—"}</td><td className="py-3 text-right font-semibold">{purchase.processingState}</td></tr>)}</tbody></table>
          )}
        </div>
      </section>

      <section className="flex items-start gap-4 rounded-xl border border-red-300 bg-red-50 p-6">
        <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
        <div className="w-full">
          <h2 className="font-serif text-lg text-red-700">Account Closure Request</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-red-900/75">Type <strong>CLOSE MY ACCOUNT</strong> to create a reviewable closure request. The request does not silently delete immutable accounting or sealed-report evidence.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={closureConfirm} onChange={(event) => setClosureConfirm(event.target.value)} className="h-10 flex-1 rounded border border-red-300 bg-white px-3 text-sm" aria-label="Closure confirmation" /><button type="button" onClick={() => void requestClosure()} disabled={closureLoading || closureConfirm !== "CLOSE MY ACCOUNT"} className="h-10 rounded border border-red-600 px-4 text-xs font-semibold text-red-700 disabled:opacity-50">{closureLoading ? "Recording…" : "Request Closure"}</button></div>
          {closureStatus && <p role="status" className="mt-3 text-xs text-red-800">{closureStatus}</p>}
        </div>
      </section>
    </main>
  );
}
