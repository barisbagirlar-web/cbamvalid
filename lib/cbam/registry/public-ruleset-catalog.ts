import { OFFICIAL_SOURCES } from "@/lib/cbam/registry/legal-sources";
import { RULESETS, type CbamRuleset } from "@/lib/cbam/registry/rulesets";

export function listPublishedRulesets(): CbamRuleset[] {
  return Object.values(RULESETS).sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
}

export function getRulesetSourceRows(ruleset: CbamRuleset) {
  const ids = [
    ...ruleset.baseRegulations,
    ...ruleset.implementingActs,
    ...ruleset.delegatedActs,
  ];
  return ids.map((id) => {
    const source = OFFICIAL_SOURCES[id];
    return {
      id,
      title: source?.title ?? id,
      eliUri: source?.eliUri ?? null,
      legalStatus: source?.legalStatus ?? "UNKNOWN",
      appliesFrom: source?.appliesFrom ?? null,
    };
  });
}

export const RULESET_PUBLIC_NOTICE =
  "Every sealed CBAMValid package pins a named ruleset version and source-registry hash. Historical seals keep the ruleset they were built against. Publishing the registry is an authority surface — not an accredited verification opinion." as const;
