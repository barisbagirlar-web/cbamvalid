"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  FileCheck2,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  getCases,
  getEntitlementSummary,
  getReports,
  type CbamCaseRecord,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";
import type { SealedReportView } from "@/lib/cbam/report-contract";
import {
  formatCaseUpdatedDate,
  getCaseDisplayName,
  getPrimaryCnCode,
} from "@/lib/cbam/case-summary";
import { formatPreparationPackPrice, PREPARATION_PACK } from "@/lib/commerce/preparation-pack";

const RECENT_ITEM_LIMIT = 3;

type DashboardState = {
  cases: CbamCaseRecord[];
  reports: SealedReportView[];
  entitlements: PreparationPackEntitlement[];
  totalReleasesRemaining: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Dashboard data could not be loaded.";
}

export default function CbamDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<DashboardState>({
    cases: [],
    reports: [],
    entitlements: [],
    totalReleasesRemaining: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    void Promise.all([getCases(), getReports(), getEntitlementSummary()])
      .then(([cases, reports, entitlementSummary]) => {
        if (cancelled) return;
        setState({
          cases,
          reports,
          entitlements: entitlementSummary.entitlements,
          totalReleasesRemaining: entitlementSummary.totalReleasesRemaining,
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error("Dashboard loading failed", loadError);
        setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, authLoading, user]);

  const activeCases = useMemo(
    () => state.cases.filter((item) => item.status !== "ARCHIVED"),
    [state.cases]
  );
  const recentCases = activeCases.slice(0, RECENT_ITEM_LIMIT);
  const recentReports = state.reports.slice(0, RECENT_ITEM_LIMIT);

  if (authLoading || loading) {
    return <main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-accent" aria-label="Loading dashboard" /></main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <section className="rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex gap-4"><AlertCircle className="h-6 w-6 shrink-0 text-red-700" /><div><h1 className="font-serif text-2xl font-bold">Dashboard could not be loaded</h1><p className="mt-3 text-sm text-muted">{error}</p></div></div>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface"><RefreshCw className="h-4 w-4" />Retry</button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Workspace Overview</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">CBAM Dashboard</h1>
          <p className="mt-2 text-sm text-muted">Monitor active cases, sealed reports, release capacity and the next required action.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/cases/new" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface"><Plus className="h-4 w-4" />Create Case</Link>
          <Link href="/credits/buy" className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong px-5 text-sm font-semibold hover:bg-neutral-soft"><ShoppingBag className="h-4 w-4" />Buy Pack — {formatPreparationPackPrice()}</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={FolderKanban} label="Active Cases" value={activeCases.length} />
        <Metric icon={FileCheck2} label="Sealed Reports" value={state.reports.length} />
        <Metric icon={FileText} label="Release Seals Available" value={state.totalReleasesRemaining} />
        <Metric icon={ShoppingBag} label="Active Packs" value={state.entitlements.length} />
      </section>

      {activeCases.length === 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-8 shadow-sm md:p-10">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">New-user onboarding</p>
          <h2 className="mt-3 font-serif text-3xl font-bold">Prepare Your CBAM Verification Package</h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">Create a draft without payment, add goods, installation, emissions and evidence data, resolve blockers, then purchase one {formatPreparationPackPrice()} USD Preparation Pack before the first successful seal.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/cases/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface">Create Your First Dossier <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/sample-dossier" className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong px-5 text-sm font-semibold hover:bg-neutral-soft">View Sample Dossier</Link>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">One pack adds {PREPARATION_PACK.accountCredits} credits and funds up to {PREPARATION_PACK.maxReleases} successful sealed versions for one case. Failed or blocked seal attempts consume zero credits.</p>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <OverviewList title="Recent Cases" actionLabel="View All Cases" actionHref="/cases">
            {recentCases.map((cbamCase) => (
              <Link key={cbamCase.caseId} href={`/cases/${cbamCase.caseId}`} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4 hover:border-accent/50">
                <div><p className="font-semibold">{getCaseDisplayName(cbamCase.data)}</p><p className="mt-1 text-xs text-muted">CN {getPrimaryCnCode(cbamCase.data)} · Updated {formatCaseUpdatedDate(cbamCase.updatedAt)}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </OverviewList>

          <OverviewList title="Recent Reports" actionLabel="View All Reports" actionHref="/reports">
            {recentReports.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">No sealed reports yet.</p> : recentReports.map((report) => (
              <Link key={report.reportId} href={`/cbam/reports/${report.reportId}`} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4 hover:border-accent/50">
                <div><p className="font-semibold">Release version {report.releaseVersion}</p><p className="mt-1 font-mono text-xs text-muted">{report.reportId.slice(0, 18)}… · {formatCaseUpdatedDate(report.createdAt)}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </OverviewList>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Destination title="Cases" description="Complete draft and archived case list." href="/cases" />
        <Destination title="Reports" description="Complete sealed report history and downloads." href="/reports" />
        <Destination title="Methodology & Sources" description="Rulesets, source snapshots and calculation boundaries." href="/cbam/methodology" />
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: number }) {
  return <article className="rounded-xl border border-border bg-surface p-5 shadow-sm"><div className="flex items-center gap-2 text-muted"><Icon className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wider">{label}</p></div><p className="mt-4 font-mono text-3xl font-bold">{value}</p></article>;
}

function OverviewList({ title, actionLabel, actionHref, children }: { title: string; actionLabel: string; actionHref: string; children: React.ReactNode }) {
  return <article className="rounded-xl border border-border bg-surface p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl font-bold">{title}</h2><Link href={actionHref} className="text-sm font-semibold text-accent hover:underline">{actionLabel}</Link></div><div className="space-y-3">{children}</div></article>;
}

function Destination({ title, description, href }: { title: string; description: string; href: string }) {
  return <Link href={href} className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-accent/50"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted">{description}</p></Link>;
}
