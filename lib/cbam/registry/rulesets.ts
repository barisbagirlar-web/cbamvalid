import {
  DEFINITIVE_SOURCE_IDS,
  DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT,
  LEGAL_SOURCE_REGISTRY_VERSION,
  OFFICIAL_SOURCES,
  type OfficialSourceId,
} from "./legal-sources";

export const VERIFICATION_MATERIALITY_RATE = 0.05 as const;

export interface CbamRuleset {
  version: string;
  name: string;
  period: "TRANSITIONAL" | "DEFINITIVE";
  activeFrom: string;
  activeUntil?: string;
  baseRegulations: readonly OfficialSourceId[];
  implementingActs: readonly OfficialSourceId[];
  delegatedActs: readonly OfficialSourceId[];
  jurisdiction: "EU";
  sourceProvenance: "Official Journal of the European Union";
  sourceRegistryVersion: string;
  sourceHash: string;
  verificationMaterialityRate: number | null;
  verificationTemplateRequired: boolean;
  supersessionState: "ACTIVE" | "SUPERSEDED";
}

function assertSourceRegistry(ids: readonly OfficialSourceId[], expectedStatus: "IN_FORCE" | "TRANSITIONAL_ONLY"): void {
  for (const id of ids) {
    const source = OFFICIAL_SOURCES[id];
    if (!source || source.verificationAuthority !== "EUR_LEX") {
      throw new Error(`CBAM_LEGAL_SOURCE_NOT_VERIFIED:${id}`);
    }
    if (source.legalStatus !== expectedStatus && source.id !== "REG_2023_956") {
      throw new Error(`CBAM_LEGAL_SOURCE_STATUS_MISMATCH:${id}:${source.legalStatus}`);
    }
  }
}

assertSourceRegistry(DEFINITIVE_SOURCE_IDS, "IN_FORCE");

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
    sourceHash: "TRANSITIONAL_RULESET_NOT_SEALABLE",
    verificationMaterialityRate: null,
    verificationTemplateRequired: false,
    supersessionState: "SUPERSEDED",
  },
  "v3.0.0-DEFINITIVE": {
    version: "3.0.0",
    name: "CBAM Definitive Regime 2026",
    period: "DEFINITIVE",
    activeFrom: "2026-01-01",
    baseRegulations: ["REG_2023_956", "REG_2025_2083"],
    implementingActs: ["IMPL_2025_2546", "IMPL_2025_2547", "IMPL_2025_2548"],
    delegatedActs: ["DEL_2025_2551"],
    jurisdiction: "EU",
    sourceProvenance: "Official Journal of the European Union",
    sourceRegistryVersion: LEGAL_SOURCE_REGISTRY_VERSION,
    sourceHash: DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT,
    verificationMaterialityRate: VERIFICATION_MATERIALITY_RATE,
    verificationTemplateRequired: true,
    supersessionState: "ACTIVE",
  },
};

export function getActiveRuleset(date: Date = new Date(), jurisdiction: string = "EU"): CbamRuleset {
  if (jurisdiction !== "EU") throw new Error(`CBAM_JURISDICTION_UNSUPPORTED:${jurisdiction}`);
  if (Number.isNaN(date.getTime())) throw new Error("CBAM_RULESET_DATE_INVALID");

  const isoDate = date.toISOString().slice(0, 10);
  const rulesets = Object.values(RULESETS).sort((left, right) => right.activeFrom.localeCompare(left.activeFrom));

  for (const ruleset of rulesets) {
    const temporallyApplicable =
      isoDate >= ruleset.activeFrom && (!ruleset.activeUntil || isoDate <= ruleset.activeUntil);
    if (!temporallyApplicable) continue;
    if (ruleset.supersessionState !== "ACTIVE") {
      throw new Error(`CBAM_RULESET_NOT_SEALABLE:${ruleset.version}`);
    }

    assertSourceRegistry(
      [...ruleset.baseRegulations, ...ruleset.implementingActs, ...ruleset.delegatedActs],
      "IN_FORCE"
    );
    if (
      ruleset.verificationMaterialityRate !== VERIFICATION_MATERIALITY_RATE ||
      !ruleset.verificationTemplateRequired
    ) {
      throw new Error(`CBAM_DEFINITIVE_VERIFICATION_CONTRACT_INVALID:${ruleset.version}`);
    }
    return ruleset;
  }

  throw new Error(`CBAM_RULESET_NOT_FOUND:${isoDate}:${jurisdiction}`);
}
