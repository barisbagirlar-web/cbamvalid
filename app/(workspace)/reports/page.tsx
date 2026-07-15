"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getReports, type SealedReportRecord } from "@/lib/functions/client";
import { FileText, Lock } from "lucide-react";

function formatDate(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

function reportHash(record: SealedReportRecord): string | undefined {
  const value = record.documentHash;
  return typeof value === "string" && value.trim() ? value : undefined;
}

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<SealedReportRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchReports = async () => {
      setDataLoading(true);
      try {
        setReports(await getReports());
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setDataLoading(false);
      }
    };

    void fetchReports();
  }, [user, loading]);

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-kil-text/20 border-t-kil-accent" />
          <p className="font-mono text-sm uppercase tracking-widest text-kil-text/60">Loading Reports...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-border pb-6">
          <h1 className="font-serif text-3xl font-extrabold tracking-tight">Sealed Reports History</h1>
          <p className="mt-1 text-sm text-muted">Review and download every sealed dossier release.</p>
        </header>

        {reports.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-surface p-12 text-center shadow-sm">
            <Lock className="mx-auto mb-4 h-10 w-10 text-muted/65" />
            <h2 className="mb-2 text-xl font-bold">No Sealed Reports Found</h2>
            <p className="text-sm leading-relaxed text-muted">
              Complete a case and seal its deliverables. The resulting release will appear here.
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold">{reports.length} sealed release{reports.length === 1 ? "" : "s"}</p>
              <p className="text-xs text-muted">Complete report history</p>
            </div>
            <div className="space-y-4">
              {reports.map((report) => {
                const documentHash = reportHash(report);
                return (
                  <article key={report.reportId} className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Release {report.releaseVersion}</p>
                      <p className="mt-1 text-xs font-mono text-muted">
                        Report {report.reportId.slice(0, 12)}… · Case {report.caseId.slice(0, 12)}… · Sealed {formatDate(report.createdAt)}
                      </p>
                      {documentHash && (
                        <p className="mt-1 max-w-md truncate text-[11px] font-mono text-muted" title={documentHash}>
                          Hash: {documentHash}
                        </p>
                      )}
                    </div>
                    <Link href={`/cbam/reports/${report.reportId}`} className="inline-flex items-center justify-center gap-1.5 self-end rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/90 sm:self-auto">
                      <FileText className="h-3.5 w-3.5" /> View Dossier
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
