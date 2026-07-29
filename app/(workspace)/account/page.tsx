"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  getAccountOverview,
  getEntitlements,
  listCreditLedger,
  listPurchaseHistory,
  requestAccountClosure,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";
import {
  describeLedgerAsPackActivity,
  packsFromCredits,
  packsUnlockableFromCredits,
} from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { CASE_COMMERCIAL } from "@/lib/billing/case-commercial-contract";
import { UnlockPreparationPackPanel } from "@/components/billing/UnlockPreparationPackPanel";
import { User, Package, History, ShieldAlert, ArrowLeft, FolderOpen } from "lucide-react";
import Link from "next/link";

type PurchaseRow = {
  id: string;
  orderId?: string;
  occurredAt?: string;
  amountFormatted?: string;
  currency?: string;
  transactionId?: string | null;
  status?: string;
  statusLabel?: string;
  productLabel?: string;
  // legacy paddle_events shape (must not break if old payload appears)
  data?: {
    transaction_id?: string;
    totals?: { total?: string | number };
    currency_code?: string;
  };
};

type LedgerEntry = {
  id?: string;
  amount: number;
  type?: string;
  reason?: string;
  createdAt?: string;
};

function purchaseStatusClass(status: string | undefined): string {
  switch (status) {
    case "PAID":
      return "text-success";
    case "PENDING":
      return "text-accent";
    case "FAILED":
    case "CANCELED":
      return "text-status-blocked";
    case "REFUNDED":
      return "text-kil-text/60";
    default:
      return "text-kil-text/70";
  }
}

