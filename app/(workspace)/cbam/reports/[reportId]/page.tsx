"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
  { format: "zip", label: "Complete 27-component package", description: "Signed ZIP dossier with evidence copies", icon: FileArchive },
  { format: "pdf", label: "Operator emissions report", description: "Primary multi-page verifier-preparation PDF", icon: FileText },
  { format: "xlsx", label: "Verifier workspace", description: "Controlled XLSX with checks, sources and sign-off", icon: FileSpreadsheet },
  { format: "manifest", label: "Data integrity manifest", description: "Canonical file hashes and package contract", icon: FileJson },
  { format: "signature", label: "KMS signature", description: "Asymmetric manifest signature record", icon: KeyRound },
  { format: "snapshot", label: "Immutable case snapshot", description: "Exact sealed source-data representation", icon: Fingerprint },
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
  const [downloadError, setDownloadError] = useState("");
  const [activeDownload, setActiveDownload] = useState<ReportDownloadFormat | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    void getReport(reportId)
      .then((value) => {
        if (cancelled) return;
        setReport(value);
        setError("");
        setDataLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error("Sealed report load failed", loadError);
        setReport(null);
        setError(describeError(loadError));
        setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, loading, reportId, user]);

  const storageByFile = useMemo(() => report?.storage || {}, [report]);

  const retry = () => {
    setDataLoading(true);
    setError("");
    setAttempt((current) => current + 1);
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
  const ready = report.automatedReadiness === "READY_FOR_INDEPENDENT_VERIFICATION";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Reports
        </Link>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-accent" strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Sealed verifier-preparation package</p>
                  <h1 className="mt-1 font-serif text-3xl font-bold">Release {report.releaseVersion} · 27 controlled components</h1>
                </div>
              </div>
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
                This package supports preparation for independent accredited verification. It is not a verification opinion, accreditation decision, customs decision, CBAM Registry submission or acceptance guarantee.
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${ready ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>
              <div className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Automated preparation checks passed
              </div>
              <p className="mt-1 text-xs">Independent verifier status: {report.independentVerifierStatus}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total embedded emissions", `${calculation.totalEmbeddedEmissions} tCO2e`],
            ["Production volume", `${calculation.productionVolume} t`],
            ["Specific embedded emissions", `${calculation.specificEmbeddedEmissions} tCO2e/t`],
            ["Materiality reference", `${report.verificationMaterialityRate * 100}% per good`],
          ].map(([label, value]) => (
            <article key={label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-3 break-words font-mono text-lg font-bold">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-serif text-xl font-bold">Immutable trust chain</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Report ID", report.reportId],
                ["Case ID", report.caseId],
                ["Document / manifest hash", report.manifestHash],
                ["Package ZIP hash", report.packageHash],
                ["Case-data hash", report.caseDataHash],
                ["Calculation root hash", calculation.calculationRootHash],
                ["Legal-source registry hash", report.sourceHash],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 border-b border-border/60 pb-3 sm:grid-cols-[175px_1fr]">
                  <dt className="font-semibold text-muted">{label}</dt>
                  <dd className="break-all font-mono text-xs" title={value}>{shortHash(value)}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-serif text-xl font-bold">Signature and release controls</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["KMS algorithm", report.kmsAlgorithm],
                ["KMS key version", report.kmsKeyVersion],
                ["Ruleset version", report.rulesetVersion],
                ["Engine version", calculation.engineVersion],
                ["Allocation share total", calculation.allocationShareTotal],
                ["Allocation reconciliation delta", calculation.allocationReconciliationDelta],
                ["Sealed at", report.updatedAt],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 border-b border-border/60 pb-3 sm:grid-cols-[175px_1fr]">
                  <dt className="font-semibold text-muted">{label}</dt>
                  <dd className="break-all font-mono text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="font-serif text-2xl font-bold">Controlled downloads</h2>
              <p className="mt-2 text-sm text-muted">Each request checks the sealed storage index and object metadata before issuing a 15-minute signed URL.</p>
            </div>
            <a href={`/api/verify/${report.documentHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
              Verify document hash <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {downloadError && (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {downloadError}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DOWNLOADS.map((item) => {
              const Icon = item.icon;
              const fileName = item.format === "zip" ? "dossier.zip" : item.format === "pdf" ? "dossier.pdf" : item.format === "xlsx" ? "dossier.xlsx" : item.format === "manifest" ? "manifest.json" : item.format === "signature" ? "manifest.sig" : "case-snapshot.json";
              const storage = storageByFile[fileName];
              return (
                <button key={item.format} type="button" disabled={activeDownload !== null} onClick={() => void download(item.format)} className="group rounded-xl border border-border bg-background p-5 text-left transition hover:border-accent hover:bg-neutral-soft disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="flex items-start justify-between gap-4">
                    <Icon className="h-6 w-6 text-accent" strokeWidth={1.7} aria-hidden="true" />
                    {activeDownload === item.format ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4 text-muted group-hover:text-accent" aria-hidden="true" />}
                  </div>
                  <p className="mt-4 text-sm font-bold">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                  <p className="mt-3 font-mono text-[11px] text-muted">{storage ? `${formatBytes(storage.sizeBytes)} · ${shortHash(storage.sha256)}` : "Storage index unavailable"}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
