/**
 * Annex I / Annex II sector behaviour — drives SEE_priced composition.
 * For Annex II sectors, indirect emissions are monitored/disclosed but NOT priced.
 */
import type { RegulationKey } from "./regulations.registry";

export type CbamSector =
  | "IRON_AND_STEEL"
  | "ALUMINIUM"
  | "CEMENT"
  | "FERTILISERS"
  | "HYDROGEN"
  | "ELECTRICITY"
  | "DOWNSTREAM_COMPLEX_GOODS";

export type GreenhouseGas = "CO2" | "N2O" | "PFC";

export interface SectorRule {
  readonly sector: CbamSector;
  /** true → indirect emissions MUST NOT enter SEE_priced (Annex II of Reg 2023/956). */
  readonly annexII: boolean;
  /** === !annexII for sealable sectors; false for proposal-only. */
  readonly indirectPriced: boolean;
  readonly functionalUnit: "t" | "MWh";
  readonly gases: readonly GreenhouseGas[];
  readonly legalBasis: readonly RegulationKey[];
  readonly sealingAllowed: boolean;
  readonly displayName: string;
}

export const ANNEX_II_EXCLUSION_NOTE =
  "Sector listed in Annex II of Regulation (EU) 2023/956; only direct emissions are taken into account for specific embedded emissions used for CBAM certificates. Indirect emissions are disclosed but not priced.";

export const SECTOR_RULES: Record<CbamSector, SectorRule> = {
  IRON_AND_STEEL: {
    sector: "IRON_AND_STEEL",
    annexII: true,
    indirectPriced: false,
    functionalUnit: "t",
    gases: ["CO2"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Iron and Steel",
  },
  ALUMINIUM: {
    sector: "ALUMINIUM",
    annexII: true,
    indirectPriced: false,
    functionalUnit: "t",
    gases: ["CO2", "PFC"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Aluminium",
  },
  HYDROGEN: {
    sector: "HYDROGEN",
    annexII: true,
    indirectPriced: false,
    functionalUnit: "t",
    gases: ["CO2"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Hydrogen",
  },
  ELECTRICITY: {
    sector: "ELECTRICITY",
    annexII: true,
    indirectPriced: false,
    functionalUnit: "MWh",
    gases: ["CO2"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Electricity",
  },
  CEMENT: {
    sector: "CEMENT",
    annexII: false,
    indirectPriced: true,
    functionalUnit: "t",
    gases: ["CO2"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Cement",
  },
  FERTILISERS: {
    sector: "FERTILISERS",
    annexII: false,
    indirectPriced: true,
    functionalUnit: "t",
    gases: ["CO2", "N2O"],
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    sealingAllowed: true,
    displayName: "Fertilisers",
  },
  DOWNSTREAM_COMPLEX_GOODS: {
    sector: "DOWNSTREAM_COMPLEX_GOODS",
    annexII: false,
    indirectPriced: false,
    functionalUnit: "t",
    gases: ["CO2"],
    legalBasis: ["CBAM_BASE"],
    sealingAllowed: false,
    displayName: "Downstream Complex Goods",
  },
};

export function getSectorRule(sector: string): SectorRule {
  const rule = SECTOR_RULES[sector as CbamSector];
  if (!rule) throw new Error(`CBAM_SECTOR_UNSUPPORTED:${sector}`);
  return rule;
}

export function assertSectorSealable(sector: string): SectorRule {
  const rule = getSectorRule(sector);
  if (!rule.sealingAllowed) throw new Error(`CBAM_SECTOR_NOT_LEGALLY_SEALABLE:${sector}`);
  return rule;
}
