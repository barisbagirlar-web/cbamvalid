import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchWebhookEvents } from "../actions";

const STATE_STYLES: Record<string, string> = {
  PROCESSING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  SUCCESS: "bg-accent/10 text-accent border-accent/20",
  FAILED: "bg-status-blocked/10 text-status-blocked border-status-blocked/20",
};

export default async function AdminWebhooksPage() {
  await requireSuperAdmin();
  const events = await fetchWebhookEvents();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Webhooks Management</h1>
          <p className="text-muted text-sm mt-1">
            Incoming Paddle webhook events with signature verification and processing state.
          </p>
        </div>
        <div className="text-sm text-muted font-mono">{events.length} events</div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4 text-right">Attempts</th>
                <th className="py-3 px-4">Signature Verified</th>
                <th className="py-3 px-4">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.eventId} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 font-mono text-xs text-foreground break-all">{event.eventId}</td>
                  <td className="py-3 px-4 font-mono text-xs">{event.eventType}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${STATE_STYLES[event.processingState] || "bg-surface border-border text-muted"}`}>
                      {event.processingState}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{event.attempts}</td>
                  <td className="py-3 px-4">
                    <span className={event.signatureVerified ? "text-accent font-semibold" : "text-status-blocked font-semibold"}>
                      {event.signatureVerified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                    {event.receivedAt ? new Date(event.receivedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">No webhook events found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
