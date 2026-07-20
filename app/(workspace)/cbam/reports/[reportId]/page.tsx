"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { ReportDownloadFormat, SealedReportView } from "@/lib/cbam/report-contract";
import { getReport, getReportDownload } from "@/lib/functions/client";

const DOWNLOADS: Array<{
  format: ReportDownloadFormat;
  label: string;
  description: string;
  icon: typeof Download;
}> = [
  { format: "pdf", label: "Main dossier PDF", description: "Primary Verification Readiness & Evidence Assurance PDF", icon: FileText },
  { format: "xlsx", label: "Verifier spreadsheet", description: "Controlled verifier workspace spreadsheet", icon: FileSpreadsheet },
  { format: "manifest", label: "Integrity manifest", description: "Canonical file hashes and package contract", icon: FileJson },
  { format: "signature", label: "KMS signature record", description: "Asymmetric KMS cryptographic signature", icon: KeyRound },
  { format: "snapshot", label: "Immutable case snapshot", description: "Exact sealed case database snapshot", icon: Fingerprint },
];

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The sealed verifier-preparation package could not be loaded.";
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-12)}`;
}

export default function SealedReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params);
  const { user, loading } = useAuth();
  const [report, setReport] = useState<SealedReportView | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDownload, setActiveDownload] = useState<ReportDownloadFormat | null>(null);
  const [downloadError, setDownloadError] = useState("");
  
  const [showAdvancedDownloads, setShowAdvancedDownloads] = useState(false);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    let active = true;
    const loadData = async () => {
      setDataLoading(true);
      setError("");
      try {
        const data = await getReport(reportId);
        if (active) {
          setReport(data);
        }
      } catch (loadFailure: unknown) {
        console.error("Failed to load sealed report data", loadFailure);
        if (active) {
          setError(describeError(loadFailure));
        }
      } finally {
        if (active) {
          setDataLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [user, reportId, retryCount]);

  const retry = () => {
    setRetryCount((prev) => prev + 1);
  };

  const download = async (format: ReportDownloadFormat) => {
    if (!report) return;
    setActiveDownload(format);
    setDownloadError("");
    try {
      const descriptor = await getReportDownload(report.reportId, format);
      const anchor = document.createElement("a");
      anchor.href = descriptor.url;
      anchor.rel = "noopener";
      anchor.download = descriptor.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (downloadFailure: unknown) {
      console.error("Immutable report download failed", downloadFailure);
      setDownloadError(describeError(downloadFailure));
    } finally {
      setActiveDownload(null);
    }
  };

  if (!loading && !user) return null;

  if (loading || dataLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-2xl font-bold">Loading sealed verifier package</h1>
          <p className="mt-2 text-sm text-muted">Validating the immutable report record and trust-chain metadata.</p>
        </section>
      </main>
    );
  }

  if (!user) return null;

  if (error || !report) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">Sealed package could not be loaded</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error || "The report response was empty."}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={retry} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
            </button>
            <Link href="/reports" className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft">Back to Reports</Link>
          </div>
        </section>
      </main>
    );
  }

  if (report.uid !== user.uid) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-7 w-7 text-red-700" aria-hidden="true" />
          <h1 className="mt-4 font-serif text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-muted">This sealed package does not belong to the authenticated account.</p>
          <Link href="/reports" className="mt-6 inline-flex h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-semibold hover:bg-neutral-soft">Back to Reports</Link>
        </section>
      </main>
    );
  }

  const calculation = report.calculation;
  const storageByFile = report.storage || {};
  
  // Successful automated readiness state is READY_FOR_VERIFIER_REVIEW in V5
  const isV5 = report.dossierSchemaVersion === "CBAMVALID-DOSSIER-5.0";
  const ready = report.automatedReadiness === "READY_FOR_INDEPENDENT_VERIFICATION" || report.automatedReadiness === "READY_FOR_VERIFIER_REVIEW";
  
  const componentCount = report.packageTopLevelComponentCount;
  const zipFileIndex = storageByFile["dossier.zip"] || storageByFile["Complete signed dossier package.zip"];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Reports
        </Link>

        {/* Primary Download Card */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between gap-6 md:items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-accent" strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Sealed verifier-preparation dossier</p>
                  <h1 className="mt-1 font-serif text-3xl font-bold font-serif">Release {report.releaseVersion} · {componentCount} controlled components</h1>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                CBAMValid prepares an operator/exporter dossier for independent verification. It does not issue an accredited verification opinion, customs decision, EU approval or CBAM Registry acceptance guarantee.
              </p>
            </div>

            <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0">
              <button
                type="button"
                disabled={activeDownload !== null}
                onClick={() => void download("zip")}
                className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-accent text-surface px-6 font-semibold hover:bg-accent-hover active:bg-accent-active transition-colors shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {activeDownload === "zip" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileArchive className="h-5 w-5" />
                )}
                Download Complete Signed Dossier Package
              </button>
              {zipFileIndex && (
                <span className="text-[11px] text-muted text-center md:text-right font-mono">
                  ZIP Size: {formatBytes(zipFileIndex.sizeBytes)} · SHA: {shortHash(zipFileIndex.sha256)}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">The signed package contains:</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Main dossier PDF (Verification Readiness & Evidence Assurance)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Technical compilation (Complete Dossier Compilation PDF)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Verifier spreadsheet (Verifier Workspace Excel)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Evidence register & linked file metadata
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Calculation trace (JSON audit trace log)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Integrity manifest & KMS signature files
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                Supporting evidence file binary copies ({report.packageMetadata?.evidenceFileCount || 0} files)
              </li>
            </ul>
          </div>

          {downloadError && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {downloadError}
            </div>
          )}
        </section>

        {/* Report Summary section */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="font-serif text-xl font-bold">Report Summary</h2>
            <div className={`rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5 ${ready ? "bg-accent-soft text-accent border border-accent/20" : "bg-red-50 text-red-800 border border-red-200"}`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isV5 ? "Automated preparation checks passed" : "Automated preparation checks passed"}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Installation Name</p>
                <p className="text-sm font-semibold text-foreground mt-1">{report.installationName || "Fictional Installation"}</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Reporting Year & Period</p>
                <p className="text-sm font-semibold text-foreground mt-1">Calendar Year {report.calculation.ruleset.substring(0, 4)}</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Automated Readiness</p>
                <p className="text-sm font-semibold text-foreground mt-1">Ready for independent verifier review</p>
                <p className="text-[11px] text-muted">Independent verifier status: Not reviewed</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Sealed Date</p>
                <p className="text-sm font-semibold text-foreground mt-1">{new Date(report.updatedAt).toLocaleDateString()} {new Date(report.updatedAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Total Embedded Emissions</p>
                <p className="text-sm font-bold text-foreground mt-1 font-mono">{calculation.totalEmbeddedEmissions} tCO2e</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Production Quantity</p>
                <p className="text-sm font-bold text-foreground mt-1 font-mono">{calculation.productionVolume} t</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Specific Embedded Emissions</p>
                <p className="text-sm font-bold text-foreground mt-1 font-mono">{calculation.specificEmbeddedEmissions} tCO2e/t</p>
              </div>
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider">Package Integrity Status</p>
                <p className="text-sm font-semibold text-accent mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Cryptographically Sealed & Signed ({componentCount} Components)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Expandable Section 1: Advanced Downloads */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvancedDownloads(!showAdvancedDownloads)}
            className="w-full px-6 py-4 flex items-center justify-between font-serif font-bold text-lg hover:bg-neutral-soft/50 transition-colors"
          >
            <span>Advanced Downloads</span>
            {showAdvancedDownloads ? <ChevronUp className="h-5 w-5 text-muted" /> : <ChevronDown className="h-5 w-5 text-muted" />}
          </button>
          
          {showAdvancedDownloads && (
            <div className="px-6 pb-6 pt-2 border-t border-border/60 bg-background/30">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 mt-4">
                {DOWNLOADS.map((item) => {
                  const Icon = item.icon;
                  const fileKey = item.format === "pdf" ? "Product Scope Assessment.pdf" : item.format === "xlsx" ? "Verifier Workspace.xlsx" : item.format === "manifest" ? "Data Integrity Manifest.json" : item.format === "signature" ? "Manifest Signature.sig" : "Calculation Trace.json";
                  const storage = storageByFile[fileKey];
                  return (
                    <button
                      key={item.format}
                      type="button"
                      disabled={activeDownload !== null}
                      onClick={() => void download(item.format)}
                      className="group rounded-xl border border-border bg-surface p-4 text-left transition hover:border-accent hover:bg-neutral-soft/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Icon className="h-5 w-5 text-accent" strokeWidth={1.7} aria-hidden="true" />
                        {activeDownload === item.format ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4 text-muted group-hover:text-accent" aria-hidden="true" />}
                      </div>
                      <p className="mt-3 text-sm font-bold text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-muted leading-relaxed">{item.description}</p>
                      <p className="mt-2 font-mono text-[10px] text-muted">{storage ? `${formatBytes(storage.sizeBytes)} · ${shortHash(storage.sha256)}` : "Storage index unavailable"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Expandable Section 2: Integrity and Technical Details */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setShowIntegrityDetails(!showIntegrityDetails)}
            className="w-full px-6 py-4 flex items-center justify-between font-serif font-bold text-lg hover:bg-neutral-soft/50 transition-colors"
          >
            <span>Integrity and Technical Details</span>
            {showIntegrityDetails ? <ChevronUp className="h-5 w-5 text-muted" /> : <ChevronDown className="h-5 w-5 text-muted" />}
          </button>
          
          {showIntegrityDetails && (
            <div className="px-6 pb-6 pt-2 border-t border-border/60 divide-y divide-border/60 text-sm">
              {[
                ["Report ID", report.reportId],
                ["Case ID", report.caseId],
                ["Document / Manifest Hash", report.manifestHash],
                ["Package ZIP Hash", report.packageHash],
                ["Case-Data Hash", report.caseDataHash],
                ["Calculation Root Hash", calculation.calculationRootHash],
                ["Legal-Source Registry Hash", report.sourceHash],
                ["KMS Cryptographic Algorithm", report.kmsAlgorithm],
                ["KMS Key Version ID", report.kmsKeyVersion],
                ["Ruleset Schema Version", report.rulesetVersion],
                ["Engine Version", calculation.engineVersion],
                ["Allocation Share Total", calculation.allocationShareTotal],
                ["Allocation Reconciliation Delta", calculation.allocationReconciliationDelta],
                ["Document Seal Signature (Base64)", report.signatureBase64],
              ].map(([label, value]) => (
                <div key={label} className="py-3 grid gap-1 sm:grid-cols-[220px_1fr]">
                  <span className="font-semibold text-muted">{label}</span>
                  <span className="break-all font-mono text-xs text-foreground" title={value}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
