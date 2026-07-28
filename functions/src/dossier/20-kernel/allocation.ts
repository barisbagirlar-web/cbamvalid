/**
 * Pure SEE composition — sector rule decides what enters SEE_priced.
 * NO Date.now(), NO I/O, NO globals.
 */
import {
  addEmissions,
  addPerMass,
  emissionsPerMass,
  scaleByFraction,
  tonne,
  tco2e,
  fraction,
  type Fraction,
  type Tonne,
  type TCO2e,
  type TCO2ePerTonne,
} from "../00-schema/units";
import {
  ANNEX_II_EXCLUSION_NOTE,
  type SectorRule,
} from "../01-ruleset/sectors.rules";
import type { RegulationKey } from "../01-ruleset/regulations.registry";

export interface IndirectExclusionReason {
  readonly code: "ANNEX_II_DIRECT_ONLY";
  readonly legalBasis: readonly RegulationKey[];
  readonly note: string;
}

export interface GoodAttribution {
  readonly attributedDirect: TCO2e;
  readonly attributedIndirect: TCO2e;
  readonly netProduction: Tonne;
}

export interface SpecificEmbeddedEmissionsResult {
  readonly seeDirect: TCO2ePerTonne;
  readonly seeIndirect: TCO2ePerTonne;
  readonly seePriced: TCO2ePerTonne;
  readonly attributedPriced: TCO2e;
  readonly indirectExclusionReason: IndirectExclusionReason | null;
}

export function attributeByShare(
  totalDirect: TCO2e,
  totalIndirect: TCO2e,
  share: Fraction,
  netProduction: Tonne
): GoodAttribution {
  return {
    attributedDirect: scaleByFraction(totalDirect, share),
    attributedIndirect: scaleByFraction(totalIndirect, share),
    netProduction,
  };
}

export function specificEmbeddedEmissions(
  g: GoodAttribution,
  rule: SectorRule
): SpecificEmbeddedEmissionsResult {
  const seeDirect = emissionsPerMass(g.attributedDirect, g.netProduction);
  const seeIndirect = emissionsPerMass(g.attributedIndirect, g.netProduction);
  const seePriced = rule.indirectPriced
    ? addPerMass(seeDirect, seeIndirect)
    : seeDirect;
  const attributedPriced = rule.indirectPriced
    ? addEmissions(g.attributedDirect, g.attributedIndirect)
    : g.attributedDirect;

  return {
    seeDirect,
    seeIndirect,
    seePriced,
    attributedPriced,
    indirectExclusionReason: rule.indirectPriced
      ? null
      : {
          code: "ANNEX_II_DIRECT_ONLY",
          legalBasis: ["CBAM_BASE"],
          note: ANNEX_II_EXCLUSION_NOTE,
        },
  };
}

/** Convenience for tests / calculator bridge — string inputs, string outputs. */
export function computePricedSeeFromStrings(params: {
  totalDirect: string;
  totalIndirect: string;
  allocationShare: string;
  productionTonnes: string;
  rule: SectorRule;
  displayDp?: number;
}): {
  seeDirect: string;
  seeIndirect: string;
  seePriced: string;
  attributedDirect: string;
  attributedIndirect: string;
  attributedPriced: string;
  indirectExclusionReason: IndirectExclusionReason | null;
} {
  const dp = params.displayDp ?? 6;
  const totalDirect = tco2e(params.totalDirect);
  const totalIndirect = tco2e(params.totalIndirect);
  const share = fraction(params.allocationShare);
  const production = tonne(params.productionTonnes);
  const attribution = attributeByShare(totalDirect, totalIndirect, share, production);
  const result = specificEmbeddedEmissions(attribution, params.rule);
  const fmt = (v: { toDecimalPlaces: (n: number, m?: number) => { toString: () => string } }) =>
    v.toDecimalPlaces(dp).toString();

  return {
    seeDirect: fmt(result.seeDirect),
    seeIndirect: fmt(result.seeIndirect),
    seePriced: fmt(result.seePriced),
    attributedDirect: attribution.attributedDirect.toString(),
    attributedIndirect: attribution.attributedIndirect.toString(),
    attributedPriced: result.attributedPriced.toString(),
    indirectExclusionReason: result.indirectExclusionReason,
  };
}
