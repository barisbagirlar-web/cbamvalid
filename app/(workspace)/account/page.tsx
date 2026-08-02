"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";
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
import { User, Package, History, ShieldAlert, ArrowLeft, ShoppingBag } from "lucide-react";
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
      } else {
        console.error("Failed to load commercial ledger", ledgerResult.reason);
        setLedger([]);
      }

      if (purchaseResult.status === "fulfilled") {
        setPurchases((purchaseResult.value || []) as PurchaseRow[]);
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
    } else {
      console.error("Failed to load commercial ledger", ledgerResult.reason);
      setLedger([]);
    }

    if (purchaseResult.status === "fulfilled") {
      setPurchases((purchaseResult.value || []) as PurchaseRow[]);
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

  if (loading) {
    return <div className="p-8 text-kil-text font-mono text-sm">Loading enterprise account...</div>;
  }

  const credits = (overview?.credits || {}) as { availableCredits?: number };
  const profile = (overview?.profile || {}) as { displayName?: string };
  const availableCredits = Number(credits.availableCredits || 0);
  const activePackCount = entitlements.length;
  const activeReleasesRemaining = entitlements.reduce(
    (sum, entitlement) => sum + Number(entitlement.releasesRemaining || 0),
    0
  );
  const hasActivePack = activeReleasesRemaining > 0;
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
            Payment status, Preparation Packs, and sealed releases — one place.
          </p>
        </div>
        {hasActivePack ? (
          <Link
            href="/credits/buy"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-kil-text/20 bg-kil-surface px-4 py-2 text-sm font-semibold text-kil-text transition-colors hover:bg-kil-base"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Buy another pack — {CANONICAL_PRICING.priceFormatted}
          </Link>
        ) : (
          <Link
            href="/credits/buy"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-kil-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Buy Preparation Pack — {CANONICAL_PRICING.priceFormatted}
          </Link>
        )}
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
        {hasActivePack ? (
          <>
            <p className="font-serif text-xl font-bold text-kil-text">
              Payment confirmed — {activeReleasesRemaining} sealed release
              {activeReleasesRemaining === 1 ? "" : "s"} ready
            </p>
            <p className="mt-2 text-sm text-kil-text/70">
              Across {activePackCount} active Preparation Pack
              {activePackCount === 1 ? "" : "s"}. Each successful lock uses one release.
              Failed locks use none. You do not need to pay again to continue sealing.
            </p>
          </>
        ) : pendingPurchases.length > 0 ? (
          <>
            <p className="font-serif text-xl font-bold text-kil-text">Payment pending confirmation</p>
            <p className="mt-2 text-sm text-kil-text/70">
              We see a checkout in progress. If your card was charged, wait a minute and refresh.
              If sealed releases still do not appear, email info@cbamvalid.com with your order ID.
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
            {activePackCount > 0 ? "Ready to lock" : "No paid unlock"}
          </div>
          <p className="text-xs text-kil-text/60 mt-2 leading-relaxed">
            {CASE_COMMERCIAL.customerOneLiner} Active paid files: {activePackCount}. Internal reseal
            capacity remaining across entitlements: {activeReleasesRemaining} (ceiling, not a marketed
            meter).
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

      {activePackCount > 0 ? (
        <div className="bg-kil-surface border border-kil-text/15 rounded-sm shadow-sm overflow-hidden">
          <div className="p-6 border-b border-kil-text/15 bg-kil-base">
            <h2 className="font-serif text-xl text-kil-text">Active paid unlocks</h2>
          </div>
          <div className="p-6">
            <table className="w-full text-left text-sm font-mono">
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
                  const max = Number(
                    entitlement.maxReleases || CASE_COMMERCIAL.maxReleasesPerPaidCase
                  );
                  const used = Number(entitlement.releasesCount || 0);
                  return (
                    <tr key={entitlement.entitlementId || `${entitlement.orderId}-${index}`}>
                      <td className="py-3">Unlock {index + 1}</td>
                      <td className="py-3">
                        {scopeId ? (
                          <span className="block text-xs text-kil-text/70">Working file: {scopeId}</span>
                        ) : (
                          <span className="block text-xs text-kil-text/50">Legacy unbound pack</span>
                        )}
                        <span className="block text-[10px] text-kil-text/40">
                          Seals used {used}/{max} (internal ceiling)
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-kil-accent">
                        {Number(entitlement.releasesRemaining || 0) > 0
                          ? "Corrections included"
                          : "Exhausted"}
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
        <div className="p-6">
          {purchases.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No purchases found.</p>
          ) : (
            <table className="w-full text-left text-sm font-mono">
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
        <div className="p-6">
          {ledger.length === 0 ? (
            <p className="text-sm font-mono text-kil-text/60">No pack balance activity found.</p>
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

      <div id="security" className="border border-border rounded-sm p-6 bg-kil-surface shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-kil-accent" />
          <h2 className="font-serif text-xl text-kil-text">Security</h2>
        </div>
        <p className="text-xs text-kil-text/60 mb-4">
          Account credentials and email verification for this CBAMValid sign-in.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-kil-text/60 mb-1">Email verification</label>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${user?.emailVerified ? "border-success/30 bg-success/5 text-success" : "border-status-blocked/30 bg-status-blocked/5 text-status-blocked"}`}>
                {user?.emailVerified ? "Verified" : "Not verified"}
              </span>
              {!user?.emailVerified && (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) return;
                    sendEmailVerification(user)
                      .then(() => alert("Verification email sent. Check your inbox."))
                      .catch((err: unknown) => {
                        const message = err instanceof Error ? err.message : "Failed to send verification email.";
                        alert(message);
                      });
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Send verification email
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-kil-text/10 pt-4">
            <label className="block text-xs font-mono uppercase text-kil-text/60 mb-1">Password</label>
            <button
              type="button"
              onClick={() => {
                if (!user?.email) return;
                sendPasswordResetEmail(auth, user.email)
                  .then(() => alert("Password reset email sent. Check your inbox."))
                  .catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : "Failed to send password reset email.";
                    alert(message);
                  });
              }}
              className="px-4 py-2 border border-border text-kil-text text-xs font-semibold hover:bg-kil-base transition-colors"
            >
              Send password reset email
            </button>
            <p className="text-[11px] text-kil-text/50 mt-2">
              A secure reset link is emailed to {user?.email || "your inbox"}. CBAMValid never stores your password.
            </p>
          </div>
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
