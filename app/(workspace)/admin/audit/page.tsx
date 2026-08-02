import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchAuditLog } from "../actions";

function summarizeDetails(details: Record<string, unknown>): string {
  try {
    const entries = Object.entries(details);
    if (entries.length === 0) return "—";
    return entries
      .filter(([key]) => key !== "reason")
      .map(([key, value]) => `${key}=${String(value).slice(0, 40)}`)
      .join(" · ");
  } catch {
    return "—";
  }
}

export default async function AdminAuditLogPage() {
  await requireSuperAdmin();
  const entries = await fetchAuditLog();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Audit Log</h1>
          <p className="text-muted text-sm mt-1">
            Append-only record of privileged admin actions.
          </p>
        </div>
        <div className="text-sm text-muted font-mono">{entries.length} entries</div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs">{entry.adminEmail || entry.adminId}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                      {entry.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted break-all">
                    {entry.targetType}:{entry.targetId}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted max-w-[320px] truncate">
                    {summarizeDetails(entry.details)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">No audit entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
