"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export type WorkingFileJourneyStripProps = {
  currentStep: number;
  completenessPercentage: number;
  blockerCount: number;
  releasesRemaining: number;
  unlockablePacks: number;
  canLock: boolean;
  onGoToStep: (step: number) => void;
  onLock?: () => void;
};

export function WorkingFileJourneyStrip({
  currentStep,
  completenessPercentage,
  blockerCount,
  releasesRemaining,
  unlockablePacks,
  canLock,
  onGoToStep,
  onLock,
}: WorkingFileJourneyStripProps) {
  const step = WORKFLOW_STEPS_PLAIN.find((item) => item.num === currentStep) ?? WORKFLOW_STEPS_PLAIN[0];
  const nextStep = WORKFLOW_STEPS_PLAIN.find((item) => item.num === currentStep + 1);

  let nextLabel = nextStep ? `Next: ${nextStep.title}` : "Review readiness on this step";
  let nextAction: (() => void) | null = nextStep ? () => onGoToStep(nextStep.num) : null;
  let nextHref: string | null = null;

  if (currentStep === 8) {
    if (blockerCount > 0) {
      nextLabel = `Fix ${blockerCount} blocker${blockerCount === 1 ? "" : "s"} before lock`;
      nextAction = null;
    } else if (releasesRemaining <= 0 && unlockablePacks > 0) {
      nextLabel = "Activate Preparation Pack";
      nextHref = "/account";
      nextAction = null;
    } else if (releasesRemaining <= 0) {
      nextLabel = `Buy Preparation Pack — ${CANONICAL_PRICING.priceFormatted}`;
      nextHref = "/credits/buy";
      nextAction = null;
    } else if (canLock && onLock) {
      nextLabel = "Lock & download package";
      nextAction = onLock;
    } else {
      nextLabel = "Finish checks, then lock";
      nextAction = null;
    }
  }

  return (
    <section
      aria-label="Where you are in this working file"
      className="rounded-xl border border-accent/25 bg-accent/5 p-4 md:p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Where you are</p>
          <p className="font-serif text-lg font-bold text-foreground md:text-xl">
            Working file · Step {currentStep} of 8 · {step.title}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {step.desc} Completeness {completenessPercentage}%
            {blockerCount > 0
              ? ` · ${blockerCount} blocker${blockerCount === 1 ? "" : "s"} still open`
              : " · no open blockers on last assessment"}
            {releasesRemaining > 0
              ? ` · ${releasesRemaining} sealed release${releasesRemaining === 1 ? "" : "s"} left`
              : " · no active sealed releases"}
          </p>
        </div>
        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover"
          >
            {nextLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => nextAction?.()}
            disabled={!nextAction}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextLabel} {nextAction ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        )}
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-8" aria-label="Eight plain steps">
        {WORKFLOW_STEPS_PLAIN.map((item) => {
          const done = item.num < currentStep;
          const active = item.num === currentStep;
          return (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => onGoToStep(item.num)}
                className={`w-full rounded-md border px-1 py-2 text-center transition-colors ${
                  active
                    ? "border-accent bg-accent text-surface"
                    : done
                      ? "border-accent/30 bg-surface text-accent"
                      : "border-border bg-surface text-muted"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span className="block font-mono text-[10px] font-bold">{item.num}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold leading-tight">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
