import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchAllEntitlements } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-accent/10 text-accent border-accent/20",
  RESERVED: "bg-status-warning/10 text-status-warning border-status-warning/20",
  CONSUMED: "bg-surface border-border text-muted",
  REVOKED: "bg-status-blocked/10 text-status-blocked border-status-blocked/20",
};

export default async function AdminEntitlementsPage() {
  await requireSuperAdmin();
  const entitlements = await fetchAllEntitlements();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Entitlements</h1>
          <p className="text-muted text-sm mt-1">
            Pack entitlements issued by Paddle checkouts and legacy credit unlocks.
          </p>
        </div>
        <div className="text-sm text-muted font-mono">{entitlements.length} records</div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Entitlement</th>
                <th className="py-3 px-4">Owner UID</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Billing Model</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Releases</th>
                <th className="py-3 px-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entitlements.map((ent) => (
                <tr key={ent.entitlementId} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs text-foreground break-all">{ent.entitlementId}</div>
                    {ent.scopeCaseId && (
                      <div className="text-xs text-muted mt-1 font-mono break-all">case: {ent.scopeCaseId}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{ent.uid}</td>
                  <td className="py-3 px-4">{ent.productCode}</td>
                  <td className="py-3 px-4 font-mono text-xs">{ent.billingModel}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_STYLES[ent.status] || "bg-surface border-border text-muted"}`}>
                      {ent.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {ent.releasesCount}/{ent.maxReleases}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted">
                    {ent.createdAt ? new Date(ent.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {entitlements.length === 0 && (
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
