"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Download, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { getReport, getReportDownloadUrl } from "@/lib/functions/client";

export default function SealedReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params);
  const { user, loading } = useAuth();
  const [report, setReport] = useState<any | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [downloading, setDownloading] = useState<"zip" | "manifest" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    setDataLoading(true);
    getReport(reportId)
      .then((data) => setReport(data || null))
      .catch((fetchError) => {
        console.error("Report fetch failed", fetchError);
        setError("The sealed release could not be loaded.");
      })
      .finally(() => setDataLoading(false));
  }, [user, loading, reportId]);

  const handleDownload = async (format: "zip" | "manifest") => {
    setDownloading(format);
    setError("");
    try {
      const signedUrl = await getReportDownloadUrl(reportId, format);
      window.location.assign(signedUrl);
    } catch (downloadError) {
      console.error("Release download failed", downloadError);
      setError("The release artifact could not be downloaded. Please retry.");
    } finally {
      setDownloading(null);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user || !report || report.uid !== user.uid) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border text-center p-6 rounded-xl shadow-sm">
          <p className="text-sm font-bold text-accent">Release not found or access denied</p>
          <Link href="/reports" className="mt-4 inline-flex h-10 items-center rounded-md border border-border px-4 text-xs font-semibold hover:bg-neutral-soft">
            Return to Reports
          </Link>
        </div>
      </div>
    );
  }

  const calculation = report.calculation || {};

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>

        {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-accent" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">Sealed verifier-preparation release</p>
                  <h1 className="mt-1 text-2xl font-serif font-bold">Release Version {report.releaseVersion}</h1>
                </div>
              </div>
              <dl className="mt-5 grid gap-2 text-xs text-muted">
                <div><dt className="inline font-bold text-foreground">Release ID: </dt><dd className="inline font-mono">{report.reportId}</dd></div>
                <div><dt className="inline font-bold text-foreground">Case ID: </dt><dd className="inline font-mono">{report.caseId}</dd></div>
                <div><dt className="inline font-bold text-foreground">Created: </dt><dd className="inline">{new Date(report.createdAt).toLocaleString()}</dd></div>
              </dl>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => handleDownload("zip")} disabled={downloading !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
                {downloading === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Verifier Package
              </button>
              <button onClick={() => handleDownload("manifest")} disabled={downloading !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-semibold hover:bg-neutral-soft disabled:opacity-50">
                {downloading === "manifest" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Download Manifest
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-bold">Emissions result</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Metric label="Total direct emissions" value={`${calculation.totalDirectEmissions || "—"} tCO2e`} />
              <Metric label="Total indirect emissions" value={`${calculation.totalIndirectEmissions || "—"} tCO2e`} />
              <Metric label="Total embedded emissions" value={`${calculation.totalEmbeddedEmissions || "—"} tCO2e`} />
              <Metric label="Specific embedded emissions" value={`${calculation.specificEmbeddedEmissions || "—"} tCO2e/t`} strong />
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-bold">Package integrity</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Metric label="Top-level components" value={String(report.packageTopLevelComponentCount || "—")} />
              <Metric label="Manifest-verified files" value={String(report.verifiedFileCount || "—")} />
              <Metric label="Ruleset" value={report.ruleset || "—"} />
              <Metric label="Engine version" value={report.engineVersion || "—"} />
            </dl>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-bold">Integrity identifiers</h2>
          <div className="mt-4 space-y-4 text-xs">
            <HashLine label="Package SHA-256" value={report.documentHash} />
            <HashLine label="Manifest SHA-256" value={report.manifestHash} />
            <HashLine label="Calculation root SHA-256" value={report.calculationRootHash} />
            <HashLine label="Evidence root SHA-256" value={report.evidenceRootHash} />
          </div>
        </section>

        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-950">
          <h2 className="font-bold">Verification boundary</h2>
          <p className="mt-2 leading-relaxed">
            This immutable release prepares installation, emissions and evidence data for independent verification. It is not an accredited verification opinion, customs approval, EU approval or acceptance guarantee. The O3CI field mapping in the package is not an official Registry submission file.
          </p>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2"><dt className="text-muted">{label}</dt><dd className={`text-right font-mono ${strong ? "font-bold text-accent" : "font-semibold"}`}>{value}</dd></div>;
}

function HashLine({ label, value }: { label: string; value?: string }) {
  return <div><p className="mb-1 font-bold text-foreground">{label}</p><p className="break-all rounded-md bg-background p-3 font-mono text-muted">{value || "NOT_PROVEN"}</p></div>;
}
