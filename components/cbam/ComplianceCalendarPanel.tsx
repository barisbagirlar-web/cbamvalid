"use client";

import { CalendarClock, Info, TriangleAlert } from "lucide-react";
import {
  getComplianceCalendarState,
  getNextDeclarationMilestone,
  type MilestoneWithState,
} from "@/lib/cbam/compliance-calendar";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pluraliseDays(days: number): string {
  return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

function stateLabel(milestone: MilestoneWithState): string {
  if (milestone.state === "passed") return "Passed";
  if (milestone.state === "due") return `Due in ${pluraliseDays(milestone.daysUntil)}`;
  return `In ${pluraliseDays(milestone.daysUntil)}`;
}

function stateClass(milestone: MilestoneWithState): string {
  if (milestone.state === "passed") return "bg-muted/40 text-muted border-border";
  if (milestone.state === "due")
    return "bg-status-warning/10 text-status-warning border-status-warning/25";
  return "bg-accent/10 text-accent border-accent/20";
}

export function ComplianceCalendarPanel() {
  const state = getComplianceCalendarState();
  const nextDeclaration = getNextDeclarationMilestone(state);
  const isOverdue = state.daysUntilFirstDeclaration < 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
      <h4 className="font-bold text-sm uppercase tracking-wider text-muted mb-1 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-accent" aria-hidden="true" />
        Compliance calendar
      </h4>
      <p className="text-xs text-muted mb-4">Definitive period · reference year {state.referenceYear}</p>

      {nextDeclaration ? (
        <div
          className={`p-3 rounded-lg border mb-4 ${
            isOverdue
              ? "bg-status-blocked/10 border-status-blocked/30"
              : nextDeclaration.state === "due"
                ? "bg-status-warning/10 border-status-warning/25"
                : "bg-accent/5 border-accent/15"
          }`}
        >
          <p className="text-xs font-semibold text-foreground">{nextDeclaration.label}</p>
          <p className="text-sm font-bold mt-1">
            {formatDate(nextDeclaration.date)}
            {!isOverdue && nextDeclaration.state !== "passed" ? (
              <span className="ml-2 text-xs font-semibold text-muted">
                ({pluraliseDays(nextDeclaration.daysUntil)} from today)
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-1">{nextDeclaration.description}</p>
          {nextDeclaration.state === "due" ? (
            <p className="text-[11px] text-status-warning font-semibold mt-2 flex items-center gap-1">
              <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
              Declaration window approaching — keep the sealed dossier current.
            </p>
          ) : null}
          {isOverdue ? (
            <p className="text-[11px] text-status-blocked font-semibold mt-2 flex items-center gap-1">
              <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
              The 2026 declaration deadline has passed.
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {state.milestones.map((milestone) => (
          <li key={milestone.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-snug">{milestone.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{milestone.description}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="text-[11px] font-mono text-muted">{formatDate(milestone.date)}</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${stateClass(milestone)}`}>
                {stateLabel(milestone)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted leading-relaxed flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        Dates follow DEHSt and the European Commission CBAM guidance for the 2026 cycle. CBAMValid prepares
        operator dossiers; it does not submit declarations or surrender certificates.
      </p>
    </div>
  );
}
