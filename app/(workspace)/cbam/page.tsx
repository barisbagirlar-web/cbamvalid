"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  Lock,
  PlayCircle,
  Plus,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  formatCaseUpdatedDate,
  getCaseDisplayName,
  getPrimaryCnCode,
} from "@/lib/cbam/case-summary";
import { formatPackageCode } from "@/lib/cbam/package-code";
import {
  getAccountOverview,
  getCases,
  getEntitlements,
  getReports,
  type CbamCaseRecord,
} from "@/lib/functions/client";
import { UnlockPreparationPackPanel } from "@/components/billing/UnlockPreparationPackPanel";
import { packsUnlockableFromCredits } from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import {
  CUSTOMER_LANGUAGE,
  WORKFLOW_STEPS_PLAIN,
} from "@/lib/product/customer-language";
import { resolveJourneyState } from "@/lib/product/journey-state";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";

type ReportRecord = Record<string, unknown>;

const REQUIRED_DATA = [
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

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Home could not be loaded.";
}

function readString(record: ReportRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function reportInstallationName(report: ReportRecord): string {
  const calculation = report.calculation;
  if (!calculation || typeof calculation !== "object") return CUSTOMER_LANGUAGE.lockedPackage;
  const inputs = (calculation as ReportRecord).inputs;
  if (!inputs || typeof inputs !== "object") return CUSTOMER_LANGUAGE.lockedPackage;
  const value = (inputs as ReportRecord).installationName;
  return typeof value === "string" && value.trim() ? value.trim() : CUSTOMER_LANGUAGE.lockedPackage;
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 5,
  itemLabel = "items",
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  itemLabel?: string;
}) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4 text-xs">
      <div className="text-muted font-medium">
        Showing <span className="font-semibold text-foreground">{startItem}–{endItem}</span> of{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-surface text-foreground hover:bg-muted/10 disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`min-w-[28px] h-7 px-2 rounded-md font-semibold text-xs transition-colors ${
              p === currentPage
                ? "bg-accent text-surface shadow-sm"
                : "border border-border bg-surface text-foreground hover:bg-muted/10"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-surface text-foreground hover:bg-muted/10 disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium"
          aria-label="Next Page"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CbamLandingPage() {
  const { user, loading } = useAuth();
  // Checkout success redirect uses a full page load; read once without effect setState.
  const postPurchase = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("purchase") === "success";
  }, []);

  const [cases, setCases] = useState<CbamCaseRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [releasesRemaining, setReleasesRemaining] = useState(0);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);
  const [filesPage, setFilesPage] = useState(1);
  const [packagesPage, setPackagesPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [postPurchasePolls, setPostPurchasePolls] = useState(0);

  // After checkout redirect, poll a few times if entitlement state has not landed yet.
  useEffect(() => {
    if (!postPurchase || !user || dataLoading) return;
    if (releasesRemaining > 0) return;
    if (postPurchasePolls >= 3) return;
    const timer = window.setTimeout(() => {
      setPostPurchasePolls((n) => n + 1);
      setAttempt((current) => current + 1);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [postPurchase, user, dataLoading, releasesRemaining, postPurchasePolls]);

  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [cases]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const timeA = new Date(readString(a, "createdAt") || 0).getTime();
      const timeB = new Date(readString(b, "createdAt") || 0).getTime();
      return timeB - timeA;
    });
  }, [reports]);

  const primaryWorkingFileId = sortedCases[0]?.caseId ?? null;
  const primaryReadiness = useMemo(() => {
    const primary = sortedCases[0];
    if (!primary?.data) return { blockersOpen: 0, completenessPercentage: 0 };
    try {
      const assessment = assessCaseReadiness(primary.data);
      return {
        blockersOpen: assessment.criticalBlockers.length,
        completenessPercentage: assessment.completenessPercentage,
      };
    } catch (error) {
      console.warn("Primary working-file readiness assessment failed", error);
      return { blockersOpen: 0, completenessPercentage: 0 };
    }
  }, [sortedCases]);

  const journey = useMemo(
    () =>
      resolveJourneyState({
        workingFileCount: cases.length,
        lockedPackageCount: reports.length,
        releasesRemaining,
        availableCredits,
        primaryWorkingFileId,
        postPurchase,
        blockersOpen: primaryReadiness.blockersOpen,
        completenessPercentage: primaryReadiness.completenessPercentage,
      }),
    [
      availableCredits,
      cases.length,
      postPurchase,
      primaryReadiness.blockersOpen,
      primaryReadiness.completenessPercentage,
      primaryWorkingFileId,
      releasesRemaining,
      reports.length,
    ]
  );

  const totalFilePages = Math.ceil(sortedCases.length / ITEMS_PER_PAGE) || 1;
  const paginatedCases = useMemo(() => {
    const start = (filesPage - 1) * ITEMS_PER_PAGE;
    return sortedCases.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedCases, filesPage]);

  const totalPackagePages = Math.ceil(sortedReports.length / ITEMS_PER_PAGE) || 1;
  const paginatedReports = useMemo(() => {
    const start = (packagesPage - 1) * ITEMS_PER_PAGE;
    return sortedReports.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedReports, packagesPage]);

  useEffect(() => {
    if (!user) return;
    try {
      const cached = localStorage.getItem(`cbam_dashboard_cache_${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setTimeout(() => {
          if (parsed.cases) setCases(parsed.cases);
          if (parsed.reports) setReports(parsed.reports);
          if (typeof parsed.entitlementsCount === "number") {
            setReleasesRemaining(parsed.entitlementsCount);
          }
          if (typeof parsed.availableCredits === "number") {
            setAvailableCredits(parsed.availableCredits);
          }
          setDataLoading(false);
        }, 0);
      }
    } catch (e) {
      console.warn("Failed to load dashboard cache:", e);
    }
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    void Promise.allSettled([getCases(), getReports(), getEntitlements(), getAccountOverview()])
      .then(([casesResult, reportsResult, entitlementsResult, overviewResult]) => {
        if (cancelled) return;

        if (casesResult.status === "rejected") {
          console.error("Dashboard case loading failed", casesResult.reason);
          setCases([]);
          setReports([]);
          setReleasesRemaining(0);
          setError(describeError(casesResult.reason));
          setWarning("");
          setDataLoading(false);
          return;
        }

        setCases(casesResult.value);
        setError("");

        const warnings: string[] = [];
        let reportsValue: ReportRecord[] = [];
        if (reportsResult.status === "fulfilled") {
          reportsValue = reportsResult.value;
          setReports(reportsValue);
        } else {
          console.error("Dashboard report loading failed", reportsResult.reason);
          setReports([]);
          warnings.push("Locked package history is temporarily unavailable.");
        }

        let entitlementsCount = 0;
        if (entitlementsResult.status === "fulfilled") {
          entitlementsCount = entitlementsResult.value.reduce(
            (sum, entitlement) => sum + Number(entitlement.releasesRemaining || 0),
            0
          );
          setReleasesRemaining(entitlementsCount);
        } else {
          console.error("Dashboard entitlement loading failed", entitlementsResult.reason);
          setReleasesRemaining(0);
          warnings.push("Preparation Pack status could not be verified; locking remains unavailable.");
        }

        if (overviewResult.status === "fulfilled") {
          const credits = overviewResult.value.credits as { availableCredits?: number } | undefined;
          setAvailableCredits(Number(credits?.availableCredits || 0));
        } else {
          console.error("Dashboard credit overview loading failed", overviewResult.reason);
          setAvailableCredits(0);
        }

        setWarning(warnings.join(" "));
        setDataLoading(false);

        try {
          const credits =
            overviewResult.status === "fulfilled"
              ? Number(
                  (overviewResult.value.credits as { availableCredits?: number } | undefined)
                    ?.availableCredits || 0
                )
              : 0;
          localStorage.setItem(
            `cbam_dashboard_cache_${user.uid}`,
            JSON.stringify({
              cases: casesResult.value,
              reports: reportsValue,
              entitlementsCount,
              availableCredits: credits,
            })
          );
        } catch (e) {
          console.warn("Failed to save dashboard cache:", e);
        }
      })
      .catch((unexpectedError: unknown) => {
        if (cancelled) return;
        console.error("Unexpected dashboard loading failure", unexpectedError);
        setCases([]);
        setReports([]);
        setReleasesRemaining(0);
        setError(describeError(unexpectedError));
        setWarning("");
        setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, loading, user]);

  const retryLoading = () => {
    setDataLoading(true);
    setError("");
    setWarning("");
    setAttempt((current) => current + 1);
  };

  if (!loading && !user) return null;

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">Loading your files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-status-blocked/40 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-status-blocked" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">Home could not be loaded</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry Loading
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {warning ? (
          <div role="status" className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
            {warning}
          </div>
        ) : null}

        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-serif">{CUSTOMER_LANGUAGE.home}</h1>
            <p className="text-muted text-sm mt-1 max-w-2xl">{CUSTOMER_LANGUAGE.oneLineStory}</p>
          </div>
          {cases.length > 0 ? (
            <Link
              href="/cases/new"
              className="bg-foreground hover:bg-foreground/90 text-background px-4 py-2 rounded-md font-semibold text-xs transition-colors inline-flex items-center gap-1 self-start"
            >
              <Plus className="w-3.5 h-3.5" /> New working file
            </Link>
          ) : null}
        </header>

        {postPurchase ? (
          <div
            role="status"
            className="rounded-2xl border border-success/35 bg-success/10 p-5 md:p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-success mb-1">
              Payment result
            </p>
            {releasesRemaining > 0 ? (
              <>
                <p className="font-serif text-xl md:text-2xl font-bold text-foreground">
                  Payment confirmed — this working file can be locked
                </p>
                <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
                  Your card charge succeeded. Same-file corrections and re-locks stay included. You do
                  not need to pay again for this file. Continue, then lock and download. Full receipt:{" "}
                  <Link href="/account" className="font-semibold text-accent underline">
                    Account → Purchase history
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-xl md:text-2xl font-bold text-foreground">
                  Payment received — activating pack…
                </p>
                <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
                  Do not pay again. Refresh in a minute. If Purchase history does not show “Paid —
                  pack active”, email info@cbamvalid.com.
                </p>
                <button
                  type="button"
                  onClick={retryLoading}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh pack status
                </button>
              </>
            )}
          </div>
        ) : null}

        <section
          aria-labelledby="where-you-are"
          className="rounded-2xl border border-accent/25 bg-accent/5 p-6 md:p-8 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Where you are</p>
          <h2 id="where-you-are" className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-3">
            {journey.headline}
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-3xl mb-2">{journey.explanation}</p>
          <p className="font-mono text-xs text-foreground/70 mb-6">{journey.packSummary}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={journey.primaryCta.href}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-surface hover:bg-accent-hover shadow-sm"
            >
              {journey.primaryCta.label} <ArrowRight className="w-4 h-4" />
            </Link>
            {journey.secondaryCta ? (
              <Link
                href={journey.secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/10"
              >
                {journey.secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </section>

        {cases.length === 0 ? (
          <div className="space-y-8">
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-10 shadow-sm">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent mb-4">
                  <Info className="w-3.5 h-3.5" /> Exporter Verification Preparation Pack
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold font-serif mb-4">
                  Prepare Your CBAM Verification Package
                </h2>
                <p className="text-muted text-base leading-relaxed mb-6">
                  Build one working file for one installation and one reporting year. Enter data, link evidence,
                  clear blockers, buy the pack at checkout if you have not already, then lock and download.
                </p>

                <div className="mb-8">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/80 mb-3">
                    Simple path:
                  </h3>
                  <ol className="space-y-2.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">1.</span>
                      <span>Create a working file (free).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">2.</span>
                      <span>Fill the eight plain steps and fix blockers.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">3.</span>
                      <span>
                        Buy the {CANONICAL_PRICING.priceFormatted} Preparation Pack at checkout (card charged
                        then — not when you lock).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">4.</span>
                      <span>Lock &amp; download. Same-file correction re-locks are included.</span>
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    href="/cases/new"
                    className="bg-accent hover:bg-accent-hover text-surface px-8 py-3 rounded-md font-semibold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    {CUSTOMER_LANGUAGE.createFile} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/sample-dossier"
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" /> View sample locked package
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowChecklist((current) => !current)}
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4" /> Review required data
                  </button>
                  <Link
                    href="/how-it-works"
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <PlayCircle className="w-4 h-4" /> How it works
                  </Link>
                </div>

                <div className="p-4 bg-muted/20 border border-border rounded-lg text-xs text-muted leading-relaxed">
                  <p className="font-semibold text-foreground mb-1">Important boundary</p>
                  Drafting is free. The Preparation Pack is required to lock and download. CBAMValid prepares an
                  operator dossier for independent verification and does not issue an accredited opinion or EU
                  approval.
                </div>
              </div>
            </div>

            {showChecklist ? (
              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent" /> Required data checklist
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {REQUIRED_DATA.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-muted">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
                Eight plain steps inside a working file
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {WORKFLOW_STEPS_PLAIN.map((step) => (
                  <div key={step.num} className="bg-surface border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 bg-accent/10 text-accent font-bold text-xs rounded-full flex items-center justify-center">
                        {step.num}
                      </span>
                      <h4 className="font-bold text-sm text-foreground">{step.title}</h4>
                    </div>
                    <p className="text-xs text-muted">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="bg-surface/50 border border-border/80 border-dashed rounded-xl p-6 text-center">
                <FileText className="w-6 h-6 text-muted/60 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground/80 mb-1">{CUSTOMER_LANGUAGE.workingFiles}</h4>
                <p className="text-xs text-muted">
                  Editable files for one factory and one year. Appear here after you create one.
                </p>
              </div>
              <div className="bg-surface/50 border border-border/80 border-dashed rounded-xl p-6 text-center">
                <Lock className="w-6 h-6 text-muted/60 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground/80 mb-1">{CUSTOMER_LANGUAGE.lockedPackages}</h4>
                <p className="text-xs text-muted">
                  Finished, downloadable packages after you lock. They never change.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold font-serif">{CUSTOMER_LANGUAGE.workingFiles}</h3>
                  <span className="text-xs text-muted font-mono">{cases.length} total</span>
                </div>
                <p className="text-xs text-muted mb-4">
                  Editable work for one installation and one reporting year. Locking creates a separate locked
                  package.
                </p>
                <div className="space-y-4">
                  {paginatedCases.map((cbamCase) => (
                    <div
                      key={cbamCase.caseId}
                      className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-sm">{getCaseDisplayName(cbamCase.data)}</p>
                        <p className="text-xs text-muted mt-1 font-mono">
                          File ID: {cbamCase.caseId} · CN: {getPrimaryCnCode(cbamCase.data)} · Updated:{" "}
                          {formatCaseUpdatedDate(cbamCase.updatedAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-neutral-soft text-foreground border border-border">
                            Working file
                          </span>
                          {cbamCase.latestReleaseVersion ? (
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-accent/10 text-accent border border-accent/20">
                              Locked versions: {cbamCase.latestReleaseVersion}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-muted/40 text-muted border border-border">
                              Not locked yet
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/cases/${cbamCase.caseId}`}
                        className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center gap-1 self-end sm:self-auto"
                      >
                        Continue <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={filesPage}
                  totalPages={totalFilePages}
                  onPageChange={setFilesPage}
                  totalItems={cases.length}
                  pageSize={ITEMS_PER_PAGE}
                  itemLabel="working files"
                />
              </section>

              <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold font-serif">{CUSTOMER_LANGUAGE.lockedPackages}</h3>
                  <span className="text-xs text-muted font-mono">{reports.length} total</span>
                </div>
                <p className="text-xs text-muted mb-4">
                  Immutable downloads from locking a working file. Re-download is free and does not use a release.
                </p>
                {reports.length === 0 ? (
                  <div className="p-8 text-center bg-background border border-dashed border-border/80 rounded-lg">
                    <Lock className="w-8 h-8 text-muted/65 mx-auto mb-3" />
                    <p className="text-sm text-subtle">
                      No locked packages yet. Finish your working file, then use Lock &amp; download.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedReports.map((report, index) => {
                        const reportId = readString(report, "reportId");
                        const packageCode = formatPackageCode(readString(report, "packageCode"));
                        const createdAt = readString(report, "createdAt");
                        const documentHash = readString(report, "documentHash");
                        return (
                          <div
                            key={reportId || `report-${index}`}
                            className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-sm">{reportInstallationName(report)}</p>
                              <p className="text-xs text-muted mt-1 font-mono">
                                Package ID: {packageCode} · Locked:{" "}
                                {createdAt ? formatCaseUpdatedDate(createdAt) : "Unknown"}
                              </p>
                              <p className="text-[11px] text-muted truncate mt-1">
                                Hash: {documentHash || "Unavailable"}
                              </p>
                            </div>
                            {reportId ? (
                              <Link
                                href={`/cbam/reports/${reportId}`}
                                className="bg-foreground hover:bg-foreground/90 text-background text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center justify-center"
                              >
                                Open package
                              </Link>
                            ) : (
                              <span className="text-xs text-muted">Package link unavailable</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <PaginationControls
                      currentPage={packagesPage}
                      totalPages={totalPackagePages}
                      onPageChange={setPackagesPage}
                      totalItems={reports.length}
                      pageSize={ITEMS_PER_PAGE}
                      itemLabel="locked packages"
                    />
                  </>
                )}
              </section>
            </div>

            <aside className="space-y-8">
              <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted mb-4">Pack status</h4>
                {releasesRemaining > 0 ? (
                  <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg text-xs">
                    <span className="font-bold text-accent block">Paid unlock active</span>
                    Lock-and-download is available. Same-file correction re-locks stay included.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/20 border border-border rounded-lg text-xs text-muted leading-relaxed">
                      <span className="font-bold text-foreground block mb-1">No paid unlock yet</span>
                      Draft free. Pay once when you lock a working file, or activate leftover legacy pack balance if you have it.
                    </div>
                    {packsUnlockableFromCredits(availableCredits) > 0 ? (
                      <UnlockPreparationPackPanel
                        availableCredits={availableCredits}
                        hasActivePack={false}
                        compact
                        onUnlocked={() => {
                          setDataLoading(true);
                          setAttempt((current) => current + 1);
                        }}
                      />
                    ) : (
                      <Link
                        href={primaryWorkingFileId ? `/cases/${encodeURIComponent(primaryWorkingFileId)}?step=8` : "/cases/new"}
                        className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-1.5 w-full shadow-sm"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> {primaryWorkingFileId ? "Continue to payment step" : "Create a working file"}
                      </Link>
                    )}
                  </div>
                )}
                <div className="mt-6 border-t border-border pt-4 text-xs text-muted space-y-2">
                  <p>
                    <strong>One paid working file includes:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>1 working file scope (operator · installation · year)</li>
                    <li>Unlimited drafts</li>
                    <li>Same-file correction re-locks</li>
                    <li>Free re-download of locked packages</li>
                  </ul>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted mb-3">Resources</h4>
                <div className="space-y-2.5 text-xs text-accent">
                  <Link href="/how-it-works" className="flex items-center gap-2 hover:underline">
                    <PlayCircle className="w-4 h-4 text-muted" /> How it works
                  </Link>
                  <Link href="/sample-dossier" className="flex items-center gap-2 hover:underline">
                    <FileText className="w-4 h-4 text-muted" /> Sample locked package
                  </Link>
                  <Link href="/methodology" className="flex items-center gap-2 hover:underline">
                    <Info className="w-4 h-4 text-muted" /> Methodology &amp; sources
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
