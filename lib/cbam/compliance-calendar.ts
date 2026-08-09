/**
 * Single source of truth for CBAM definitive-period compliance milestones.
 * Dates are verified against DEHSt (German competent authority) and the
 * European Commission CBAM Q&A published guidance for the 2026 cycle.
 * Keep this module the only place where these dates live for product UI.
 */

export type ComplianceMilestoneKind = "certificate" | "holding" | "declaration";

export interface ComplianceMilestone {
  id: string;
  label: string;
  /** ISO date, timezone-independent (date-only). */
  date: string;
  description: string;
  kind: ComplianceMilestoneKind;
}

export type MilestoneState = "passed" | "due" | "upcoming";

export interface MilestoneWithState extends ComplianceMilestone {
  daysUntil: number;
  state: MilestoneState;
}

export interface ComplianceCalendarState {
  /** Calendar year the dossier is being prepared for (2026 for current cycle). */
  referenceYear: string;
  /** First annual declaration + certificate surrender deadline for the reference year. */
  firstDeclarationDeadline: string;
  daysUntilFirstDeclaration: number;
  milestones: MilestoneWithState[];
}

export const CBAM_COMPLIANCE_MILESTONES: readonly ComplianceMilestone[] = [
  {
    id: "certificate-sales-start",
    label: "CBAM certificate sales open",
    date: "2027-02-01",
    description:
      "Authorised declarants can buy certificates on the Common Central Platform for 2026 and 2027 imports.",
    kind: "certificate",
  },
  {
    id: "q1-2027-holding",
    label: "Q1 2027 certificate holding check",
    date: "2027-03-31",
    description:
      "Hold certificates covering at least 50% of embedded emissions imported since 1 January 2027.",
    kind: "holding",
  },
  {
    id: "q2-2027-holding",
    label: "Q2 2027 certificate holding check",
    date: "2027-06-30",
    description:
      "Hold certificates covering at least 50% of embedded emissions imported since 1 January 2027.",
    kind: "holding",
  },
  {
    id: "annual-declaration-2026",
    label: "First annual CBAM declaration — 2026 imports",
    date: "2027-09-30",
    description:
      "Submit the annual declaration in the CBAM registry and surrender certificates for 2026 embedded emissions (Article 6 and Article 22).",
    kind: "declaration",
  },
  {
    id: "q3-2027-holding",
    label: "Q3 2027 certificate holding check",
    date: "2027-09-30",
    description:
      "Hold certificates covering at least 50% of embedded emissions imported since 1 January 2027.",
    kind: "holding",
  },
  {
    id: "surplus-repurchase-window",
    label: "Surplus certificate repurchase window opens",
    date: "2027-10-31",
    description:
      "Request repurchase of surplus certificates bought for 2026 embedded emissions.",
    kind: "certificate",
  },
] as const;

export const FIRST_2026_DECLARATION_DEADLINE = "2027-09-30";

function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function wholeDaysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function stateFor(daysUntil: number): MilestoneState {
  if (daysUntil < 0) return "passed";
  if (daysUntil <= 30) return "due";
  return "upcoming";
}

export function getComplianceCalendarState(today: Date = new Date()): ComplianceCalendarState {
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const milestones: MilestoneWithState[] = CBAM_COMPLIANCE_MILESTONES.map((milestone) => {
    const daysUntil = wholeDaysBetween(todayUtc, parseDateOnly(milestone.date));
    return { ...milestone, daysUntil, state: stateFor(daysUntil) };
  });

  return {
    referenceYear: "2026",
    firstDeclarationDeadline: FIRST_2026_DECLARATION_DEADLINE,
    daysUntilFirstDeclaration: wholeDaysBetween(todayUtc, parseDateOnly(FIRST_2026_DECLARATION_DEADLINE)),
    milestones,
  };
}

export function getNextDeclarationMilestone(
  state: ComplianceCalendarState
): MilestoneWithState | undefined {
  return state.milestones.find((milestone) => milestone.kind === "declaration" && milestone.state !== "passed");
}
