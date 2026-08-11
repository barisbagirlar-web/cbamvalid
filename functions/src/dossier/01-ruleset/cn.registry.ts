/**
 * CN code → sector → functional unit registry (WP B.3).
 * Prefixes aligned to Annex I families already used in product scope data.
 * Does not invent new CN codes beyond that known family set.
 */
import { getSectorRule, type CbamSector, type SectorRule } from "./sectors.rules";

export interface CnResolution {
  readonly cnCode: string;
  readonly inScope: boolean;
  readonly sector: CbamSector | null;
  readonly functionalUnit: "t" | "MWh" | null;
  readonly sectorRule: SectorRule | null;
  readonly reason: "IN_SCOPE" | "OUT_OF_SCOPE" | "MALFORMED";
}

const CN_PREFIX_TO_SECTOR: ReadonlyArray<{ readonly prefix: string; readonly sector: CbamSector }> = [
  { prefix: "2507", sector: "CEMENT" },
  { prefix: "2523", sector: "CEMENT" },
  { prefix: "27160000", sector: "ELECTRICITY" },
  { prefix: "28041000", sector: "HYDROGEN" },
  { prefix: "28080000", sector: "FERTILISERS" },
  { prefix: "2814", sector: "FERTILISERS" },
  { prefix: "28271000", sector: "FERTILISERS" },
  { prefix: "3102", sector: "FERTILISERS" },
  { prefix: "3105", sector: "FERTILISERS" },
  { prefix: "72", sector: "IRON_AND_STEEL" },
  { prefix: "7301", sector: "IRON_AND_STEEL" },
  { prefix: "7302", sector: "IRON_AND_STEEL" },
  { prefix: "7303", sector: "IRON_AND_STEEL" },
  { prefix: "7304", sector: "IRON_AND_STEEL" },
  { prefix: "7305", sector: "IRON_AND_STEEL" },
  { prefix: "7306", sector: "IRON_AND_STEEL" },
  { prefix: "7307", sector: "IRON_AND_STEEL" },
  { prefix: "7308", sector: "IRON_AND_STEEL" },
  { prefix: "7309", sector: "IRON_AND_STEEL" },
  { prefix: "7310", sector: "IRON_AND_STEEL" },
  { prefix: "7311", sector: "IRON_AND_STEEL" },
  { prefix: "7318", sector: "IRON_AND_STEEL" },
  { prefix: "7326", sector: "IRON_AND_STEEL" },
  { prefix: "7601", sector: "ALUMINIUM" },
  { prefix: "7603", sector: "ALUMINIUM" },
  { prefix: "7604", sector: "ALUMINIUM" },
  { prefix: "7605", sector: "ALUMINIUM" },
  { prefix: "7606", sector: "ALUMINIUM" },
  { prefix: "7607", sector: "ALUMINIUM" },
  { prefix: "7608", sector: "ALUMINIUM" },
  { prefix: "7609", sector: "ALUMINIUM" },
  { prefix: "7610", sector: "ALUMINIUM" },
  { prefix: "7611", sector: "ALUMINIUM" },
  { prefix: "7612", sector: "ALUMINIUM" },
  { prefix: "7613", sector: "ALUMINIUM" },
  { prefix: "7614", sector: "ALUMINIUM" },
  { prefix: "7616", sector: "ALUMINIUM" },
];

export function resolveCn(cnCodeRaw: string): CnResolution {
  const cnCode = String(cnCodeRaw || "").replace(/\s+/g, "");
  if (!/^\d{2,10}$/.test(cnCode)) {
    return {
      cnCode,
      inScope: false,
      sector: null,
      functionalUnit: null,
      sectorRule: null,
      reason: "MALFORMED",
    };
  }

  let best: { prefix: string; sector: CbamSector } | null = null;
  for (const row of CN_PREFIX_TO_SECTOR) {
    if (cnCode.startsWith(row.prefix)) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  if (!best) {
    return {
      cnCode,
      inScope: false,
      sector: null,
      functionalUnit: null,
      sectorRule: null,
      reason: "OUT_OF_SCOPE",
    };
  }
  const sectorRule = getSectorRule(best.sector);
  return {
    cnCode,
    inScope: true,
    sector: best.sector,
    functionalUnit: sectorRule.functionalUnit,
    sectorRule,
    reason: "IN_SCOPE",
  };
}
