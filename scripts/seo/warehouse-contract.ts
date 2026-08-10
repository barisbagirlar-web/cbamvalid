export const SEO_STRUCTURAL_BREAK_DATE = "2025-09-11";

export type WarehouseRow = {
  date: string;
  cohortId: string;
  metric: string;
  value: number;
  structuralSegment?: "pre-num100-removal" | "post-num100-removal";
};

export type IncrementalityEvidence = {
  method: string;
  treatment: number;
  control: number;
  lift: number;
  confidenceInterval?: {
    lower: number;
    upper: number;
    level: number;
  };
};

function toDay(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
}

export function structuralSegmentForDate(
  date: string,
): "pre-num100-removal" | "post-num100-removal" {
  return toDay(date) < toDay(SEO_STRUCTURAL_BREAK_DATE)
    ? "pre-num100-removal"
    : "post-num100-removal";
}

export function validateStructuralBreakJoin(rows: readonly WarehouseRow[]): string[] {
  const errors: string[] = [];
  const byCohort = new Map<string, Set<string>>();
  for (const row of rows) {
    const expected = structuralSegmentForDate(row.date);
    if (row.structuralSegment && row.structuralSegment !== expected) {
      errors.push(`INV-9.2 row ${row.cohortId}/${row.date} carries wrong structural segment`);
    }
    const set = byCohort.get(row.cohortId) ?? new Set<string>();
    set.add(row.structuralSegment ?? expected);
    byCohort.set(row.cohortId, set);
  }
  for (const [cohortId, segments] of byCohort) {
    if (segments.size > 1) {
      errors.push(`INV-9.2 cohort ${cohortId} crosses ${SEO_STRUCTURAL_BREAK_DATE} without an explicit split cohort id`);
    }
  }
  return errors.sort();
}

export function validateIncrementalityEvidence(evidence: IncrementalityEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.method.trim()) errors.push("INV-9.3 incrementality method missing");
  for (const [name, value] of Object.entries({
    treatment: evidence.treatment,
    control: evidence.control,
    lift: evidence.lift,
  })) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`INV-9.3 ${name} must be finite`);
    }
  }
  const ci = evidence.confidenceInterval;
  if (!ci) {
    errors.push("INV-9.3 confidence interval missing");
    return errors.sort();
  }
  if (![ci.lower, ci.upper, ci.level].every((value) => Number.isFinite(value))) {
    errors.push("INV-9.3 confidence interval values must be finite");
  }
  if (ci.lower > ci.upper) errors.push("INV-9.3 confidence interval lower bound exceeds upper bound");
  if (ci.level <= 0 || ci.level >= 1) errors.push("INV-9.3 confidence level must be between 0 and 1");
  return errors.sort();
}
