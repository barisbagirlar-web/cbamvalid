import {
  DEFINITIVE_SOURCE_IDS,
  DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT,
  LEGAL_SOURCE_REGISTRY_VERSION,
  OFFICIAL_SOURCES,
  type OfficialSourceId,
} from "./legal-sources";

export interface CbamRuleset {
  version: string;
  name: string;
  period: "TRANSITIONAL" | "DEFINITIVE";
  activeFrom: string;
  activeUntil?: string;
  baseRegulations: OfficialSourceId[];
  implementingActs: OfficialSourceId[];
  delegatedActs: OfficialSourceId[];
  jurisdiction: "EU";
  sourceProvenance: "Official Journal of the European Union";
  sourceRegistryVersion: string;
  sourceHash: string;
  supersessionState: "ACTIVE" | "SUPERSEDED";
}

function assertSourceRegistry(ids: readonly OfficialSourceId[]): void {
  for (const id of ids) {
    const source = OFFICIAL_SOURCES[id];
    if (!source || source.verificationAuthority !== "EUR_LEX") {
      throw new Error(`CBAM_LEGAL_SOURCE_NOT_VERIFIED:${id}`);
    }
    if (source.legalStatus !== "IN_FORCE") {
      throw new Error(`CBAM_LEGAL_SOURCE_NOT_IN_FORCE:${id}`);
    }
  }
}

assertSourceRegistry(DEFINITIVE_SOURCE_IDS);

export const RULESETS: Record<string, CbamRuleset> = {
  "v1.0.0-TRANSITIONAL": {
    version: "1.0.0",
    name: "CBAM Transitional Phase Q4 2023 - Q4 2025",
    period: "TRANSITIONAL",
    activeFrom: "2023-10-01",
    activeUntil: "2025-12-31",
    baseRegulations: ["REG_2023_956"],
    implementingActs: ["IMPL_2023_1773"],
    delegatedActs: [],
    jurisdiction: "EU",
    sourceProvenance: "Official Journal of the European Union",
    sourceRegistryVersion: LEGAL_SOURCE_REGISTRY_VERSION,
    sourceHash: "TRANSITIONAL_RULESET_SUPERSEDED",
    supersessionState: "SUPERSEDED",
  },
  "v3.0.0-DEFINITIVE": {
    version: "3.0.0",
    name: "CBAM Definitive Regime 2026",
    period: "DEFINITIVE",
    activeFrom: "2026-01-01",
    baseRegulations: ["REG_2023_956", "REG_2025_2083"],
    implementingActs: [
      "IMPL_2025_2546",
      "IMPL_2025_2547",
      "IMPL_2025_2548",
      "IMPL_2025_2620",
      "IMPL_2025_2621",
    ],
    delegatedActs: ["DEL_2025_2551"],
    jurisdiction: "EU",
    sourceProvenance: "Official Journal of the European Union",
    sourceRegistryVersion: LEGAL_SOURCE_REGISTRY_VERSION,
    sourceHash: DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT,
    supersessionState: "ACTIVE",
  },
};

export function getActiveRuleset(date: Date = new Date(), jurisdiction: string = "EU"): CbamRuleset {
  if (jurisdiction !== "EU") throw new Error(`CBAM_JURISDICTION_UNSUPPORTED:${jurisdiction}`);
  const isoDate = date.toISOString().split("T")[0];
  const rulesets = Object.values(RULESETS).sort((left, right) => right.activeFrom.localeCompare(left.activeFrom));

  for (const ruleset of rulesets) {
    if (
      ruleset.jurisdiction === jurisdiction &&
      isoDate >= ruleset.activeFrom &&
      (!ruleset.activeUntil || isoDate <= ruleset.activeUntil)
    ) {
      if (ruleset.supersessionState !== "ACTIVE") {
        throw new Error(`CBAM_RULESET_SUPERSEDED:${ruleset.version}`);
      }
      assertSourceRegistry([
        ...ruleset.baseRegulations,
        ...ruleset.implementingActs,
        ...ruleset.delegatedActs,
      ]);
      return ruleset;
    }
  }

  throw new Error(`CBAM_RULESET_NOT_FOUND:${isoDate}:${jurisdiction}`);
}
