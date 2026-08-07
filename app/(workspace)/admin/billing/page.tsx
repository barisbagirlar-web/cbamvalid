import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchBillingOverview } from "../actions";
import { Banknote, Key, Receipt } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-accent/10 text-accent border-accent/20",
  RESERVED: "bg-status-warning/10 text-status-warning border-status-warning/20",
  CONSUMED: "bg-surface border-border text-muted",
  REVOKED: "bg-status-blocked/10 text-status-blocked border-status-blocked/20",
};

export default async function AdminBillingPage() {
  await requireSuperAdmin();
  const overview = await fetchBillingOverview();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Billing &amp; Purchases</h1>
          <p className="text-muted text-sm mt-1">
            Commercial overview derived from entitlements, sealed reports, and Paddle webhook events.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-accent/5 border border-accent/20 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-accent">
            <Banknote className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Est. Gross Revenue</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-accent">
            ${overview.estimatedGrossRevenue.toFixed(2)}
          </p>
          <p className="text-xs text-muted mt-1">
            {overview.sealedCount} sealed report{overview.sealedCount === 1 ? "" : "s"} × ${overview.unitPrice.toFixed(2)} Single Pack
          </p>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <Key className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Entitlements</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-foreground">{overview.entitlements.length}</p>
          <p className="text-xs text-muted mt-1">Includes paid and legacy-unlock packs</p>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <Receipt className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Completed Webhooks</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-foreground">{overview.completedWebhookCount}</p>
          <p className="text-xs text-muted mt-1">
            Last event: {overview.lastEventAt ? new Date(overview.lastEventAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Entitlements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Entitlement</th>
                <th className="py-3 px-4">Owner UID</th>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Billing Model</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overview.entitlements.map((ent) => (
                <tr key={ent.entitlementId} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 font-mono text-xs text-foreground break-all">{ent.entitlementId}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{ent.uid}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{ent.orderId}</td>
                  <td className="py-3 px-4">{ent.productCode}</td>
                  <td className="py-3 px-4 font-mono text-xs">{ent.billingModel}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_STYLES[ent.status] || "bg-surface border-border text-muted"}`}>
                      {ent.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                    {ent.updatedAt ? new Date(ent.updatedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {overview.entitlements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No entitlements found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
