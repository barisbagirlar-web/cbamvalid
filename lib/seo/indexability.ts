import { isCbamCovered } from "./cbam-scope-rules";
import { getPublicCnEntry, listIndexablePublicCnEntries, CN_INDEXABILITY_STAGE, FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS } from "./cn-public-registry";
import type { CbamCnPublicEntry } from "./types";

export interface CnIndexabilityResult {
  readonly indexable: boolean;
  readonly entry?: CbamCnPublicEntry;
  readonly stage: typeof CN_INDEXABILITY_STAGE;
  readonly fullScopeResolution: typeof FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS;
  readonly reason:
    | "INDEXABLE_ALLOWLIST"
    | "NOT_IN_STAGE1_ALLOWLIST"
    | "NOT_PUBLIC_PAGE_ELIGIBLE"
    | "MISSING_REGULATORY_DATA"
    | "MISSING_UNIQUE_CONTENT"
    | "OUT_OF_SCOPE"
    | "MALFORMED"
    | "COVERED_BUT_NOT_ALLOWLISTED";
}

/**
 * Public indexability = hierarchical coverage AND Stage-1 verified allowlist
 * AND unique content. Chapter-only acceptance is forbidden.
 *
 * FULL_OFFICIAL_SCOPE_RESOLUTION remains NOT_IMPLEMENTED until 2026 CN
 * nomenclature tables are ingested end-to-end.
 */
export function evaluateCnIndexability(code: string): CnIndexabilityResult {
  const cleaned = code.replace(/\s+/g, "");
  const base = {
    stage: CN_INDEXABILITY_STAGE,
    fullScopeResolution: FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS,
  } as const;

  if (!/^\d{8}$/.test(cleaned)) {
    return { indexable: false, reason: "MALFORMED", ...base };
  }

  const coverage = isCbamCovered(cleaned);
  if (!coverage.covered) {
    return { indexable: false, reason: "OUT_OF_SCOPE", ...base };
  }

  const entry = getPublicCnEntry(cleaned);
  if (!entry) {
    return { indexable: false, reason: "COVERED_BUT_NOT_ALLOWLISTED", ...base };
  }
  if (!entry.publicPageEligible) {
    return { indexable: false, entry, reason: "NOT_PUBLIC_PAGE_ELIGIBLE", ...base };
  }
  if (!entry.legalSourceId || !entry.description || !entry.sector) {
    return { indexable: false, entry, reason: "MISSING_REGULATORY_DATA", ...base };
  }
  if (
    entry.requiredProducerData.length === 0 ||
    entry.evidenceConsiderations.length === 0 ||
    entry.productionRoutes.length === 0
  ) {
    return { indexable: false, entry, reason: "MISSING_UNIQUE_CONTENT", ...base };
  }

  return { indexable: true, entry, reason: "INDEXABLE_ALLOWLIST", ...base };
}

export function listIndexableCnCodes(): readonly string[] {
  return listIndexablePublicCnEntries().map((entry) => entry.cnCode);
}

export function isIndexableCnCode(code: string): boolean {
  return evaluateCnIndexability(code).indexable;
}
