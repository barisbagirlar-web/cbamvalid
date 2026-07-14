import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, PlusCircle, RotateCcw, Search, Calendar, User } from "lucide-react";

export default async function AdminCreditsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  await requireSuperAdmin();
  const { uid } = await searchParams;

  let searchedUid = uid?.trim() || "";
  let ledgerEntries: any[] = [];
  let userEmail = "";

  if (searchedUid) {
    // Fetch target user profile to show details
    const userDoc = await adminDb.collection("users").doc(searchedUid).get();
    if (userDoc.exists) {
      userEmail = userDoc.data()?.email || "";
    }

    // Query user ledger subcollection
    const snap = await adminDb
      .collection("users")
      .doc(searchedUid)
      .collection("creditLedger")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    ledgerEntries = snap.docs.map((doc) => {
      const d = doc.data();
      let dateStr = "";
      if (d.createdAt) {
        if (typeof d.createdAt.toDate === "function") {
          dateStr = d.createdAt.toDate().toISOString();
        } else {
          dateStr = String(d.createdAt);
        }
      }
      return {
        id: doc.id,
        type: d.type || "UNKNOWN",
        amount: d.amount || 0,
        reason: d.reason || "",
        grantedBy: d.grantedBy || d.reversedBy || "System",
        createdAt: dateStr,
        balanceAfter: d.balanceAfter,
      };
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Manual Credit Adjustments</h1>
          <p className="text-muted text-sm mt-1">Manage synthetic ledger credits and view audit history.</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/credits/grant"
          className="p-6 bg-surface border border-border rounded-lg shadow-sm hover:border-accent/40 transition-colors flex items-start gap-4 group"
        >
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">Grant Manual Credits</h3>
            <p className="text-sm text-muted mt-1">Issue fresh account usage credits directly to any user by UID.</p>
          </div>
        </Link>

        <Link
          href="/admin/credits/reverse"
          className="p-6 bg-surface border border-border rounded-lg shadow-sm hover:border-accent/40 transition-colors flex items-start gap-4 group"
        >
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">Reverse Credit Grant</h3>
            <p className="text-sm text-muted mt-1">Safely rollback or deduct an incorrect credit transaction in the ledger.</p>
          </div>
        </Link>
      </div>

      {/* Ledger Search Section */}
      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <h2 className="text-lg font-bold font-serif text-foreground">Query User Credit Ledger</h2>
        <form className="flex gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
            <input
              type="text"
              name="uid"
              defaultValue={searchedUid}
              placeholder="Enter User UID (e.g. r3Sv0U5YqEcLLyl...)"
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-surface text-sm font-semibold rounded hover:bg-accent-hover transition-colors"
          >
            Search
          </button>
        </form>

        {searchedUid && (
          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <User className="w-4 h-4" />
              <span>
                Ledger for User: <strong className="text-foreground">{searchedUid}</strong>
                {userEmail && <span className="ml-1 text-accent">({userEmail})</span>}
              </span>
            </div>

            {ledgerEntries.length === 0 ? (
              <p className="text-sm text-muted py-4">No credit ledger history found for this user.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2">Transaction ID</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Balance After</th>
                      <th className="py-2">Reason</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-border/10">
                        <td className="py-3 font-mono text-xs">{entry.id}</td>
                        <td className="py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              entry.type.includes("ADD") || entry.type.includes("GRANT")
                                ? "bg-accent/15 text-accent"
                                : "bg-amber-500/15 text-amber-700"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 font-semibold">
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-3 text-muted">{entry.balanceAfter !== undefined ? entry.balanceAfter : "-"}</td>
                        <td className="py-3 max-w-xs truncate" title={entry.reason}>
                          {entry.reason}
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Pending"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
