"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import {
  getCases,
  getEntitlements,
  getReports,
  type CbamCaseRecord,
  type PreparationPackEntitlement,
  type SealedReportRecord,
} from "@/lib/functions/client";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Info,
  Lock,
  PlayCircle,
  Plus,
  ShoppingBag,
} from "lucide-react";

const RECENT_ITEM_LIMIT = 3;

const requiredData = [
  "Installation and operator details",
  "Reporting year",
  "Goods and CN codes",
  "Production quantities",
  "Fuel and electricity consumption",
  "Direct and indirect emissions data",
  "Precursor information, where applicable",
  "Meter, invoice and production records",
  "Supporting evidence documents",
] as const;

function formatDate(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

function caseInstallationName(record: CbamCaseRecord): string {
  const value = record.data?.installation?.name?.value;
  return typeof value === "string" && value.trim() ? value : "Unnamed Installation";
}

function caseCnCode(record: CbamCaseRecord): string {
  const value = record.data?.goods?.[0]?.cnCode?.value;
  return typeof value === "string" && value.trim() ? value : "Pending";
}

function timestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function CbamDashboardPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<CbamCaseRecord[]>([]);
  const [reports, setReports] = useState<SealedReportRecord[]>([]);
  const [entitlements, setEntitlements] = useState<PreparationPackEntitlement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [caseRecords, reportRecords, entitlementRecords] = await Promise.all([
          getCases(),
          getReports(),
          getEntitlements(),
        ]);
        setCases(caseRecords);
        setReports(reportRecords);
        setEntitlements(entitlementRecords);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setDataLoading(false);
      }
    };

    void fetchData();
  }, [user, loading]);

  const recentCases = useMemo(
    () => [...cases].sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt)).slice(0, RECENT_ITEM_LIMIT),
    [cases],
  );

  const recentReports = useMemo(
    () => [...reports].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, RECENT_ITEM_LIMIT),
    [reports],
  );

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6" />
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const latestCase = recentCases[0];
  const availableReleaseCount = entitlements.length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted">
              Monitor dossier activity, recent releases and preparation-pack capacity from one overview.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/cases/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-3.5 w-3.5" /> Create New Case
            </Link>
            <Link
              href="/cases"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft"
            >
              View All Cases <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Workspace summary">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Active Cases</p>
            <p className="mt-3 text-3xl font-bold">{cases.length}</p>
            <Link href="/cases" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Manage cases <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sealed Reports</p>
            <p className="mt-3 text-3xl font-bold">{reports.length}</p>
            <Link href="/reports" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Open reports <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Available Release Seals</p>
            <p className="mt-3 text-3xl font-bold">{availableReleaseCount}</p>
            <Link href="/credits/buy" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Billing & packs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Latest Activity</p>
            <p className="mt-3 text-sm font-bold">
              {latestCase ? formatDate(latestCase.updatedAt) : "No case activity"}
            </p>
            <p className="mt-2 text-xs text-muted">
              {latestCase ? caseInstallationName(latestCase) : "Create a case to begin the dossier workflow."}
            </p>
          </div>
        </section>

        {cases.length === 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-10">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Info className="h-3.5 w-3.5" /> Exporter Verification Preparation Pack
            </span>
            <h2 className="font-serif text-2xl font-extrabold md:text-3xl">Prepare Your CBAM Verification Package</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
              Start one structured case for an installation and reporting year. The dashboard will then show only recent activity; complete case management remains in Cases and sealed deliverables remain in Reports.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cases/new"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover"
              >
                Create Your First Dossier <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setShowChecklist((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-neutral-soft"
              >
                <HelpCircle className="h-4 w-4" /> Review Required Data
              </button>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-neutral-soft"
              >
                <PlayCircle className="h-4 w-4" /> Watch Walkthrough
              </Link>
            </div>
            {showChecklist && (
              <div className="mt-6 rounded-xl border border-border bg-background p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> Required Data & Evidence Checklist
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted md:grid-cols-2">
                  {requiredData.map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-lg border border-border/50 bg-surface p-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recommended next action</p>
              <h2 className="mt-2 font-serif text-2xl font-bold">Continue your latest case</h2>
              <p className="mt-2 text-sm text-muted">
                {caseInstallationName(latestCase)} · CN {caseCnCode(latestCase)} · Updated {formatDate(latestCase.updatedAt)}
              </p>
            </div>
            <Link
              href={`/cases/${latestCase.caseId}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover"
            >
              Resume Case <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-bold">Recent Cases</h2>
                  <p className="mt-1 text-xs text-muted">The three most recently updated cases.</p>
                </div>
                <Link href="/cases" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  View All Cases <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {recentCases.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background p-7 text-center">
                  <Clock className="mx-auto mb-3 h-7 w-7 text-muted/70" />
                  <p className="text-sm font-semibold">No recent cases</p>
                  <p className="mt-1 text-xs text-muted">Create a dossier to populate this activity summary.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCases.map((record) => (
                    <article key={record.caseId} className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{caseInstallationName(record)}</p>
                        <p className="mt-1 text-xs font-mono text-muted">
                          CN {caseCnCode(record)} · {record.status || record.data.status} · Updated {formatDate(record.updatedAt)}
                        </p>
                      </div>
                      <Link href={`/cases/${record.caseId}`} className="inline-flex items-center gap-1 self-end text-xs font-semibold text-accent hover:underline sm:self-auto">
                        Resume <ArrowRight className="h-3 w-3" />
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-bold">Recent Reports</h2>
                  <p className="mt-1 text-xs text-muted">The three most recently sealed releases.</p>
                </div>
                <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  View All Reports <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {recentReports.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background p-7 text-center">
                  <Lock className="mx-auto mb-3 h-7 w-7 text-muted/70" />
                  <p className="text-sm font-semibold">No sealed reports</p>
                  <p className="mt-1 text-xs text-muted">Sealed releases will appear here after package generation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <article key={report.reportId} className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Release {report.releaseVersion}</p>
                        <p className="mt-1 text-xs font-mono text-muted">
                          {report.reportId.slice(0, 12)}… · Sealed {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <Link href={`/cbam/reports/${report.reportId}`} className="inline-flex items-center gap-1 self-end text-xs font-semibold text-accent hover:underline sm:self-auto">
                        View Dossier <ArrowRight className="h-3 w-3" />
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Preparation Pack</h2>
              {availableReleaseCount > 0 ? (
                <div className="mt-4 rounded-lg border border-accent/15 bg-accent/5 p-4 text-sm">
                  <span className="block font-bold text-accent">Active release capacity</span>
                  <p className="mt-1 text-xs text-muted">{availableReleaseCount} sealed release allocation(s) currently available.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-border bg-neutral-soft p-4 text-xs leading-relaxed text-muted">
                    <span className="mb-1 block font-bold text-foreground">No Active Pack</span>
                    Purchase a Preparation Pack before sealing final verifier-preparation deliverables.
                  </div>
                  <Link
                    href="/credits/buy"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" /> Buy Pack — $150
                  </Link>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Workspace Destinations</h2>
              <div className="mt-4 space-y-3 text-sm">
                <Link href="/cases" className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-neutral-soft">
                  <span>Complete case management</span><ArrowRight className="h-4 w-4 text-muted" />
                </Link>
                <Link href="/reports" className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-neutral-soft">
                  <span>Complete report history</span><ArrowRight className="h-4 w-4 text-muted" />
                </Link>
                <Link href="/cbam/methodology" className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-neutral-soft">
                  <span>Methodology & Sources</span><ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Resources</h2>
              <div className="mt-4 space-y-2.5 text-xs text-accent">
                <Link href="/how-it-works" className="flex items-center gap-2 hover:underline">
                  <PlayCircle className="h-4 w-4 text-muted" /> Walkthrough Video
                </Link>
                <Link href="/sample-dossier" className="flex items-center gap-2 hover:underline">
                  <FileText className="h-4 w-4 text-muted" /> Sample Sealed Dossier
                </Link>
                <Link href="/cbam/methodology" className="flex items-center gap-2 hover:underline">
                  <Info className="h-4 w-4 text-muted" /> Methodology & Sources
                </Link>
              </div>
            </section>
          </aside>
        </div>

        <section className="rounded-lg border border-border bg-neutral-soft p-4 text-xs leading-relaxed text-muted">
          <p className="mb-1 font-semibold text-foreground">Verification boundary</p>
          CBAMValid prepares a structured dossier for independent verification. It does not issue an accredited opinion, customs approval, EU approval or acceptance guarantee.
        </section>
      </div>
    </div>
  );
}
