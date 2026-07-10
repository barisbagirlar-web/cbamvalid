import { resolveCertificatePrice } from "../engine/certificate-engine";
import { determineApplicability } from "../engine/applicability-engine";

export interface TraceNode {
  formulaId: string;
  formulaVersion: string;
  inputs: Record<string, unknown>;
  units: string;
  intermediateValues?: Record<string, number>;
  roundingMethod: string;
  officialDatasetIds?: string[];
  legalVersionRef: string;
  finalResult: number;
}

export interface DeterministicEngineOutput {
  status: "ACTUAL_VERIFIED" | "ACTUAL_UNVERIFIED" | "OFFICIAL_DEFAULT" | "PROVISIONAL_ESTIMATE" | "CALCULATION_BLOCKED";
  totalEmbeddedEmissions: number;
  specificEmbeddedEmissions: number;
  freeAllocationAdjustment: number;
  carbonPriceDeduction: number;
  netCertificatesDue: number;
  estimatedCertificateCostEur: number;
  dataCompletenessScore: number;
  traces: Record<string, TraceNode>;
}

/**
 * Executes deterministic, versioned CBAM calculations with auditable trace nodes.
 */
export function executeDeterministicCalculation(inputs: {
  role: string;
  importYear: number;
  importQuarter: number;
  cnCode: string;
  productionVolume: number;
  installationName: string;
  hasActualData: boolean;
  isVerified: boolean;
  directEmissionsInput?: number;
  electricityConsumedInput?: number;
  gridEmissionFactorInput?: number;
  isComplexGood: boolean;
  precursorDirectEmissionsInput?: number;
  precursorIndirectEmissionsInput?: number;
  carbonPricePaidInput?: number;
}): DeterministicEngineOutput {
  const traces: Record<string, TraceNode> = {};
  const legalVersionRef = "EU_2023_956_REGULATION";
  const roundingMethod = "ROUND_HALF_UP_TO_4_DECIMALS";

  // 1. Scope and Threshold check
  const applicability = determineApplicability({
    cnCode: inputs.cnCode,
    totalMassTonnes: inputs.productionVolume,
    role: inputs.role as "IMPORTER" | "INDIRECT_REP" | "OPERATOR",
  });

  traces["applicability"] = {
    formulaId: "determineApplicability",
    formulaVersion: "v1.0.0",
    inputs: { cnCode: inputs.cnCode, mass: inputs.productionVolume },
    units: "boolean",
    roundingMethod: "NONE",
    legalVersionRef,
    finalResult: applicability.isApplicable ? 1 : 0,
  };

  if (!applicability.isApplicable) {
    return {
      status: "CALCULATION_BLOCKED",
      totalEmbeddedEmissions: 0,
      specificEmbeddedEmissions: 0,
      freeAllocationAdjustment: 0,
      carbonPriceDeduction: 0,
      netCertificatesDue: 0,
      estimatedCertificateCostEur: 0,
      dataCompletenessScore: 0,
      traces,
    };
  }

  // 2. Resolve default value factors or use actual values
  let directEmissions = 0;
  let indirectEmissions = 0;

  if (inputs.hasActualData) {
    directEmissions = Number(inputs.directEmissionsInput || 0);
    // Net indirect = electricity consumed * factor
    const factor = Number(inputs.gridEmissionFactorInput || 0.45);
    indirectEmissions = Number(inputs.electricityConsumedInput || 0) * factor;

    traces["actualEmissions"] = {
      formulaId: "actualEmissionsSum",
      formulaVersion: "v1.0.0",
      inputs: {
        directEmissionsInput: inputs.directEmissionsInput,
        electricityConsumedInput: inputs.electricityConsumedInput,
        gridEmissionFactorInput: inputs.gridEmissionFactorInput,
      },
      units: "tCO2e",
      intermediateValues: { factor },
      roundingMethod,
      legalVersionRef,
      finalResult: directEmissions + indirectEmissions,
    };
  } else {
    // Sector-specific defaults mapping
    const sectorDefaults: Record<string, { direct: number; indirect: number }> = {
      STEEL: { direct: 1.85, indirect: 0.35 },
      ALUMINIUM: { direct: 2.1, indirect: 11.4 },
      CEMENT: { direct: 0.72, indirect: 0.08 },
      FERTILIZER: { direct: 2.3, indirect: 0.5 },
      HYDROGEN: { direct: 8.9, indirect: 0.0 },
      ELECTRICITY: { direct: 0.0, indirect: 0.45 },
    };

    const defs = sectorDefaults[applicability.sector] || { direct: 1.5, indirect: 0.2 };
    directEmissions = defs.direct * inputs.productionVolume;
    indirectEmissions = defs.indirect * inputs.productionVolume;

    traces["defaultEmissions"] = {
      formulaId: "defaultEmissionsProduct",
      formulaVersion: "v1.0.0",
      inputs: {
        sector: applicability.sector,
        productionVolume: inputs.productionVolume,
      },
      units: "tCO2e",
      intermediateValues: { directFactor: defs.direct, indirectFactor: defs.indirect },
      roundingMethod,
      legalVersionRef,
      finalResult: directEmissions + indirectEmissions,
    };
  }

  // Precursor processing
  let precursorEmissions = 0;
  if (inputs.isComplexGood) {
    const pDirect = Number(inputs.precursorDirectEmissionsInput || 0);
    const pIndirect = Number(inputs.precursorIndirectEmissionsInput || 0);
    precursorEmissions = pDirect + pIndirect;

    traces["precursors"] = {
      formulaId: "precursorSum",
      formulaVersion: "v1.0.0",
      inputs: {
        precursorDirectEmissionsInput: inputs.precursorDirectEmissionsInput,
        precursorIndirectEmissionsInput: inputs.precursorIndirectEmissionsInput,
      },
      units: "tCO2e",
      roundingMethod,
      legalVersionRef,
      finalResult: precursorEmissions,
    };
  }

  // Total Embedded Emissions
  const totalEmbedded = directEmissions + indirectEmissions + precursorEmissions;
  const specificEmbedded = inputs.productionVolume > 0 ? totalEmbedded / inputs.productionVolume : 0;

  traces["totalEmbedded"] = {
    formulaId: "totalEmbeddedFormula",
    formulaVersion: "v1.0.0",
    inputs: {
      directEmissions,
      indirectEmissions,
      precursorEmissions,
    },
    units: "tCO2e",
    roundingMethod,
    legalVersionRef,
    finalResult: Number(totalEmbedded.toFixed(4)),
  };

  // Free Allocation Adjustment (Steel gets a standard 10% deduction, other sectors vary)
  const allocationFactor = applicability.sector === "STEEL" ? 0.1 : 0.05;
  const freeAllocationAdjustment = totalEmbedded * allocationFactor;

  traces["freeAllocation"] = {
    formulaId: "freeAllocationDeduction",
    formulaVersion: "v1.0.0",
    inputs: {
      totalEmbedded,
      allocationFactor,
    },
    units: "tCO2e",
    roundingMethod,
    legalVersionRef,
    finalResult: Number(freeAllocationAdjustment.toFixed(4)),
  };

  // Carbon Price Paid Deduction
  const carbonPricePaid = Number(inputs.carbonPricePaidInput || 0);
  const carbonPriceDeduction = carbonPricePaid * totalEmbedded;

  traces["carbonPriceDeduction"] = {
    formulaId: "carbonPriceDeductionFormula",
    formulaVersion: "v1.0.0",
    inputs: {
      carbonPricePaid,
      totalEmbedded,
    },
    units: "EUR",
    roundingMethod,
    legalVersionRef,
    finalResult: Number(carbonPriceDeduction.toFixed(4)),
  };

  // Resolve Certificate Pricing
  const pricing = resolveCertificatePrice({
    importYear: inputs.importYear,
    importQuarter: inputs.importQuarter,
  });

  // Net Certificates Due
  const rawCertificates = totalEmbedded - freeAllocationAdjustment - carbonPriceDeduction;
  const netCertificatesDue = Math.max(0, Math.ceil(rawCertificates));

  traces["netCertificates"] = {
    formulaId: "netCertificatesFormula",
    formulaVersion: "v1.0.0",
    inputs: {
      totalEmbedded,
      freeAllocationAdjustment,
      carbonPriceDeduction,
    },
    units: "units",
    roundingMethod: "CEIL",
    legalVersionRef,
    finalResult: netCertificatesDue,
  };

  // Estimated Cost
  const estimatedCertificateCostEur = netCertificatesDue * pricing.priceEurPerTonne;

  traces["certificateCost"] = {
    formulaId: "certificateCostFormula",
    formulaVersion: "v1.0.0",
    inputs: {
      netCertificatesDue,
      priceEurPerTonne: pricing.priceEurPerTonne,
    },
    units: "EUR",
    roundingMethod,
    officialDatasetIds: [pricing.datasetVersion],
    legalVersionRef,
    finalResult: Number(estimatedCertificateCostEur.toFixed(2)),
  };

  // Status classification
  let status: "ACTUAL_VERIFIED" | "ACTUAL_UNVERIFIED" | "OFFICIAL_DEFAULT" | "PROVISIONAL_ESTIMATE" | "CALCULATION_BLOCKED" = "OFFICIAL_DEFAULT";
  if (inputs.hasActualData) {
    status = inputs.isVerified ? "ACTUAL_VERIFIED" : "ACTUAL_UNVERIFIED";
  }
  if (pricing.isProvisional) {
    status = "PROVISIONAL_ESTIMATE";
  }

  // Completeness score
  let completenessScore = 60;
  if (inputs.hasActualData) completenessScore += 20;
  if (inputs.isVerified) completenessScore += 20;

  return {
    status,
    totalEmbeddedEmissions: Number(totalEmbedded.toFixed(4)),
    specificEmbeddedEmissions: Number(specificEmbedded.toFixed(4)),
    freeAllocationAdjustment: Number(freeAllocationAdjustment.toFixed(4)),
    carbonPriceDeduction: Number(carbonPriceDeduction.toFixed(4)),
    netCertificatesDue,
    estimatedCertificateCostEur: Number(estimatedCertificateCostEur.toFixed(2)),
    dataCompletenessScore: completenessScore,
    traces,
  };
}
