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
  RELEASES_PER_PREPARATION_PACK,
  describeLedgerAsPackActivity,
  packsFromCredits,
  packsUnlockableFromCredits,
} from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { UnlockPreparationPackPanel } from "@/components/billing/UnlockPreparationPackPanel";
import { User, Package, History, ShieldAlert, ArrowLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function AccountPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<PreparationPackEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const reloadAccount = async () => {
    if (!user) return;
    setLoadError("");

    // Isolate failures: purchase/ledger errors must never zero pack status.
    const [overviewResult, ledgerResult, purchaseResult, entitlementResult] = await Promise.allSettled([
      getAccountOverview(),
      listCreditLedger(),
      listPurchaseHistory(),
      getEntitlements(),
    ]);

    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value);
    } else {
      console.error("Failed to load account overview", overviewResult.reason);
      setLoadError("Preparation Pack balance could not be loaded. Retry or contact support.");
    }

    if (ledgerResult.status === "fulfilled") {
      setLedger(ledgerResult.value || []);
    } else {
      console.error("Failed to load commercial ledger", ledgerResult.reason);
      setLedger([]);
    }

    if (purchaseResult.status === "fulfilled") {
      setPurchases(purchaseResult.value || []);
    } else {
      console.error("Failed to load purchase history", purchaseResult.reason);
      setPurchases([]);
    }

    if (entitlementResult.status === "fulfilled") {
      setEntitlements(entitlementResult.value || []);
    } else {
      console.error("Failed to load entitlements", entitlementResult.reason);
      setEntitlements([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void reloadAccount().finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return <div className="p-8 text-kil-text font-mono text-sm">Loading enterprise account...</div>;
  }

  const availableCredits = Number(overview?.credits?.availableCredits || 0);
  const activePackCount = entitlements.length;
  const activeReleasesRemaining = entitlements.reduce(
    (sum, entitlement) => sum + Number(entitlement.releasesRemaining || 0),
    0
  );
  const hasActivePack = activeReleasesRemaining > 0;
  const unlockablePacks = packsUnlockableFromCredits(availableCredits);
  const unusedPackBalance = packsFromCredits(availableCredits);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <Link href="/cbam" className="text-xs font-semibold text-kil-text/60 hover:text-kil-text transition-colors flex items-center gap-2 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Return to Dashboard
      </Link>

      <div className="flex flex-col gap-4 border-b border-kil-text/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black mb-2 text-kil-text">Enterprise Account</h1>
          <p className="text-kil-text/60 font-mono text-sm">
            Manage profile, Preparation Packs, and purchase history.
          </p>
        </div>
        <Link
          href="/credits/buy"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-kil-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Buy Preparation Pack — {CANONICAL_PRICING.priceFormatted}
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
              <div className="font-mono text-sm">{overview?.profile?.displayName || "Not set"}</div>
            </div>
          </div>
        </div>

        <div className="bg-kil-accent/5 border border-kil-accent/20 rounded-sm p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-kil-accent">
            <Package className="w-5 h-5" />
            <h2 className="font-serif text-xl">Preparation Packs</h2>
          </div>
          <div className="text-4xl font-mono font-bold text-kil-accent">
            {activeReleasesRemaining}
          </div>
          <p className="text-xs text-kil-text/60 mt-2">
            Sealed releases remaining across {activePackCount} active pack
            {activePackCount === 1 ? "" : "s"}. Each pack includes {RELEASES_PER_PREPARATION_PACK}{" "}
            successful sealed releases for one operator, one installation, and one reporting year.
          </p>
          <p className="mt-3 font-mono text-xs text-kil-text/70">
            {unlockablePacks > 0
              ? `Unused pack balance ready to activate: ${unusedPackBalance}`
              : hasActivePack
                ? "No unused pack balance waiting to activate."
                : "No active pack — buy a Preparation Pack at checkout to seal."}
          </p>
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

      {activePackCount > 0 ? (
        <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
          <div className="p-6 border-b border-kil-text/15 bg-kil-base">
            <h2 className="font-serif text-xl text-kil-text">Active packs</h2>
          </div>
          <div className="p-6">
            <table className="w-full text-left text-sm font-mono">
              <thead>
                <tr className="text-kil-text/60 border-b border-kil-text/15">
                  <th className="pb-3">Pack</th>
                  <th className="pb-3">Releases used</th>
                  <th className="pb-3 text-right">Releases left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kil-text/10">
                {entitlements.map((entitlement, index) => (
                  <tr key={entitlement.entitlementId || `${entitlement.orderId}-${index}`}>
                    <td className="py-3">
                      Pack {index + 1}
                      {typeof entitlement.scopeCaseId === "string" && entitlement.scopeCaseId ? (
                        <span className="block text-xs text-kil-text/50">
                          Scope case: {entitlement.scopeCaseId}
                        </span>
                      ) : typeof entitlement.caseId === "string" && entitlement.caseId ? (
                        <span className="block text-xs text-kil-text/50">
                          Scope case: {entitlement.caseId}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      {Number(entitlement.releasesCount || 0)} / {RELEASES_PER_PREPARATION_PACK}
                    </td>
                    <td className="py-3 text-right font-bold text-kil-accent">
                      {Number(entitlement.releasesRemaining || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
        <div className="p-6 border-b border-kil-text/15 bg-kil-base">
          <div className="flex items-center gap-2 text-kil-text">
            <History className="w-5 h-5" />
            <h2 className="font-serif text-xl">Pack activity</h2>
          </div>
        </div>
        <div className="p-6">
          {ledger.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No pack activity found.</p>
          ) : (
            <table className="w-full text-left text-sm font-mono">
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

      <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
        <div className="p-6 border-b border-kil-text/15 bg-kil-base">
          <h2 className="font-serif text-xl text-kil-text">Purchase History</h2>
        </div>
        <div className="p-6">
          {purchases.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No purchases found.</p>
          ) : (
            <table className="w-full text-left text-sm font-mono">
              <thead>
                <tr className="text-kil-text/60 border-b border-kil-text/15">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Invoice</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kil-text/10">
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="py-3">{new Date(purchase.occurredAt).toLocaleDateString()}</td>
                    <td className="py-3">{purchase.data?.transaction_id || purchase.id}</td>
                    <td className="py-3">
                      {purchase.data?.totals?.total} {purchase.data?.currency_code}
                    </td>
                    <td className="py-3 text-right text-success font-bold">Paid</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="border border-status-blocked/20 bg-status-blocked/5 rounded-sm p-6 flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-status-blocked shrink-0" />
        <div>
          <h3 className="font-serif text-lg text-status-blocked mb-1">Danger Zone</h3>
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