export default function AccountPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [entitlements, setEntitlements] = useState<PreparationPackEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<Record<"ledger" | "purchases" | "entitlements", boolean>>({
    ledger: false,
    purchases: false,
    entitlements: false,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      setLoadError("");
      const [overviewResult, ledgerResult, purchaseResult, entitlementResult] = await Promise.allSettled([
        getAccountOverview(),
        listCreditLedger(),
        listPurchaseHistory(),
        getEntitlements(),
      ]);

      if (cancelled) return;

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value as Record<string, unknown>);
      } else {
        console.error("Failed to load account overview", overviewResult.reason);
        setLoadError("Preparation Pack balance could not be loaded. Retry or contact support.");
      }

      if (ledgerResult.status === "fulfilled") {
        setLedger((ledgerResult.value || []) as LedgerEntry[]);
        setSectionErrors((errors) => ({ ...errors, ledger: false }));
      } else {
        console.error("Failed to load commercial ledger", ledgerResult.reason);
        setSectionErrors((errors) => ({ ...errors, ledger: true }));
      }

      if (purchaseResult.status === "fulfilled") {
        setPurchases((purchaseResult.value || []) as PurchaseRow[]);
        setSectionErrors((errors) => ({ ...errors, purchases: false }));
      } else {
        console.error("Failed to load purchase history", purchaseResult.reason);
        setSectionErrors((errors) => ({ ...errors, purchases: true }));
      }

      if (entitlementResult.status === "fulfilled") {
        setEntitlements(entitlementResult.value || []);
        setSectionErrors((errors) => ({ ...errors, entitlements: false }));
      } else {
        console.error("Failed to load entitlements", entitlementResult.reason);
        setSectionErrors((errors) => ({ ...errors, entitlements: true }));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const reloadAccount = async () => {
    if (!user) return;
    setLoadError("");

    const [overviewResult, ledgerResult, purchaseResult, entitlementResult] = await Promise.allSettled([
      getAccountOverview(),
      listCreditLedger(),
      listPurchaseHistory(),
      getEntitlements(),
    ]);

    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value as Record<string, unknown>);
    } else {
      console.error("Failed to load account overview", overviewResult.reason);
      setLoadError("Preparation Pack balance could not be loaded. Retry or contact support.");
    }

    if (ledgerResult.status === "fulfilled") {
      setLedger((ledgerResult.value || []) as LedgerEntry[]);
      setSectionErrors((errors) => ({ ...errors, ledger: false }));
    } else {
      console.error("Failed to load commercial ledger", ledgerResult.reason);
      setSectionErrors((errors) => ({ ...errors, ledger: true }));
    }

    if (purchaseResult.status === "fulfilled") {
      setPurchases((purchaseResult.value || []) as PurchaseRow[]);
      setSectionErrors((errors) => ({ ...errors, purchases: false }));
    } else {
      console.error("Failed to load purchase history", purchaseResult.reason);
      setSectionErrors((errors) => ({ ...errors, purchases: true }));
    }

    if (entitlementResult.status === "fulfilled") {
      setEntitlements(entitlementResult.value || []);
      setSectionErrors((errors) => ({ ...errors, entitlements: false }));
    } else {
      console.error("Failed to load entitlements", entitlementResult.reason);
      setSectionErrors((errors) => ({ ...errors, entitlements: true }));
    }
  };

  if (loading) {
    return <div className="p-8 text-kil-text font-mono text-sm">Loading enterprise account...</div>;
  }

  const credits = (overview?.credits || {}) as { availableCredits?: number };
  const profile = (overview?.profile || {}) as { displayName?: string };
  const availableCredits = Number(credits.availableCredits || 0);
  const activePackCount = entitlements.length;
  const hasActivePack = entitlements.some((entitlement) =>
    ["AVAILABLE", "ACTIVE", "PURCHASED", "RESERVED"].includes(String(entitlement.status || "").toUpperCase())
  );
  const unlockablePacks = packsUnlockableFromCredits(availableCredits);
  const unusedPackBalance = packsFromCredits(availableCredits);
  const paidPurchases = purchases.filter((p) => p.status === "PAID");
  const pendingPurchases = purchases.filter((p) => p.status === "PENDING");

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <Link href="/cbam" className="text-xs font-semibold text-kil-text/60 hover:text-kil-text transition-colors flex items-center gap-2 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Return to Home
      </Link>

      <div className="flex flex-col gap-4 border-b border-kil-text/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black mb-2 text-kil-text">Account</h1>
          <p className="text-kil-text/60 font-mono text-sm">
            Payment history and paid working-file access in one place.
          </p>
        </div>
        <Link
          href="/cbam"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-kil-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          Open working files
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-sm border border-status-blocked/30 bg-status-blocked/5 p-4 text-sm text-status-blocked">
          {loadError}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => {
              setLoading(true);
              void reloadAccount().finally(() => setLoading(false));
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div
        role="status"
        className={`rounded-sm border p-5 ${
          hasActivePack
            ? "border-success/30 bg-success/5"
            : pendingPurchases.length > 0
              ? "border-accent/30 bg-accent/5"
              : "border-kil-text/15 bg-kil-surface"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-kil-text/60 mb-1">
          Payment & pack status
        </p>
        {sectionErrors.entitlements ? (
          <>
            <p className="font-serif text-xl font-bold text-status-blocked">Paid access status unavailable</p>
            <p className="mt-2 text-sm text-kil-text/70">
              We could not verify paid working-file access. Your access has not been removed. Retry before starting another payment.
            </p>
          </>
        ) : hasActivePack ? (
          <>
            <p className="font-serif text-xl font-bold text-kil-text">
              Payment confirmed for {activePackCount} working file{activePackCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 text-sm text-kil-text/70">
              Open the paid file to lock it or make corrections. Same-file correction re-locks and
              re-downloads remain included.
            </p>
          </>
        ) : pendingPurchases.length > 0 ? (
          <>
            <p className="font-serif text-xl font-bold text-kil-text">Payment pending confirmation</p>
            <p className="mt-2 text-sm text-kil-text/70">
              We see a checkout in progress. If your card was charged, wait a minute and refresh.
              Do not pay again. If paid access still does not appear, email info@cbamvalid.com with your order ID.
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-xl font-bold text-kil-text">No paid working-file unlock yet</p>
            <p className="mt-2 text-sm text-kil-text/70">
              Pay once to lock a working file ({CANONICAL_PRICING.priceFormatted}). After payment
              confirms, this page will show paid unlocks and you can lock &amp; download that file.
              Same-file corrections stay included.
            </p>
          </>
        )}
        {paidPurchases.length > 0 ? (
          <p className="mt-3 font-mono text-xs text-kil-text/60">
            Confirmed purchases on file: {paidPurchases.length}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-kil-surface border border-kil-text/15 rounded-sm p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-kil-text">
            <User className="w-5 h-5" />
            <h2 className="font-serif text-xl">Profile</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-kil-text/60 mb-1">Email</label>
              <div className="font-mono text-sm">{user?.email}</div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-kil-text/60 mb-1">Company Name</label>
              <div className="font-mono text-sm">{profile.displayName || "Not set"}</div>
            </div>
          </div>
        </div>

        <div className="bg-kil-accent/5 border border-kil-accent/20 rounded-sm p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-kil-accent">
            <Package className="w-5 h-5" />
            <h2 className="font-serif text-xl">Paid unlock status</h2>
          </div>
          <div className="text-2xl font-serif font-bold text-kil-accent">
            {sectionErrors.entitlements ? "Status unavailable" : activePackCount > 0 ? "Ready to lock" : "No paid unlock"}
          </div>
          <p className="text-xs text-kil-text/60 mt-2 leading-relaxed">
            {CASE_COMMERCIAL.customerOneLiner} Paid working files: {activePackCount}.
          </p>
          {unlockablePacks > 0 && !hasActivePack ? (
            <p className="mt-3 font-mono text-xs text-kil-text/70">
              Unused legacy pack balance ready to activate: {unusedPackBalance}
            </p>
          ) : null}
        </div>
      </div>

      <UnlockPreparationPackPanel
        availableCredits={availableCredits}
        hasActivePack={hasActivePack}
        onUnlocked={async () => {
          setLoading(true);
          await reloadAccount();
          setLoading(false);
        }}
      />

      {sectionErrors.entitlements ? (
        <div className="rounded-sm border border-status-blocked/30 bg-status-blocked/5 p-5 text-sm text-status-blocked" role="alert">
          Paid working-file access could not be loaded. Retry above; do not start another checkout until this status is available.
        </div>
      ) : activePackCount > 0 ? (
        <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
          <div className="p-6 border-b border-kil-text/15 bg-kil-base">
            <h2 className="font-serif text-xl text-kil-text">Active paid unlocks</h2>
          </div>
          <div className="overflow-x-auto p-6">
            <table className="w-full min-w-[36rem] text-left text-sm font-mono">
              <thead>
                <tr className="text-kil-text/60 border-b border-kil-text/15">
                  <th className="pb-3">Unlock</th>
                  <th className="pb-3">Scope</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kil-text/10">
                {entitlements.map((entitlement, index) => {
                  const scopeId =
                    (typeof entitlement.scopeCaseId === "string" && entitlement.scopeCaseId) ||
                    (typeof entitlement.caseId === "string" && entitlement.caseId) ||
                    "";
                  return (
                    <tr key={entitlement.entitlementId || `${entitlement.orderId}-${index}`}>
                      <td className="py-3">Unlock {index + 1}</td>
                      <td className="py-3">
                        {scopeId ? (
                          <Link href={`/cases/${encodeURIComponent(scopeId)}?step=8`} className="text-xs font-semibold text-kil-accent underline">
                            Open paid working file
                          </Link>
                        ) : (
                          <span className="block text-xs text-kil-text/50">Legacy unbound pack</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold text-kil-accent">
                        Corrections included
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
        <div className="p-6 border-b border-kil-text/15 bg-kil-base">
          <h2 className="font-serif text-xl text-kil-text">Purchase history</h2>
          <p className="mt-1 text-xs text-kil-text/60">
            Card charges from checkout. Status is the source of truth for whether payment completed.
          </p>
        </div>
        <div className="overflow-x-auto p-6">
          {sectionErrors.purchases ? (
            <p className="text-sm text-status-blocked" role="alert">
              Purchase history could not be loaded. Retry before assuming that a payment failed.
            </p>
          ) : purchases.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No purchases found.</p>
          ) : (
            <table className="w-full min-w-[42rem] text-left text-sm font-mono">
              <thead>
                <tr className="text-kil-text/60 border-b border-kil-text/15">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Order</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kil-text/10">
                {purchases.map((purchase) => {
                  const amount =
                    purchase.amountFormatted ||
                    (purchase.data?.totals?.total != null
                      ? `${purchase.data.totals.total} ${purchase.data.currency_code || ""}`
                      : "—");
                  const orderRef =
                    purchase.transactionId ||
                    purchase.data?.transaction_id ||
                    purchase.orderId ||
                    purchase.id;
                  return (
                    <tr key={purchase.id}>
                      <td className="py-3">
                        {purchase.occurredAt
                          ? new Date(purchase.occurredAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3 break-all max-w-[12rem]">{orderRef}</td>
                      <td className="py-3">{amount}</td>
                      <td
                        className={`py-3 text-right font-bold ${purchaseStatusClass(purchase.status)}`}
                      >
                        {purchase.statusLabel || purchase.status || "Unknown"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
        <div className="p-6 border-b border-kil-text/15 bg-kil-base">
          <div className="flex items-center gap-2 text-kil-text">
            <History className="w-5 h-5" />
            <h2 className="font-serif text-xl">Pack balance activity</h2>
          </div>
          <p className="mt-1 text-xs text-kil-text/60">
            Internal pack-balance movements (grants and activations). Card payments appear above.
          </p>
        </div>
        <div className="overflow-x-auto p-6">
          {sectionErrors.ledger ? (
            <p className="text-sm text-status-blocked" role="alert">
              Legacy balance activity could not be loaded. Paid working-file access is shown separately above.
            </p>
          ) : ledger.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No pack balance activity found.</p>
          ) : (
            <table className="w-full min-w-[36rem] text-left text-sm font-mono">
              <thead>
                <tr className="text-kil-text/60 border-b border-kil-text/15">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Activity</th>
                  <th className="pb-3 text-right">Packs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kil-text/10">
                {ledger.map((entry) => {
                  const { activity, packDeltaLabel } = describeLedgerAsPackActivity(entry);
                  return (
                    <tr key={entry.id}>
                      <td className="py-3">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3">{activity}</td>
                      <td className="py-3 text-right font-bold text-kil-accent">{packDeltaLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div id="security" className="border border-status-blocked/20 bg-status-blocked/5 rounded-sm p-6 flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-status-blocked shrink-0" />
        <div>
          <h3 className="font-serif text-lg text-status-blocked mb-1">Security & account closure</h3>
          <p className="text-xs text-kil-text/60 mb-4 max-w-lg">
            Requesting account closure will permanently delete your user profile and all associated data in accordance with GDPR. Commercial transaction records will be anonymized and retained for legal accounting purposes.
          </p>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to request account closure? This action cannot be undone.")) {
                requestAccountClosure().then(() => alert("Closure requested.")).catch(console.error);
              }
            }}
            className="px-4 py-2 border border-status-blocked text-status-blocked text-xs font-semibold hover:bg-status-blocked/10 transition-colors"
          >
            Request Account Closure
          </button>
        </div>
      </div>
    </div>
  );
}
