"use client";

import { getWorkflowStep } from "@/lib/cbam/workflow-definition";

export type WorkingFileJourneyStripProps = {
  currentStep: number;
  completenessPercentage: number;
  blockerCount: number;
  releasesRemaining: number;
  unlockablePacks: number;
  caseId: string;
};

/**
 * "Where you are" banner. Informational only — all primary actions live in
 * the fixed footer so no CTA is duplicated. Step navigation on desktop comes
 * from the 280px step rail; on mobile from the "View all steps" drawer, so
 * the eight small cards row is no longer rendered.
 */
export function WorkingFileJourneyStrip({
  currentStep,
  completenessPercentage,
  blockerCount,
  releasesRemaining,
  unlockablePacks,
}: WorkingFileJourneyStripProps) {
  const step = getWorkflowStep(currentStep);

  return (
    <section
      aria-label="Where you are in this working file"
      className="rounded-xl border border-accent/25 bg-accent/5 p-4 md:p-5"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Where you are</p>
        <p className="font-serif text-lg font-bold text-foreground md:text-xl">
          Working file · Step {currentStep} of 8 · {step.title}
        </p>
        <p className="text-xs text-muted leading-relaxed">
          {step.description} Completeness {completenessPercentage}%
          {blockerCount > 0
            ? ` · ${blockerCount} blocker${blockerCount === 1 ? "" : "s"} still open`
            : " · no open blockers on last assessment"}
          {releasesRemaining > 0
            ? " · this working file is paid"
            : unlockablePacks > 0
              ? " · unused preparation packs are ready to activate"
              : " · this working file is unpaid — pay once to lock"}
        </p>
      </div>
    </section>
  );
}
