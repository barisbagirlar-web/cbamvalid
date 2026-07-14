import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, TerminalSquare, Calendar } from "lucide-react";

export default async function AdminAuditLogPage() {
  await requireSuperAdmin();

  // Fetch admin audit logs
  const snapshot = await adminDb
    .collection("admin_audit_log")
    .orderBy("timestamp", "desc")
    .limit(50)
    .get();

  const logs = snapshot.docs.map((doc) => {
    const d = doc.data();
    let dateStr = "";
    if (d.timestamp) {
      if (typeof d.timestamp.toDate === "function") {
        dateStr = d.timestamp.toDate().toISOString();
      } else {
        dateStr = String(d.timestamp);
      }
    }
    return {
      id: doc.id,
      adminEmail: d.adminEmail || "System",
      action: d.action || "UNKNOWN",
      targetType: d.targetType || "N/A",
      targetId: d.targetId || "N/A",
      details: d.details ? JSON.stringify(d.details) : "{}",
      timestamp: dateStr,
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Audit Log Management</h1>
          <p className="text-muted text-sm mt-1">Review administrator events, manual updates, and authorization changes.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <TerminalSquare className="w-4 h-4 text-accent" />
          <span>Platform Audit Trail</span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <TerminalSquare className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No administrative audit entries found yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Timestamp</th>
                  <th className="py-2">Admin Email</th>
                  <th className="py-2">Action</th>
                  <th className="py-2">Target</th>
                  <th className="py-2">Target ID</th>
                  <th className="py-2">Metadata Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Unknown"}
                    </td>
                    <td className="py-3 font-semibold text-foreground">{log.adminEmail}</td>
                    <td className="py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-accent/15 text-accent">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-muted text-xs uppercase">{log.targetType}</td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={log.targetId}>
                      {log.targetId}
                    </td>
                    <td className="py-3 font-mono text-xs text-muted max-w-xs truncate" title={log.details}>
                      {log.details}
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
