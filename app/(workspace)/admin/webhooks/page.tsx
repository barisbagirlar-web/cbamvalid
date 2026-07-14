import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, Globe, Calendar, CheckCircle2 } from "lucide-react";

export default async function AdminWebhooksPage() {
  await requireSuperAdmin();

  // Fetch Paddle event webhook events
  const snapshot = await adminDb
    .collection("paddle_events")
    .orderBy("occurredAt", "desc")
    .limit(50)
    .get();

  const webhooks = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      eventType: d.eventType || d.event_type || "transaction.completed",
      transactionId: d.transactionId || d.details?.transaction_id || "N/A",
      occurredAt: d.occurredAt || d.timestamp || "",
      uid: d.uid || "System",
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Webhooks Management</h1>
          <p className="text-muted text-sm mt-1">Audit merchant webhook notifications and asynchronous integrations.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Globe className="w-4 h-4 text-accent" />
          <span>Paddle Webhook Receiver Logs</span>
        </div>

        {webhooks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <Globe className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No webhook events have been delivered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Event ID</th>
                  <th className="py-2">Event Name</th>
                  <th className="py-2">Tx ID</th>
                  <th className="py-2">Assigned UID</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Occurred At</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 font-mono text-xs text-accent">{wh.id}</td>
                    <td className="py-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {wh.eventType}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted">{wh.transactionId}</td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={wh.uid}>
                      {wh.uid}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> DELIVERED
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {wh.occurredAt ? new Date(wh.occurredAt).toLocaleString() : "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
