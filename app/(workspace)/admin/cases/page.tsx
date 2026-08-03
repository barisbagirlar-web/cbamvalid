import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchAllCases } from "../actions";
import Link from "next/link";
import { redirect } from "next/navigation";

const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const TEB232_EMAIL = "teb232@gmail.com";

const RELEASE_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface border-border text-muted",
  INCOMPLETE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  REVIEW_REQUIRED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  READY_WITH_WARNINGS: "bg-accent/10 text-accent border-accent/20",
  READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION: "bg-accent/10 text-accent border-accent/20",
  SEALED: "bg-accent/10 text-accent border-accent/20",
  SUPERSEDED: "bg-surface border-border text-muted",
  REVOKED: "bg-status-blocked/10 text-status-blocked border-status-blocked/20",
};

export default async function AdminCasesPage() {
  const admin = await requireSuperAdmin();
  const email = String(admin.email || "").trim().toLowerCase();
  if (admin.uid === TEB232_UID && email === TEB232_EMAIL) {
    redirect("/cases");
  }

  const cases = await fetchAllCases();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Cases Management</h1>
          <p className="text-muted text-sm mt-1">All working files across tenants.</p>
        </div>
        <div className="text-sm text-muted font-mono">{cases.length} cases</div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Owner UID</th>
                <th className="py-3 px-4">Installation</th>
                <th className="py-3 px-4">Reporting Year</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((item) => (
                <tr key={item.caseId} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 font-mono text-xs text-foreground break-all">{item.caseId}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{item.uid}</td>
                  <td className="py-3 px-4">{item.installationName || "—"}</td>
                  <td className="py-3 px-4">{item.reportingYear || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${RELEASE_STATUS_STYLES[item.releaseStatus] || "bg-surface border-border text-muted"}`}>
                      {item.releaseStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/cases/${item.caseId}`}
                      className="text-xs font-medium text-accent hover:text-accent-hover underline underline-offset-2"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No cases found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
