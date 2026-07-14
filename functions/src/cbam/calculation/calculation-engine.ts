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
  
  // Regulatory requirements:
  unitContract: string;
  roundingRule: string;
  source: string;
  sourceVersion: string;
  effectiveDate: string;
  
  finalResult: number;
}

export interface DeterministicEngineOutput {
  status: "ACTUAL_VERIFIED" | "ACTUAL_UNVERIFIED" | "OFFICIAL_DEFAULT" | "PROVISIONAL_ESTIMATE" | "CALCULATION_BLOCKED";
  totalEmbeddedEmissions: number;
  specificEmbeddedEmissions: number;
  freeAllocationAdjustment: number;
  carbonPriceDeduction: number; // mapped to eligibleCertificateReduction for backward compatibility
  
  // Decoupled regulatory parameters:
  embeddedEmissionsTco2e: number;
  carbonPricePaidCurrency: number;
  carbonPricePaidPerTco2e: number;
  eligibleCertificateReduction: number;
  certificatesBeforeReduction: number;
  certificatesAfterReduction: number;
  
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
  const legalVersionRef = "Regulation (EU) 2023/956";
  const source = "Regulation (EU) 2023/956, Annex III & IV";
  const sourceVersion = "v1.0.0";
  const effectiveDate = "2023-10-01";
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
    unitContract: "(string, number) => boolean",
    roundingRule: "NONE",
    source,
    sourceVersion,
    effectiveDate,
    finalResult: applicability.isApplicable ? 1 : 0,
  };

  if (!applicability.isApplicable) {
    return {
      status: "CALCULATION_BLOCKED",
      totalEmbeddedEmissions: 0,
      specificEmbeddedEmissions: 0,
      freeAllocationAdjustment: 0,
      carbonPriceDeduction: 0,
      embeddedEmissionsTco2e: 0,
      carbonPricePaidCurrency: 0,
      carbonPricePaidPerTco2e: 0,
      eligibleCertificateReduction: 0,
      certificatesBeforeReduction: 0,
      certificatesAfterReduction: 0,
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
      unitContract: "(tCO2e, MWh, tCO2e/MWh) => tCO2e",
      roundingRule: "ROUND_HALF_UP_TO_4_DECIMALS",
      source,
      sourceVersion,
      effectiveDate,
      finalResult: Number((directEmissions + indirectEmissions).toFixed(4)),
    };
  } else {
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
      unitContract: "(string, number) => tCO2e",
      roundingRule: "ROUND_HALF_UP_TO_4_DECIMALS",
      source,
      sourceVersion,
      effectiveDate,
      finalResult: Number((directEmissions + indirectEmissions).toFixed(4)),
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
      unitContract: "(tCO2e, tCO2e) => tCO2e",
      roundingRule: "ROUND_HALF_UP_TO_4_DECIMALS",
      source,
      sourceVersion,
      effectiveDate,
      finalResult: Number(precursorEmissions.toFixed(4)),
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
    unitContract: "(tCO2e, tCO2e, tCO2e) => tCO2e",
    roundingRule: "ROUND_HALF_UP_TO_4_DECIMALS",
    source,
    sourceVersion,
    effectiveDate,
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
    unitContract: "(tCO2e, number) => tCO2e",
    roundingRule: "ROUND_HALF_UP_TO_4_DECIMALS",
    source,
    sourceVersion,
    effectiveDate,
    finalResult: Number(freeAllocationAdjustment.toFixed(4)),
  };

  // Decoupled Regulatory Calculations (Carbon Price Paid Relief)
  const embeddedEmissionsTco2e = totalEmbedded;
  const carbonPricePaidPerTco2e = Number(inputs.carbonPricePaidInput || 0);
  const carbonPricePaidCurrency = carbonPricePaidPerTco2e * embeddedEmissionsTco2e;

  // Resolve Certificate Pricing
  const pricing = resolveCertificatePrice({
    importYear: inputs.importYear,
    importQuarter: inputs.importQuarter,
  });

  // Verify unit contracts and compatibilities before calculation
  if (isNaN(carbonPricePaidPerTco2e) || isNaN(pricing.priceEurPerTonne) || pricing.priceEurPerTonne <= 0) {
    return {
      status: "CALCULATION_BLOCKED",
      totalEmbeddedEmissions: 0,
      specificEmbeddedEmissions: 0,
      freeAllocationAdjustment: 0,
      carbonPriceDeduction: 0,
      embeddedEmissionsTco2e: 0,
      carbonPricePaidCurrency: 0,
      carbonPricePaidPerTco2e: 0,
      eligibleCertificateReduction: 0,
      certificatesBeforeReduction: 0,
      certificatesAfterReduction: 0,
      netCertificatesDue: 0,
      estimatedCertificateCostEur: 0,
      dataCompletenessScore: 0,
      traces,
    };
  }

  // Certificates due before carbon price relief
  const certificatesBeforeReduction = Math.max(0, Math.ceil(embeddedEmissionsTco2e - freeAllocationAdjustment));

  // Carbon Price Paid Deduction is calculated separately in certificates count
  // Unverified carbon-price evidence must produce a readiness gap, not an automatic deduction
  let eligibleCertificateReduction = 0;
  if (inputs.isVerified && carbonPricePaidCurrency > 0) {
    eligibleCertificateReduction = Math.min(
      certificatesBeforeReduction,
      Math.floor(carbonPricePaidCurrency / pricing.priceEurPerTonne)
    );
  }

  const certificatesAfterReduction = Math.max(0, certificatesBeforeReduction - eligibleCertificateReduction);
  const netCertificatesDue = certificatesAfterReduction;

  traces["carbonPriceDeduction"] = {
    formulaId: "carbonPriceReliefReduction",
    formulaVersion: "v1.0.0",
    inputs: {
      carbonPricePaidPerTco2e,
      embeddedEmissionsTco2e,
      certificatePriceEur: pricing.priceEurPerTonne,
      isVerified: inputs.isVerified,
    },
    units: "certificates",
    roundingMethod: "FLOOR",
    legalVersionRef,
    unitContract: "(EUR/tCO2e, tCO2e, EUR/certificate, boolean) => certificates",
    roundingRule: "FLOOR_TO_INTEGER",
    source,
    sourceVersion,
    effectiveDate,
    finalResult: eligibleCertificateReduction,
  };

  // Net Certificates Due
  traces["netCertificates"] = {
    formulaId: "netCertificatesFormula",
    formulaVersion: "v1.0.0",
    inputs: {
      certificatesBeforeReduction,
      eligibleCertificateReduction,
    },
    units: "certificates",
    roundingMethod: "SUBTRACT",
    legalVersionRef,
    unitContract: "(certificates, certificates) => certificates",
    roundingRule: "EXACT",
    source,
    sourceVersion,
    effectiveDate,
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
    unitContract: "(certificates, EUR/certificate) => EUR",
    roundingRule: "ROUND_HALF_UP_TO_2_DECIMALS",
    source,
    sourceVersion,
    effectiveDate,
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
    carbonPriceDeduction: eligibleCertificateReduction, // mapped to legacy key for backward compatibility
    
    // Decoupled regulatory fields:
    embeddedEmissionsTco2e: Number(embeddedEmissionsTco2e.toFixed(4)),
    carbonPricePaidCurrency: Number(carbonPricePaidCurrency.toFixed(2)),
    carbonPricePaidPerTco2e,
    eligibleCertificateReduction,
    certificatesBeforeReduction,
    certificatesAfterReduction,
    
    netCertificatesDue,
    estimatedCertificateCostEur: Number(estimatedCertificateCostEur.toFixed(2)),
    dataCompletenessScore: completenessScore,
    traces,
  };
}
