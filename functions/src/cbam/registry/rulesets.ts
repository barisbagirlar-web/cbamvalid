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
  jurisdiction: string;
  sourceProvenance: string;
  sourceHash: string;
  supersessionState: "ACTIVE" | "SUPERSEDED";
}

export const RULESETS: Record<string, CbamRuleset> = {
  "v1.0.0-TRANSITIONAL": {
    version: "1.0.0",
    name: "CBAM Transitional Phase Q4 2023 - Q4 2025",
    period: "TRANSITIONAL",
    activeFrom: "2023-10-01",
    activeUntil: "2025-12-31",
    baseRegulation: OFFICIAL_SOURCES.REG_2023_956?.id || "REG_2023_956",
    implementingActs: [OFFICIAL_SOURCES.IMPL_ACT_2023_1773?.id || "IMPL_ACT_2023_1773"],
    delegatedActs: [],
    jurisdiction: "EU",
    sourceProvenance: "Official Journal of the European Union",
    sourceHash: "9f8481358c28cb9e68340d99908cf8dc1de8a562ef6d8a7c2a7bb8658a5be18e",
    supersessionState: "SUPERSEDED",
  },
  "v2.0.0-DEFINITIVE": {
    version: "2.0.0",
    name: "CBAM Definitive Phase Initial",
    period: "DEFINITIVE",
    activeFrom: "2026-01-01",
    activeUntil: "2030-12-31",
    baseRegulation: OFFICIAL_SOURCES.REG_2023_956?.id || "REG_2023_956",
    implementingActs: [OFFICIAL_SOURCES.IMPL_ACT_2025_2083?.id || "IMPL_ACT_2025_2083"],
    delegatedActs: [OFFICIAL_SOURCES.DEL_ACT_2025_2547?.id || "DEL_ACT_2025_2547"],
    jurisdiction: "EU",
    sourceProvenance: "Official Journal of the European Union",
    sourceHash: "2ca08d6d84a7e9373f7690f0d2c0d83769c0d28362ef74a7bb8658a5be18e2ca",
    supersessionState: "ACTIVE",
  }
};

export function getActiveRuleset(date: Date = new Date(), jurisdiction: string = "EU"): CbamRuleset {
  const isoDate = date.toISOString().split("T")[0];
  
  const rulesets = Object.values(RULESETS).sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
  
  for (const ruleset of rulesets) {
    if (
      ruleset.jurisdiction === jurisdiction &&
      isoDate >= ruleset.activeFrom &&
      (!ruleset.activeUntil || isoDate <= ruleset.activeUntil)
    ) {
      if (ruleset.supersessionState === "SUPERSEDED" && isoDate >= "2026-01-01") {
        throw new Error(`Ruleset ${ruleset.name} is superseded.`);
      }
      return ruleset;
    }
  }
  
  throw new Error(`No active or valid CBAM ruleset found for date ${isoDate} in jurisdiction ${jurisdiction}.`);
}
