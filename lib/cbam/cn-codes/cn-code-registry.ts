/**
 * CBAM CN Code Registry
 * Source: Regulation (EU) 2023/956 Annex I + Implementing Regulation (EU) 2023/1773 Annex III
 */

export type CbamSectorSlug = "cement" | "steel" | "aluminium" | "fertilisers" | "hydrogen" | "electricity" | "downstream";

export interface CnCodeEntry {
  code: string;
  sector: CbamSectorSlug;
  description: string;
  benchmarkTco2ePerTonne: number | null;
  defaultDirectFactor: number;
  defaultIndirectFactor: number;
  indirectEmissionsInScope: boolean;
  annexRef: string;
  eurLexUrl: string;
  requiresPrecursorTracking: boolean;
  systemBoundaryNote: string;
  /** ISO 8601 timestamp of last material content update. Used for sitemap lastmod. */
  contentLastModified: string;
}

const R = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I";
const I = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773";

export const CN_CODE_REGISTRY: CnCodeEntry[] = [
  { code: "25231000", sector: "cement", description: "Portland cement clinker", benchmarkTco2ePerTonne: 0.8262, defaultDirectFactor: 0.7462, defaultIndirectFactor: 0.0800, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Cement", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Raw meal, clinker kiln, cement grinding. Includes calcination CO2.", contentLastModified: "2026-07-15T09:01:00Z" },
  { code: "25232100", sector: "cement", description: "White Portland cement", benchmarkTco2ePerTonne: 0.8890, defaultDirectFactor: 0.8090, defaultIndirectFactor: 0.0800, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Cement", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "White clinker production with bleaching energy.", contentLastModified: "2026-07-15T09:02:00Z" },
  { code: "25232900", sector: "cement", description: "Other Portland cement", benchmarkTco2ePerTonne: 0.7669, defaultDirectFactor: 0.6869, defaultIndirectFactor: 0.0800, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Cement", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Standard OPC production.", contentLastModified: "2026-07-15T09:03:00Z" },
  { code: "25233000", sector: "cement", description: "Aluminous cement", benchmarkTco2ePerTonne: 0.9500, defaultDirectFactor: 0.8700, defaultIndirectFactor: 0.0800, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Cement", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "High-alumina cement from bauxite calcination.", contentLastModified: "2026-07-15T09:04:00Z" },
  { code: "25239000", sector: "cement", description: "Other hydraulic cements", benchmarkTco2ePerTonne: 0.7250, defaultDirectFactor: 0.6450, defaultIndirectFactor: 0.0800, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Cement", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Blended and slag cements.", contentLastModified: "2026-07-15T09:05:00Z" },
  { code: "72081000", sector: "steel", description: "Flat-rolled iron, hot-rolled, width >=600mm, in coils", benchmarkTco2ePerTonne: 2.0700, defaultDirectFactor: 1.7200, defaultIndirectFactor: 0.3500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "BF-BOF or EAF route.", contentLastModified: "2026-07-15T09:31:00Z" },
  { code: "72082500", sector: "steel", description: "Hot-rolled steel, pickled, width >=600mm", benchmarkTco2ePerTonne: 2.0700, defaultDirectFactor: 1.7200, defaultIndirectFactor: 0.3500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Hot strip mill including acid pickling.", contentLastModified: "2026-07-15T09:32:00Z" },
  { code: "72091500", sector: "steel", description: "Cold-rolled flat steel, width >=600mm", benchmarkTco2ePerTonne: 2.1000, defaultDirectFactor: 1.7500, defaultIndirectFactor: 0.3500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Cold reduction mill with annealing.", contentLastModified: "2026-07-15T09:33:00Z" },
  { code: "72101200", sector: "steel", description: "Flat-rolled steel, galvanised, width >=600mm", benchmarkTco2ePerTonne: 2.1500, defaultDirectFactor: 1.8000, defaultIndirectFactor: 0.3500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Galvanizing line energy included.", contentLastModified: "2026-07-15T09:34:00Z" },
  { code: "72011000", sector: "steel", description: "Pig iron, non-alloy", benchmarkTco2ePerTonne: 1.5100, defaultDirectFactor: 1.2600, defaultIndirectFactor: 0.2500, indirectEmissionsInScope: false, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Blast furnace route. Includes coke combustion.", contentLastModified: "2026-07-15T09:35:00Z" },
  { code: "72021100", sector: "steel", description: "Ferro-manganese, carbon >2%", benchmarkTco2ePerTonne: 1.8000, defaultDirectFactor: 1.5000, defaultIndirectFactor: 0.3000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "EAF or blast furnace smelting of manganese ore.", contentLastModified: "2026-07-15T09:36:00Z" },
  { code: "73061900", sector: "steel", description: "Seamless pipes and hollow profiles, iron or steel", benchmarkTco2ePerTonne: 2.3000, defaultDirectFactor: 1.9500, defaultIndirectFactor: 0.3500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Seamless tube rolling + upstream steelmaking.", contentLastModified: "2026-07-15T09:37:00Z" },
  { code: "76011000", sector: "aluminium", description: "Aluminium, unwrought, not alloyed", benchmarkTco2ePerTonne: 12.1200, defaultDirectFactor: 1.6800, defaultIndirectFactor: 10.4400, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Primary aluminium electrolysis. Indirect electricity emissions dominate.", contentLastModified: "2026-07-15T10:01:00Z" },
  { code: "76012000", sector: "aluminium", description: "Aluminium, unwrought, alloyed", benchmarkTco2ePerTonne: 11.9700, defaultDirectFactor: 1.7000, defaultIndirectFactor: 10.2700, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Primary electrolysis of alloyed billets.", contentLastModified: "2026-07-15T10:02:00Z" },
  { code: "76020000", sector: "aluminium", description: "Aluminium waste and scrap", benchmarkTco2ePerTonne: 0.5900, defaultDirectFactor: 0.5900, defaultIndirectFactor: 0.0000, indirectEmissionsInScope: false, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Secondary aluminium recycling.", contentLastModified: "2026-07-15T10:03:00Z" },
  { code: "76061100", sector: "aluminium", description: "Aluminium plates and sheets, thickness >0.2mm, not alloyed", benchmarkTco2ePerTonne: 12.3500, defaultDirectFactor: 1.8500, defaultIndirectFactor: 10.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Rolling mill + upstream primary electrolysis.", contentLastModified: "2026-07-15T10:04:00Z" },
  { code: "76071100", sector: "aluminium", description: "Aluminium foil, rolled, thickness <=0.2mm", benchmarkTco2ePerTonne: 12.8000, defaultDirectFactor: 1.9000, defaultIndirectFactor: 10.9000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Foil rolling additional passes increase energy.", contentLastModified: "2026-07-15T10:05:00Z" },
  { code: "28080000", sector: "fertilisers", description: "Nitric acid; sulphonitric acids", benchmarkTco2ePerTonne: 4.5000, defaultDirectFactor: 4.0000, defaultIndirectFactor: 0.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Fertilisers", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Catalytic oxidation of ammonia. N2O emissions dominant.", contentLastModified: "2026-07-15T10:31:00Z" },
  { code: "28141000", sector: "fertilisers", description: "Anhydrous ammonia", benchmarkTco2ePerTonne: 2.3700, defaultDirectFactor: 1.8700, defaultIndirectFactor: 0.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Fertilisers", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Steam methane reforming (SMR) synthesis.", contentLastModified: "2026-07-15T10:32:00Z" },
  { code: "31021000", sector: "fertilisers", description: "Urea, whether or not in aqueous solution", benchmarkTco2ePerTonne: 0.9200, defaultDirectFactor: 0.9200, defaultIndirectFactor: 0.0000, indirectEmissionsInScope: false, annexRef: "Regulation (EU) 2023/956 Annex I Fertilisers", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "CO2 bound in urea reduces direct emissions.", contentLastModified: "2026-07-15T10:33:00Z" },
  { code: "31023000", sector: "fertilisers", description: "Ammonium nitrate", benchmarkTco2ePerTonne: 2.7600, defaultDirectFactor: 2.2600, defaultIndirectFactor: 0.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Fertilisers", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Neutralisation of nitric acid with ammonia. N2O abatement required.", contentLastModified: "2026-07-15T10:34:00Z" },
  { code: "31026000", sector: "fertilisers", description: "Calcium nitrate and ammonium nitrate mixtures", benchmarkTco2ePerTonne: 2.1500, defaultDirectFactor: 1.6500, defaultIndirectFactor: 0.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Fertilisers", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "CAN production from AN + limestone.", contentLastModified: "2026-07-15T10:35:00Z" },
  { code: "28044000", sector: "hydrogen", description: "Hydrogen (pure)", benchmarkTco2ePerTonne: 8.9000, defaultDirectFactor: 8.9000, defaultIndirectFactor: 0.0000, indirectEmissionsInScope: false, annexRef: "Regulation (EU) 2023/956 Annex I Hydrogen", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "SMR default 8.9 tCO2e/tH2. Electrolysis: indirect from electricity. CCS reduces direct.", contentLastModified: "2026-07-15T11:01:00Z" },
  { code: "27160000", sector: "electricity", description: "Electrical energy", benchmarkTco2ePerTonne: null, defaultDirectFactor: 0.0000, defaultIndirectFactor: 0.4500, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Electricity", eurLexUrl: R, requiresPrecursorTracking: false, systemBoundaryNote: "Unit: tCO2e/MWh. EU default grid factor 0.45 tCO2e/MWh.", contentLastModified: "2026-07-15T11:31:00Z" },
  { code: "73089098", sector: "downstream", description: "Structures and parts of iron or steel, other", benchmarkTco2ePerTonne: 2.5000, defaultDirectFactor: 0.4000, defaultIndirectFactor: 0.3000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Iron and Steel", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Steel precursors + own fabrication. Precursor tracking mandatory.", contentLastModified: "2026-07-15T12:01:00Z" },
  { code: "76169900", sector: "downstream", description: "Articles of aluminium, other", benchmarkTco2ePerTonne: 13.5000, defaultDirectFactor: 0.6000, defaultIndirectFactor: 0.5000, indirectEmissionsInScope: true, annexRef: "Regulation (EU) 2023/956 Annex I Aluminium", eurLexUrl: R, requiresPrecursorTracking: true, systemBoundaryNote: "Fabrication + upstream primary aluminium precursors.", contentLastModified: "2026-07-15T12:02:00Z" }
];

export function getCnCodeEntry(code: string): CnCodeEntry | null {
  return CN_CODE_REGISTRY.find(e => e.code === code) ?? null;
}

export function getCnCodesBySector(sector: CbamSectorSlug): CnCodeEntry[] {
  return CN_CODE_REGISTRY.filter(e => e.sector === sector);
}

export function getAllSectorSlugs(): CbamSectorSlug[] {
  return [...new Set(CN_CODE_REGISTRY.map(e => e.sector))];
}

export function validateCnCodeSector(code: string, sector: string): CnCodeEntry | null {
  return CN_CODE_REGISTRY.find(e => e.code === code && e.sector === sector) ?? null;
}

export const CN_CODE_ROUTE_BASE = "/cn-codes";
export const IMPL_REGULATION_URL = I;