import { resolveCNCodeScope } from "@/lib/cbam/regulatory/cn-scope-dataset";
import { getPublicCnEntry, listIndexablePublicCnEntries } from "./cn-public-registry";
import type { CbamCnPublicEntry } from "./types";

export interface CnIndexabilityResult {
  readonly indexable: boolean;
  readonly entry?: CbamCnPublicEntry;
  readonly reason:
    | "INDEXABLE"
    | "NOT_IN_PUBLIC_REGISTRY"
    | "NOT_PUBLIC_PAGE_ELIGIBLE"
    | "MISSING_REGULATORY_DATA"
    | "MISSING_UNIQUE_CONTENT"
    | "OUT_OF_SCOPE"
    | "MALFORMED";
}

/**
 * Chapter membership alone is forbidden.
 * Indexability requires official public registry membership + regulatory data + unique content.
 */
export function evaluateCnIndexability(code: string): CnIndexabilityResult {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{8}$/.test(cleaned)) {
    return { indexable: false, reason: "MALFORMED" };
  }

  const scope = resolveCNCodeScope(cleaned);
  if (!scope.inScope) {
    return { indexable: false, reason: scope.reason === "MALFORMED" ? "MALFORMED" : "OUT_OF_SCOPE" };
  }

  const entry = getPublicCnEntry(cleaned);
  if (!entry) {
    return { indexable: false, reason: "NOT_IN_PUBLIC_REGISTRY" };
  }
  if (!entry.publicPageEligible) {
    return { indexable: false, entry, reason: "NOT_PUBLIC_PAGE_ELIGIBLE" };
  }
  if (!entry.legalSourceId || !entry.description || !entry.sector) {
    return { indexable: false, entry, reason: "MISSING_REGULATORY_DATA" };
  }
  if (
    entry.requiredProducerData.length === 0 ||
    entry.evidenceConsiderations.length === 0 ||
    entry.productionRoutes.length === 0
  ) {
    return { indexable: false, entry, reason: "MISSING_UNIQUE_CONTENT" };
  }

  return { indexable: true, entry, reason: "INDEXABLE" };
}

export function listIndexableCnCodes(): readonly string[] {
  return listIndexablePublicCnEntries().map((entry) => entry.cnCode);
}

export function isIndexableCnCode(code: string): boolean {
  return evaluateCnIndexability(code).indexable;
}
