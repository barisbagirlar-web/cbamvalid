export interface ApplicabilityResult {
  isApplicable: boolean;
  sector: "STEEL" | "ALUMINIUM" | "CEMENT" | "FERTILIZER" | "ELECTRICITY" | "HYDROGEN" | "UNKNOWN";
  chapter: string;
  underThreshold: boolean;
  requiresAuthorisedDeclarant: boolean;
  requiresVerification: boolean;
}

export function determineApplicability(params: {
  cnCode: string;
  totalMassTonnes: number;
  role: "IMPORTER" | "INDIRECT_REP" | "OPERATOR";
}): ApplicabilityResult {
  const cnCode = params.cnCode || "";
  const chapter = cnCode.substring(0, 2);
  const totalMass = params.totalMassTonnes || 0;

  let sector: ApplicabilityResult["sector"] = "UNKNOWN";
  let isElectricityOrHydrogen = false;

  if (chapter === "25") {
    sector = "CEMENT";
  } else if (chapter === "27") {
    sector = "ELECTRICITY";
    isElectricityOrHydrogen = true;
  } else if (chapter === "28") {
    sector = "HYDROGEN";
    isElectricityOrHydrogen = true;
  } else if (chapter === "31") {
    sector = "FERTILIZER";
  } else if (chapter === "72" || chapter === "73") {
    sector = "STEEL";
  } else if (chapter === "76") {
    sector = "ALUMINIUM";
  }

  // Threshold rules: 50-tonne de minimis does not apply to electricity or hydrogen
  let underThreshold = false;
  if (!isElectricityOrHydrogen) {
    // If total mass is strictly under 50.000 tonnes, it is classified as under threshold / exempt
    if (totalMass < 50.0) {
      underThreshold = true;
    }
  }

  // Electricity and Hydrogen are always applicable
  const isApplicable = sector !== "UNKNOWN" && (!underThreshold || isElectricityOrHydrogen);

  // Authorised declarant requirement applies to EU importers/representatives
  const requiresAuthorisedDeclarant = isApplicable && params.role !== "OPERATOR";

  // Verification is always required for actual emissions under final declaration-ready audits
  const requiresVerification = isApplicable;

  return {
    isApplicable,
    sector,
    chapter,
    underThreshold,
    requiresAuthorisedDeclarant,
    requiresVerification,
  };
}
