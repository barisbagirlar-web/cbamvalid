import { OFFICIAL_SOURCES } from "./legal-sources";

export interface CbamRuleset {
  version: string;
  name: string;
  period: "TRANSITIONAL" | "DEFINITIVE";
  activeFrom: string;
  activeUntil?: string;
  baseRegulation: string;
  implementingActs: string[];
  delegatedActs: string[];
}

export const RULESETS: Record<string, CbamRuleset> = {
  "v1.0.0-TRANSITIONAL": {
    version: "1.0.0",
    name: "CBAM Transitional Phase Q4 2023 - Q4 2025",
    period: "TRANSITIONAL",
    activeFrom: "2023-10-01",
    activeUntil: "2025-12-31",
    baseRegulation: OFFICIAL_SOURCES.REG_2023_956.id,
    implementingActs: [OFFICIAL_SOURCES.IMPL_ACT_2023_1773.id],
    delegatedActs: [],
  },
  "v2.0.0-DEFINITIVE": {
    version: "2.0.0",
    name: "CBAM Definitive Phase Initial",
    period: "DEFINITIVE",
    activeFrom: "2026-01-01",
    baseRegulation: OFFICIAL_SOURCES.REG_2023_956.id,
    implementingActs: [OFFICIAL_SOURCES.IMPL_ACT_2025_2083.id],
    delegatedActs: [OFFICIAL_SOURCES.DEL_ACT_2025_2547.id],
  }
};

export function getActiveRuleset(date: Date = new Date()): CbamRuleset {
  const isoDate = date.toISOString().split("T")[0];
  
  // Find applicable ruleset
  const rulesets = Object.values(RULESETS).sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
  
  for (const ruleset of rulesets) {
    if (isoDate >= ruleset.activeFrom && (!ruleset.activeUntil || isoDate <= ruleset.activeUntil)) {
      return ruleset;
    }
  }
  
  return RULESETS["v2.0.0-DEFINITIVE"]; // Fallback to definitive
}
