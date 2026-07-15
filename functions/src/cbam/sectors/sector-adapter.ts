export type CbamSector =
  | "IRON_AND_STEEL"
  | "ALUMINIUM"
  | "CEMENT"
  | "FERTILISERS"
  | "HYDROGEN"
  | "ELECTRICITY"
  | "DOWNSTREAM_COMPLEX_GOODS";

export type SectorLegalStatus = "IN_FORCE" | "PROPOSAL_ONLY";

export interface SectorConfig {
  sector: CbamSector;
  displayName: string;
  legalStatus: SectorLegalStatus;
  sealingAllowed: boolean;
  allowedUnits: string[];
  requiredPrecursors: string[];
  defaultBoundaries: string;
  allowedProductionRoutes: string[];
  coveredGreenhouseGases: string[];
  indirectEmissionsTreatment: string;
  verificationFocus: string[];
  legalBasisSourceIds: string[];
  helpText: string;
}

export const SECTOR_CONFIGS: Record<CbamSector, SectorConfig> = {
  IRON_AND_STEEL: {
    sector: "IRON_AND_STEEL",
    displayName: "Iron and Steel",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: ["7201", "7202", "7205"],
    defaultBoundaries: "Coke oven, sinter or pellet preparation, blast furnace, basic oxygen furnace, direct reduction, electric arc furnace, casting and finishing processes within the installation boundary.",
    allowedProductionRoutes: ["Blast Furnace Route (BF-BOF)", "Electric Arc Furnace Route (EAF)", "Direct Reduced Iron Route (DRI)"],
    coveredGreenhouseGases: ["CO2"],
    indirectEmissionsTreatment: "Apply the definitive-period methodology and sector scope prescribed by the active ruleset; do not infer indirect-emission eligibility from transitional rules.",
    verificationFocus: ["Mass balance and production ledger", "Fuel and reducing-agent consumption", "Precursor embedded emissions", "Waste-gas and transferred-heat treatment", "Allocation to CN-coded goods"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Use installation-specific actual data only where the monitoring plan, evidence links and verifier requirements are satisfied.",
  },
  ALUMINIUM: {
    sector: "ALUMINIUM",
    displayName: "Aluminium",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: ["2606", "2818", "7601", "7602"],
    defaultBoundaries: "Alumina preparation where applicable, electrolysis, anode production or baking, remelting, casting and finishing within the installation boundary.",
    allowedProductionRoutes: ["Primary Aluminium Electrolysis", "Secondary Aluminium Recycling"],
    coveredGreenhouseGases: ["CO2", "PFC"],
    indirectEmissionsTreatment: "Electricity evidence must identify quantity, source and emission-factor basis where indirect emissions are applicable under the definitive rules.",
    verificationFocus: ["Electricity metering", "Anode and carbon consumption", "PFC event records", "Primary versus secondary material split", "Metal yield and allocation"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Separate primary and secondary routes and retain evidence for electricity, carbon inputs, yields and PFC treatment.",
  },
  CEMENT: {
    sector: "CEMENT",
    displayName: "Cement",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: ["25231000"],
    defaultBoundaries: "Raw meal preparation, kiln calcination, clinker production, blending, grinding and directly connected energy flows.",
    allowedProductionRoutes: ["Standard Clinker Kiln Process", "Alternative Fuel Kiln Process"],
    coveredGreenhouseGases: ["CO2"],
    indirectEmissionsTreatment: "Record electricity consumption and the legally permitted emission-factor basis for the definitive period.",
    verificationFocus: ["Clinker mass balance", "Calcination factor", "Fuel and alternative-fuel data", "Clinker-to-cement ratio", "Electricity and grinding allocation"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Distinguish process emissions from combustion emissions and evidence the clinker ratio used for each good.",
  },
  FERTILISERS: {
    sector: "FERTILISERS",
    displayName: "Fertilisers",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: ["2814", "2808"],
    defaultBoundaries: "Hydrogen and ammonia production, nitric acid production, urea or fertiliser synthesis, granulation and directly connected utilities.",
    allowedProductionRoutes: ["Steam Methane Reforming Ammonia", "Nitric Acid Catalytic Oxidation", "Electrolytic Hydrogen Ammonia"],
    coveredGreenhouseGases: ["CO2", "N2O"],
    indirectEmissionsTreatment: "Apply the definitive-period sector methodology and document electricity, hydrogen and precursor treatment.",
    verificationFocus: ["Natural-gas feedstock and fuel split", "Hydrogen source", "N2O monitoring or approved factors", "Ammonia and nitric-acid precursor data", "Product nitrogen and mass balance"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Evidence process-route chemistry, N2O treatment and precursor quantities rather than relying on generic plant averages.",
  },
  HYDROGEN: {
    sector: "HYDROGEN",
    displayName: "Hydrogen",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: [],
    defaultBoundaries: "Hydrogen production, purification, directly connected energy supply and eligible carbon capture or transfer treatment.",
    allowedProductionRoutes: ["Steam Methane Reforming (SMR)", "Autothermal Reforming (ATR)", "Water Electrolysis"],
    coveredGreenhouseGases: ["CO2"],
    indirectEmissionsTreatment: "Electricity source and quantity are material for electrolysis routes and must be evidenced under the active methodology.",
    verificationFocus: ["Feedstock and fuel split", "Electricity source", "Hydrogen output metering", "Carbon capture and transfer records", "Co-product allocation"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Route selection must match evidence; do not label hydrogen low-carbon or renewable without a separate legal basis.",
  },
  ELECTRICITY: {
    sector: "ELECTRICITY",
    displayName: "Electricity",
    legalStatus: "IN_FORCE",
    sealingAllowed: true,
    allowedUnits: ["MWh"],
    requiredPrecursors: [],
    defaultBoundaries: "Generating unit, eligible fuel and energy inputs, net electricity output and direct technical connection where claimed.",
    allowedProductionRoutes: ["Fossil Fuel Combustion", "Renewable Generation", "Nuclear Generation", "Mixed Generation Portfolio"],
    coveredGreenhouseGases: ["CO2"],
    indirectEmissionsTreatment: "Electricity is the good; quantify direct generation emissions per net MWh under the definitive methodology.",
    verificationFocus: ["Net generation", "Fuel consumption and calorific value", "Emission factors", "Direct technical connection evidence", "Grid or market documentation where applicable"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546", "IMPL_2025_2547"],
    helpText: "Use net generation and installation-specific evidence; generation claims must not be inferred from contractual labels alone.",
  },
  DOWNSTREAM_COMPLEX_GOODS: {
    sector: "DOWNSTREAM_COMPLEX_GOODS",
    displayName: "Downstream Complex Goods",
    legalStatus: "PROPOSAL_ONLY",
    sealingAllowed: false,
    allowedUnits: ["metric_tonne"],
    requiredPrecursors: ["72", "73", "76"],
    defaultBoundaries: "Advisory mapping only. Downstream extension proposals do not create current definitive-period scope unless and until binding legislation enters into force.",
    allowedProductionRoutes: ["Mechanical Assembly and Coating", "Thermal Processing of Semis"],
    coveredGreenhouseGases: [],
    indirectEmissionsTreatment: "Not calculated as a sealable CBAM result under the current active scope.",
    verificationFocus: ["CN-code legal-scope review", "Covered precursor identification", "Change-monitoring for future legislation"],
    legalBasisSourceIds: ["REG_2023_956", "REG_2025_2083"],
    helpText: "Advisory only. The engine must block sealing unless binding scope-extension legislation is registered and activated.",
  },
};

export function getSectorConfig(sector: CbamSector): SectorConfig {
  const config = SECTOR_CONFIGS[sector];
  if (!config) throw new Error(`CBAM_SECTOR_UNSUPPORTED:${sector}`);
  return config;
}

export function assertSectorSealable(sector: CbamSector): SectorConfig {
  const config = getSectorConfig(sector);
  if (!config.sealingAllowed || config.legalStatus !== "IN_FORCE") {
    throw new Error(`CBAM_SECTOR_NOT_LEGALLY_SEALABLE:${sector}`);
  }
  return config;
}
