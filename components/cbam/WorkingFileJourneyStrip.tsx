"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export type WorkingFileJourneyStripProps = {
  currentStep: number;
  completenessPercentage: number;
  blockerCount: number;
  hasPaidUnlock: boolean;
  canLock: boolean;
  caseId: string;
  onGoToStep: (step: number) => void;
  onLock?: () => void;
};

export function WorkingFileJourneyStrip({
  currentStep,
  completenessPercentage,
  blockerCount,
  hasPaidUnlock,
  canLock,
  caseId,
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
    } else if (!hasPaidUnlock) {
      nextLabel = `Pay ${CANONICAL_PRICING.priceFormatted} to lock this file`;
      nextHref = `/credits/buy?caseId=${encodeURIComponent(caseId)}`;
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
    <nav
      aria-label="Where you are in this working file"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">File progress</p>
        <p className="font-semibold text-foreground">Step {currentStep} of 8 · {step.title}</p>
        <p className="text-xs leading-relaxed text-muted">
          {completenessPercentage}% complete · {blockerCount > 0
            ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"} open`
            : "no open blockers"}
        </p>
      </div>
      <ol className="mt-4 space-y-1" aria-label="Eight plain steps">
        {WORKFLOW_STEPS_PLAIN.map((item) => {
          const done = item.num < currentStep;
          const active = item.num === currentStep;
          return (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => onGoToStep(item.num)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : done
                      ? "border-transparent text-foreground hover:bg-neutral-soft"
                      : "border-transparent text-muted hover:bg-neutral-soft"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-accent text-surface" : "bg-neutral-soft"
                }`}>
                  {item.num}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{item.title}</span>
                  {active ? <span className="block text-[11px] text-muted">{item.desc}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 border-t border-border pt-4">
        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover"
          >
            {nextLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => nextAction?.()}
            disabled={!nextAction}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextLabel} {nextAction ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        )}
      </div>
    </nav>
  );
}
