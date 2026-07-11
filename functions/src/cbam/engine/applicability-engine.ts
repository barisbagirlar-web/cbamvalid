import { resolveCNCodeScope } from "../regulatory/cn-scope-dataset";

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
  const totalMass = params.totalMassTonnes || 0;

  const res = resolveCNCodeScope(cnCode);
  const sector = res.sector;
  const chapter = cnCode.substring(0, 2);

  const isElectricityOrHydrogen = sector === "ELECTRICITY" || sector === "HYDROGEN";

  // Threshold rules: 50-tonne de minimis does not apply to electricity or hydrogen
  let underThreshold = false;
  if (res.inScope && !isElectricityOrHydrogen) {
    if (totalMass < 50.0) {
      underThreshold = true;
    }
  }

  // Electricity and Hydrogen are always applicable if in scope
  const isApplicable = res.inScope && (!underThreshold || isElectricityOrHydrogen);

  const requiresAuthorisedDeclarant = isApplicable && params.role !== "OPERATOR";
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
