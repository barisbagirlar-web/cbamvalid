"use client";

import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { gapResolution } from "@/lib/cbam/gap-resolution";
import type { GapRecord, GapSeverity } from "@/lib/cbam/schema";

export interface QcInspectorRailProps {
  /** All open working-file gaps from assessCaseReadiness (pending review included). */
  gaps: GapRecord[];
  completenessPercentage: number;
  passedControls: number;
  applicableControls: number;
  currentStep: number;
  onGoToStep: (step: number) => void;
}

type SeverityBand = "blocking" | "warning" | "note";

const BAND_ORDER: SeverityBand[] = ["blocking", "warning", "note"];

function bandOf(severity: GapSeverity): SeverityBand {
  if (severity === "BLOCKER" || severity === "CRITICAL") return "blocking";
  if (severity === "MAJOR") return "warning";
  return "note";
}

const BAND_META: Record<
  SeverityBand,
  {
    label: string;
    plural: string;
    icon: typeof AlertOctagon;
    chipClass: string;
    cardClass: string;
    textClass: string;
  }
> = {
  blocking: {
    label: "Blocking",
    plural: "blocking",
    icon: AlertOctagon,
    chipClass: "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked",
    cardClass: "border-l-status-blocked",
    textClass: "text-status-blocked",
  },
  warning: {
    label: "Warning",
    plural: "warnings",
    icon: AlertTriangle,
    chipClass: "border-status-warning/40 bg-[color:var(--status-warning-soft)] text-status-warning",
    cardClass: "border-l-status-warning",
    textClass: "text-status-warning",
  },
  note: {
    label: "Note",
    plural: "notes",
    icon: Info,
    chipClass: "border-border bg-neutral-soft text-muted",
    cardClass: "border-l-border-strong",
    textClass: "text-muted",
  },
};

/**
 * Persistent quality-control inspector — the ERP command layer of the working
 * file. Every open item from the deterministic QC engine is visible at all
 * times, grouped by severity, each with a deep link to the step that resolves
 * it. Read-only: it never mutates the case, it only navigates.
 */
export function QcInspectorRail({
  gaps,
  completenessPercentage,
  passedControls,
  applicableControls,
  currentStep,
  onGoToStep,
}: QcInspectorRailProps) {
  const grouped: Record<SeverityBand, GapRecord[]> = { blocking: [], warning: [], note: [] };
  for (const gap of gaps) grouped[bandOf(gap.severity)].push(gap);

  const blockingCount = grouped.blocking.length;
  const allClear = gaps.length === 0;

  return (
    <aside
      className="hidden w-[300px] shrink-0 xl:block"
      data-testid="qc-inspector-rail"
      aria-label="Quality control inspector"
    >
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-border bg-surface shadow-sm">
        {/* Command header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              QC Inspector
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                allClear
                  ? "border-forest-light bg-forest-pale text-forest"
                  : blockingCount > 0
                    ? "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked"
                    : "border-status-warning/40 bg-[color:var(--status-warning-soft)] text-status-warning"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  allClear ? "bg-forest" : blockingCount > 0 ? "bg-status-blocked" : "bg-status-warning"
                }`}
              />
              {allClear ? "All clear" : blockingCount > 0 ? "Blocked" : "Open items"}
            </span>
          </div>

          {/* Readiness meter */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between font-mono text-[11px] text-muted">
              <span>
                CONTROLS {passedControls}/{applicableControls}
              </span>
              <span className="text-sm font-bold text-foreground">{completenessPercentage}%</span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft"
              role="progressbar"
              aria-valuenow={completenessPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Automated control completeness"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  allClear ? "bg-forest" : blockingCount > 0 ? "bg-status-blocked" : "bg-accent"
                }`}
                style={{ width: `${completenessPercentage}%` }}
              />
            </div>
          </div>

          {/* Severity counters */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {BAND_ORDER.map((band) => {
              const meta = BAND_META[band];
              const Icon = meta.icon;
              return (
                <div
                  key={band}
                  className={`rounded-md border px-2 py-1.5 text-center ${meta.chipClass}`}
                  aria-label={`${grouped[band].length} ${meta.plural}`}
                >
                  <p className="flex items-center justify-center gap-1 font-mono text-sm font-bold">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {grouped[band].length}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wider">{meta.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Open items, grouped by severity */}
        <div className="space-y-2 p-3">
          {allClear ? (
            <div className="rounded-lg border border-forest-light bg-forest-pale p-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-forest" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-forest">
                Every automated control passed
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-forest/80">
                Open the final review to lock and download this working file.
              </p>
              <button
                type="button"
                onClick={() => onGoToStep(8)}
                className="mt-3 inline-flex items-center gap-1 rounded bg-forest px-3 py-1.5 text-[11px] font-bold text-surface-elevated hover:bg-forest-light"
              >
                Go to final review <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : (
            BAND_ORDER.map((band) => {
              const items = grouped[band];
              if (items.length === 0) return null;
              const meta = BAND_META[band];
              return (
                <section key={band} aria-label={`${meta.label} items`}>
                  <p className={`px-1 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${meta.textClass}`}>
                    {meta.label} · {items.length}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((gap) => {
                      const resolution = gapResolution(gap);
                      const onCurrentStep = resolution.step === currentStep;
                      return (
                        <article
                          key={gap.gapId}
                          className={`rounded-md border border-border border-l-[3px] bg-background p-2.5 ${meta.cardClass}`}
                        >
                          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-subtle">
                            {gap.affectedResult}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                            {gap.requirement}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                            {gap.whyItMatters}
                          </p>
                          <button
                            type="button"
                            onClick={() => onGoToStep(resolution.step)}
                            aria-label={`Resolve in step ${resolution.step}: ${gap.requirement}`}
                            className={`mt-2 inline-flex min-h-8 items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition-colors ${
                              onCurrentStep
                                ? "border-accent/40 bg-accent/10 text-accent"
                                : "border-border bg-surface text-foreground hover:border-accent/40 hover:text-accent"
                            }`}
                          >
                            {onCurrentStep ? "Resolve below" : `Fix in step ${resolution.step}`}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Footer — deterministic engine provenance */}
        <div className="border-t border-border px-4 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-subtle">
            Deterministic QC engine · re-evaluated on every edit
          </p>
        </div>
      </div>
    </aside>
  );
}
