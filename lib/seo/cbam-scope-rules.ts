/**
 * Hierarchical CBAM Annex I scope rules + coverage resolver.
 *
 * Honest status:
 * - SCOPE_RULES_MODEL = IMPLEMENTED (prefix/exact + exclusions)
 * - FULL_2026_CN_UNIVERSE_EXPANSION = NOT_IMPLEMENTED
 *   (requires ingesting Implementing Regulation (EU) 2025/1926 CN tables end-to-end)
 *
 * Therefore public indexability uses STAGE_1_VERIFIED_ALLOWLIST separately.
 */

export type CbamScopeRule =
  | {
      readonly type: "prefix";
      readonly prefix: string;
      readonly exclusions: readonly string[];
      readonly sector: "STEEL" | "ALUMINIUM" | "CEMENT" | "FERTILIZER" | "ELECTRICITY" | "HYDROGEN";
      readonly legalSourceId: string;
    }
  | {
      readonly type: "exact";
      readonly code: string;
      readonly sector: "STEEL" | "ALUMINIUM" | "CEMENT" | "FERTILIZER" | "ELECTRICITY" | "HYDROGEN";
      readonly legalSourceId: string;
    };

/** Annex I hierarchical coverage model (not an exact-8-only set). */
export const CBAM_ANNEX_SCOPE_RULES: readonly CbamScopeRule[] = [
  { type: "prefix", prefix: "2523", exclusions: [], sector: "CEMENT", legalSourceId: "REG_2023_956" },
  { type: "exact", code: "27160000", sector: "ELECTRICITY", legalSourceId: "REG_2023_956" },
  { type: "exact", code: "28041000", sector: "HYDROGEN", legalSourceId: "REG_2023_956" },
  { type: "exact", code: "28080000", sector: "FERTILIZER", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "2814", exclusions: [], sector: "FERTILIZER", legalSourceId: "REG_2023_956" },
  { type: "exact", code: "28271000", sector: "FERTILIZER", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "3102", exclusions: [], sector: "FERTILIZER", legalSourceId: "REG_2023_956" },
  {
    type: "prefix",
    prefix: "3105",
    exclusions: ["31056000"],
    sector: "FERTILIZER",
    legalSourceId: "REG_2023_956",
  },
  { type: "prefix", prefix: "72", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7301", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7302", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7303", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7304", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7305", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7306", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7307", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7308", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7309", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7310", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7311", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7318", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7326", exclusions: [], sector: "STEEL", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7601", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7603", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7604", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7605", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7606", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7607", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7608", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7609", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7610", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7611", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7612", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7613", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7614", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
  { type: "prefix", prefix: "7616", exclusions: [], sector: "ALUMINIUM", legalSourceId: "REG_2023_956" },
];

export const CN_NOMENCLATURE_VERSION = "CN-2026/IMPL_2025_1926" as const;
export const FULL_OFFICIAL_SCOPE_RESOLUTION = "NOT_IMPLEMENTED" as const;

export interface CbamCoverageResult {
  readonly covered: boolean;
  readonly matchedRule?: CbamScopeRule;
  readonly reason:
    | "EXACT_MATCH"
    | "PREFIX_MATCH"
    | "EXCLUDED"
    | "OUT_OF_SCOPE"
    | "MALFORMED"
    | "NOMENCLATURE_UNIVERSE_UNRESOLVED";
  readonly nomenclatureVersion: typeof CN_NOMENCLATURE_VERSION;
  readonly fullUniverseStatus: typeof FULL_OFFICIAL_SCOPE_RESOLUTION;
}

/**
 * Determine whether an 8-digit CN code is covered by Annex hierarchical rules.
 * Does NOT claim the code exists in the full 2026 CN nomenclature table
 * until FULL_OFFICIAL_SCOPE_RESOLUTION is implemented.
 */
export function isCbamCovered(code8: string): CbamCoverageResult {
  const cleaned = code8.replace(/\s+/g, "");
  if (!/^\d{8}$/.test(cleaned)) {
    return {
      covered: false,
      reason: "MALFORMED",
      nomenclatureVersion: CN_NOMENCLATURE_VERSION,
      fullUniverseStatus: FULL_OFFICIAL_SCOPE_RESOLUTION,
    };
  }

  let best: CbamScopeRule | undefined;
  for (const rule of CBAM_ANNEX_SCOPE_RULES) {
    if (rule.type === "exact") {
      if (rule.code === cleaned) {
        best = rule;
        break;
      }
      continue;
    }
    if (cleaned.startsWith(rule.prefix)) {
      if (rule.exclusions.some((ex) => cleaned === ex || cleaned.startsWith(ex))) {
        return {
          covered: false,
          matchedRule: rule,
          reason: "EXCLUDED",
          nomenclatureVersion: CN_NOMENCLATURE_VERSION,
          fullUniverseStatus: FULL_OFFICIAL_SCOPE_RESOLUTION,
        };
      }
      if (!best || (best.type === "prefix" && rule.prefix.length > best.prefix.length)) {
        best = rule;
      }
      if (best.type === "exact") {
        // exact already preferred
      }
    }
  }

  if (!best) {
    return {
      covered: false,
      reason: "OUT_OF_SCOPE",
      nomenclatureVersion: CN_NOMENCLATURE_VERSION,
      fullUniverseStatus: FULL_OFFICIAL_SCOPE_RESOLUTION,
    };
  }

  return {
    covered: true,
    matchedRule: best,
    reason: best.type === "exact" ? "EXACT_MATCH" : "PREFIX_MATCH",
    nomenclatureVersion: CN_NOMENCLATURE_VERSION,
    fullUniverseStatus: FULL_OFFICIAL_SCOPE_RESOLUTION,
  };
}
