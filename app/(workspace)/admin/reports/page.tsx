import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchAllReports } from "../actions";
import Link from "next/link";

export default async function AdminReportsPage() {
  await requireSuperAdmin();
  const reports = await fetchAllReports();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Reports Management</h1>
          <p className="text-muted text-sm mt-1">All sealed and in-progress report records.</p>
        </div>
        <div className="text-sm text-muted font-mono">{reports.length} reports</div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Report ID</th>
                <th className="py-3 px-4">Owner UID</th>
                <th className="py-3 px-4">Installation</th>
                <th className="py-3 px-4 text-right">Release</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.reportId} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 font-mono text-xs text-foreground break-all">{report.reportId}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{report.uid}</td>
                  <td className="py-3 px-4">{report.installationName || "—"}</td>
                  <td className="py-3 px-4 text-right font-mono">v{report.releaseVersion}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                      {report.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                    {report.createdAt ? new Date(report.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/reports/${report.reportId}`}
                      className="text-xs font-medium text-accent hover:text-accent-hover underline underline-offset-2"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No reports found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
