import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, Calendar, ShieldCheck, DollarSign } from "lucide-react";

export default async function AdminBillingPage() {
  await requireSuperAdmin();

  // Fetch Paddle event transactions
  const snapshot = await adminDb
    .collection("paddle_events")
    .orderBy("occurredAt", "desc")
    .limit(50)
    .get();

  const transactions = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      uid: d.uid || "N/A",
      eventType: d.eventType || d.event_type || "transaction.completed",
      amount: d.amount || d.details?.amount || 0,
      currency: d.currency || d.details?.currency || "USD",
      productCode: d.productCode || d.details?.product_code || "CBAM_CREDIT_PACK_5",
      occurredAt: d.occurredAt || d.timestamp || "",
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Billing & Purchases</h1>
          <p className="text-muted text-sm mt-1">Audit merchant transactions and payment processing.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-serif text-foreground">Transaction Log (Paddle webhook events)</h2>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Merchant of Record Mode</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <DollarSign className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No transaction events have been processed yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Event ID</th>
                  <th className="py-2">User UID</th>
                  <th className="py-2">Event Type</th>
                  <th className="py-2">Product</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Processed Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 font-mono text-xs text-accent">{tx.id}</td>
                    <td className="py-3 font-mono text-xs max-w-[150px] truncate" title={tx.uid}>
                      {tx.uid}
                    </td>
                    <td className="py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        {tx.eventType}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs">{tx.productCode}</td>
                    <td className="py-3 font-semibold text-foreground">
                      ${Number(tx.amount).toFixed(2)} {tx.currency}
                    </td>
                    <td className="py-3 text-xs text-muted">
                      {tx.occurredAt ? new Date(tx.occurredAt).toLocaleString() : "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>
          <strong>Merchant of Record Compliance:</strong> Transactions are handled independently via Paddle Sandbox. Webhook validation requires a matching `PADDLE_WEBHOOK_SECRET` configuration on the server runtime.
        </p>
      </div>
    </div>
  );
}
