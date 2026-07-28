/**
 * WP-09 — chapter content contracts. Empty / placeholder chapters → DATA GAP.
 */
export const FORBIDDEN_PLACEHOLDERS = [
  "Boundaries defined.",
  "TBD",
  "Lorem",
] as const;

export interface ContentContract {
  readonly chapterId: string;
  readonly requiredFields: readonly string[];
  readonly minRecords: number;
}

export type ContentContractOutcome =
  | { readonly status: "SATISFIED" }
  | { readonly status: "NOT_APPLICABLE"; readonly reason: string }
  | {
      readonly status: "INSUFFICIENT";
      readonly missingFields: readonly string[];
      readonly dataGapMessage: string;
    };

export function evaluateContentContract(
  contract: ContentContract,
  provided: Readonly<Record<string, unknown>>,
  opts?: { readonly notApplicableReason?: string }
): ContentContractOutcome {
  if (opts?.notApplicableReason) {
    return { status: "NOT_APPLICABLE", reason: opts.notApplicableReason };
  }
  const missing: string[] = [];
  for (const field of contract.requiredFields) {
    const value = provided[field];
    if (value === undefined || value === null || value === "") missing.push(field);
    if (typeof value === "string" && FORBIDDEN_PLACEHOLDERS.some((p) => value.includes(p))) {
      missing.push(field);
    }
  }
  const recordCount = Array.isArray(provided.records) ? provided.records.length : 0;
  if (recordCount < contract.minRecords) {
    missing.push(`records(min=${contract.minRecords})`);
  }
  if (missing.length > 0) {
    return {
      status: "INSUFFICIENT",
      missingFields: missing,
      dataGapMessage: `DATA GAP: missing ${missing.join(", ")}. Operator must supply these fields before this chapter can be rendered.`,
    };
  }
  return { status: "SATISFIED" };
}

export const SYSTEM_BOUNDARY_CONTRACT: ContentContract = {
  chapterId: "SYSTEM_BOUNDARY",
  requiredFields: [
    "physicalBoundaryDescription",
    "sitePlanEvidenceId",
    "includedProcesses",
    "excludedProcesses",
    "crossingFlows",
    "meteringPointMap",
  ],
  minRecords: 1,
};
