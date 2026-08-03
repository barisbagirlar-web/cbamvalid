import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchCaseDetail } from "../../actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Database, FileText } from "lucide-react";

const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const TEB232_EMAIL = "teb232@gmail.com";

export default async function AdminCaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireSuperAdmin();
  const email = String(admin.email || "").trim().toLowerCase();
  if (admin.uid === TEB232_UID && email === TEB232_EMAIL) {
    redirect("/cases");
  }

  const { caseId } = await params;
  const item = await fetchCaseDetail(caseId);

  if (!item) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Link href="/admin/cases" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="w-3 h-3" /> Back to Cases
        </Link>
        <div className="p-8 bg-surface border border-border rounded-lg shadow-sm text-center space-y-3">
          <Database className="w-8 h-8 text-muted mx-auto" />
          <h1 className="text-lg font-bold font-serif text-foreground">Case not found</h1>
          <p className="text-muted text-sm">
            No case exists for <span className="font-mono">{caseId}</span>.
          </p>
        </div>
      </div>
    );
  }

  const installation = (item.installation || {}) as Record<string, unknown>;
  const goods = item.goods as Array<{ goodIndex?: unknown; cnCode?: unknown; sector?: unknown }>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/cases" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Cases
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Case Detail</h1>
          <p className="text-muted text-sm mt-1 font-mono break-all">{item.caseId}</p>
        </div>
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-surface border border-border text-muted">
          {item.releaseStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Identity</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Owner UID</span>
              <span className="font-mono text-xs text-foreground break-all">{item.uid}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Reporting Year</span>
              <span className="text-foreground">{item.reportingYear || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Created</span>
              <span className="text-xs text-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Updated</span>
              <span className="text-xs text-foreground">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Installation</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Name</span>
              <span className="text-foreground">
                {typeof installation?.name === "object" && (installation.name as Record<string, unknown>)?.value
                  ? String((installation.name as Record<string, unknown>).value)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Country</span>
              <span className="text-foreground">
                {typeof installation?.country === "object" && (installation.country as Record<string, unknown>)?.value
                  ? String((installation.country as Record<string, unknown>).value)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Route</span>
              <span className="text-foreground">
                {typeof installation?.productionRoute === "object" && (installation.productionRoute as Record<string, unknown>)?.value
                  ? String((installation.productionRoute as Record<string, unknown>).value)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Monitoring Plan ID</span>
              <span className="text-foreground">
                {typeof installation?.monitoringPlanId === "object" && (installation.monitoringPlanId as Record<string, unknown>)?.value
                  ? String((installation.monitoringPlanId as Record<string, unknown>).value)
                  : String(installation?.monitoringPlanId || "—")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Linked Goods</h3>
        {goods.length > 0 ? (
          <table className="w-full text-left text-sm text-foreground">
            <thead className="border-b border-border font-medium">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">CN Code</th>
                <th className="py-2 px-3">Sector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {goods.map((g, index) => (
                <tr key={index}>
                  <td className="py-2 px-3 font-mono text-xs">{String(g.goodIndex ?? index + 1)}</td>
                  <td className="py-2 px-3 font-mono text-xs">{String(g.cnCode ?? "—")}</td>
                  <td className="py-2 px-3 text-xs">{String(g.sector ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm">No goods linked.</p>
        )}
      </div>

      <div className="p-4 bg-surface border border-border rounded-lg shadow-sm text-sm text-muted flex items-start gap-3">
        <FileText className="w-5 h-5 shrink-0 mt-0.5 text-accent" />
        <p>
          Raw case snapshot is available for audit. Read-only view — case mutations flow through the
          sealed customer workflow.
        </p>
      </div>
    </div>
  );
}
