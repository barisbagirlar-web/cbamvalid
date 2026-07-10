import { determineApplicability, ApplicabilityResult } from "./applicability-engine";
import { validateEmissionPathway, PathwayValidation } from "./actual-value-engine";
import { getDefaultEmissions } from "./default-value-engine";
import { resolveCertificatePrice, CertificatePriceResult } from "./certificate-engine";
import { executeDeterministicCalculation, TraceNode } from "../calculation/calculation-engine";

export interface CalculationInput {
  role: "IMPORTER" | "INDIRECT_REP" | "OPERATOR";
  importYear: number;
  importQuarter?: number;
  cnCode: string;
  productionVolume: number; // net mass (tonnes) or MWh
  installationName: string;
  hasActualData: boolean;
  isVerified: boolean;
  directEmissionsInput?: number;
  electricityConsumedInput?: number;
  gridEmissionFactorInput?: number;
  isComplexGood: boolean;
  precursorDirectEmissionsInput?: number;
  precursorIndirectEmissionsInput?: number;
  carbonPricePaidInput?: number; // net effective price paid per tonne
}

export interface CalculationOutput {
  inputs: CalculationInput;
  applicability: ApplicabilityResult;
  pathway: PathwayValidation;
  pricing: CertificatePriceResult;
  specificDirectEmissions: number;
  specificIndirectEmissions: number;
  totalDirectEmissions: number;
  totalIndirectEmissions: number;
  totalEmbeddedEmissions: number;
  freeAllocationAdjustment: number;
  carbonPriceDeduction: number;
  grossCertificates: number;
  netCertificatesDue: number;
  estimatedCertificateCostEur: number;
  costPerTonneProductEur: number;
  dataCompletenessScore: number; // 0 to 100
  formulasUsed: Record<string, string>;
  traces?: Record<string, TraceNode>;
}

export function orchestrateCalculation(input: CalculationInput): CalculationOutput {
  const cnCode = input.cnCode;
  const totalMass = input.productionVolume || 0;
  
  // 1. Determine Applicability & de minimis thresholds
  const applicability = determineApplicability({
    cnCode,
    totalMassTonnes: totalMass,
    role: input.role,
  });

  // 2. Determine default emissions availability
  const defaultFactors = getDefaultEmissions(applicability.sector);
  const hasOfficialDefaults = defaultFactors !== null;

  // 3. Validate emission pathway
  const pathway = validateEmissionPathway({
    hasActualData: input.hasActualData,
    isVerified: input.isVerified,
    hasOfficialDefaults,
  });

  // 4. Resolve certificate price
  const pricing = resolveCertificatePrice({
    importYear: input.importYear,
    importQuarter: input.importQuarter,
  });

  const res = executeDeterministicCalculation({
    ...input,
    importQuarter: input.importQuarter || 1,
  });

  // Re-map internal specific direct/indirect calculations
  let specificDirect = 0;
  let specificIndirect = 0;
  
  if (totalMass > 0) {
    if (input.hasActualData) {
      const direct = Number(input.directEmissionsInput || 0);
      const indirect = Number(input.electricityConsumedInput || 0) * Number(input.gridEmissionFactorInput || 0.45);
      const precursorDirect = input.isComplexGood ? Number(input.precursorDirectEmissionsInput || 0) : 0;
      const precursorIndirect = input.isComplexGood ? Number(input.precursorIndirectEmissionsInput || 0) : 0;

      specificDirect = Number(((direct + precursorDirect) / totalMass).toFixed(4));
      specificIndirect = Number(((indirect + precursorIndirect) / totalMass).toFixed(4));
    } else if (defaultFactors) {
      specificDirect = defaultFactors.directFactor;
      specificIndirect = defaultFactors.indirectFactor;
    }
  }

  const grossCertificates = Math.max(0, res.totalEmbeddedEmissions - res.freeAllocationAdjustment);

  // Formulas registry for verification audit trails
  const formulasUsed = {
    totalDirect: "InstallationDirect + PrecursorDirect",
    totalIndirect: "(ElectricityConsumed * GridFactor) + PrecursorIndirect",
    totalEmbedded: "TotalDirectEmissions + TotalIndirectEmissions",
    freeAllocation: "TotalEmbeddedEmissions * BenchmarkFactor",
    grossCertificates: "max(0, TotalEmbeddedEmissions - FreeAllocationAdjustment)",
    netCertificates: "max(0, GrossCertificates - CarbonPricePaidDeduction)",
    cost: "NetCertificatesDue * CertificatePrice",
  };

  return {
    inputs: input,
    applicability,
    pathway,
    pricing,
    specificDirectEmissions: specificDirect,
    specificIndirectEmissions: specificIndirect,
    totalDirectEmissions: Number((specificDirect * totalMass).toFixed(4)),
    totalIndirectEmissions: Number((specificIndirect * totalMass).toFixed(4)),
    totalEmbeddedEmissions: res.totalEmbeddedEmissions,
    freeAllocationAdjustment: res.freeAllocationAdjustment,
    carbonPriceDeduction: res.carbonPriceDeduction,
    grossCertificates,
    netCertificatesDue: res.netCertificatesDue,
    estimatedCertificateCostEur: res.estimatedCertificateCostEur,
    costPerTonneProductEur: totalMass > 0 ? Number((res.estimatedCertificateCostEur / totalMass).toFixed(2)) : 0,
    dataCompletenessScore: res.dataCompletenessScore,
    formulasUsed,
    traces: res.traces,
  };
}
