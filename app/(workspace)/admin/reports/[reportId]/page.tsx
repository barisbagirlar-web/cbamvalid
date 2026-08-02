import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchReportDetail } from "../../actions";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireSuperAdmin();
  const { reportId } = await params;

  const report = await fetchReportDetail(reportId);

  if (!report) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Link href="/admin/reports" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="w-3 h-3" /> Back to Reports
        </Link>
        <div className="p-8 bg-surface border border-border rounded-lg shadow-sm text-center space-y-3">
          <FileText className="w-8 h-8 text-muted mx-auto" />
          <h1 className="text-lg font-bold font-serif text-foreground">Report not found</h1>
          <p className="text-muted text-sm">
            No report exists for <span className="font-mono">{reportId}</span>.
          </p>
        </div>
      </div>
    );
  }

  const calc = (report.calculation || {}) as Record<string, unknown>;
  const pkg = (report.packageMetadata || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/reports" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Reports
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Report Detail</h1>
          <p className="text-muted text-sm mt-1 font-mono break-all">{report.reportId}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
            {report.status}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-surface border border-border text-muted">
            v{report.releaseVersion}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Record</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Owner UID</span>
              <span className="font-mono text-xs text-foreground break-all">{report.uid}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Case ID</span>
              <span className="font-mono text-xs text-foreground break-all">{report.caseId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Entitlement</span>
              <span className="font-mono text-xs text-foreground break-all">{report.entitlementId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Installation</span>
              <span className="text-foreground">{report.installationName || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Sealed At</span>
              <span className="text-xs text-foreground">{report.createdAt ? new Date(report.createdAt).toLocaleString() : "—"}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Integrity Hashes</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Document</span>
              <span className="font-mono text-xs text-foreground break-all">{report.documentHash || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Manifest</span>
              <span className="font-mono text-xs text-foreground break-all">{report.manifestHash || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Package</span>
              <span className="font-mono text-xs text-foreground break-all">{report.packageHash || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Calculation Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted shrink-0">Total Embedded Emissions</span>
            <span className="font-mono text-foreground">{String(calc.totalEmbeddedEmissions ?? "—")} tCO₂e</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted shrink-0">Specific Embedded Emissions</span>
            <span className="font-mono text-foreground">{String(calc.specificEmbeddedEmissions ?? "—")} tCO₂e/t</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted shrink-0">Ruleset</span>
            <span className="font-mono text-xs text-foreground">{String(calc.ruleset ?? "—")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted shrink-0">Engine</span>
            <span className="font-mono text-xs text-foreground">{String(calc.engineVersion ?? "—")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted shrink-0">Calculation Root Hash</span>
            <span className="font-mono text-xs text-foreground break-all">{String(calc.calculationRootHash ?? "—")}</span>
          </div>
        </div>
      </div>

      {Object.keys(pkg).length > 0 && (
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Package Metadata</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Schema Version</span>
              <span className="font-mono text-xs text-foreground">{String(pkg.schemaVersion ?? "—")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Top-Level Components</span>
              <span className="font-mono text-foreground">{String(pkg.actualTopLevelComponentCount ?? "—")} / {String(pkg.requiredTopLevelComponentCount ?? "—")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Manifest Files</span>
              <span className="font-mono text-foreground">{String(pkg.manifestFileCount ?? "—")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted shrink-0">Evidence Files</span>
              <span className="font-mono text-foreground">{String(pkg.evidenceFileCount ?? "—")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
