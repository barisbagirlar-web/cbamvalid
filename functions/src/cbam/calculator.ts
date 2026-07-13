import crypto from "crypto";
import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode } from "./schema";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const CALCULATION_RULESET = "EU-CBAM-DEFINITIVE-2026";
export const CALCULATION_ENGINE_VERSION = "2.0.0";
export const CALCULATION_SOURCE = "Commission Implementing Regulation (EU) 2025/2547";

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function hashObject(value: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function calculationId(formulaId: string, inputs: Record<string, any>): string {
  return `calc_${hashObject({ formulaId, inputs, ruleset: CALCULATION_RULESET }).slice(0, 32)}`;
}

function decimal(value: unknown, field: string): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  try {
    const parsed = new Decimal(value as Decimal.Value);
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new Error(`CALCULATION_INPUT_INVALID:${field}`);
  }
}

export interface DossierCalculationResult {
  trace: CalculationTraceNode[];
  totalDirectEmissions: string;
  totalIndirectEmissions: string;
  totalPrecursorEmissions: string;
  totalEmbeddedEmissions: string;
  productionVolume: string;
  specificEmbeddedEmissions: string;
  eligibleCertificateReduction: string;
  calculationRootHash: string;
  ruleset: string;
  engineVersion: string;
}

function traceNode(params: {
  formulaId: string;
  inputs: Record<string, any>;
  outputValue: Decimal;
  outputUnit: string;
  assumptions?: string[];
  warnings?: string[];
  rounding?: Record<string, any>;
}): CalculationTraceNode {
  const normalizedInputs = canonicalize(params.inputs);
  const payload = {
    formulaId: params.formulaId,
    formulaVersion: CALCULATION_RULESET,
    officialSource: CALCULATION_SOURCE,
    sourceVersion: "2026 definitive period",
    effectiveDate: "2026-01-01",
    inputs: normalizedInputs,
    assumptions: params.assumptions || [],
    warnings: params.warnings || [],
    outputValue: params.outputValue.toString(),
    outputUnit: params.outputUnit,
    roundingApplied: params.rounding,
  };

  return {
    calculationId: calculationId(params.formulaId, normalizedInputs),
    formulaId: params.formulaId,
    formulaVersion: CALCULATION_RULESET,
    officialSource: CALCULATION_SOURCE,
    sourceVersion: "2026 definitive period",
    effectiveDate: "2026-01-01",
    inputs: normalizedInputs,
    roundingApplied: params.rounding,
    assumptions: params.assumptions || [],
    warnings: params.warnings || [],
    outputValue: params.outputValue.toString(),
    outputUnit: params.outputUnit,
    calculationHash: hashObject(payload),
  };
}

export function performDossierCalculations(caseData: AuditReadyCase): DossierCalculationResult {
  const directEmissions = decimal(caseData.directEmissions.value, "directEmissions");
  const electricityConsumed = decimal(caseData.electricityConsumed.value, "electricityConsumed");
  const gridFactor = decimal(caseData.gridEmissionFactor.value, "gridEmissionFactor");

  if (directEmissions.isNegative() || electricityConsumed.isNegative() || gridFactor.isNegative()) {
    throw new Error("CALCULATION_NEGATIVE_INPUT");
  }

  const productionVolume = caseData.goods.reduce(
    (total, good, index) => {
      const quantity = decimal(good.productionVolume.value, `goods.${index}.productionVolume`);
      if (quantity.isNegative()) throw new Error("CALCULATION_NEGATIVE_PRODUCTION_VOLUME");
      return total.plus(quantity);
    },
    new Decimal(0)
  );

  if (productionVolume.lte(0)) {
    throw new Error("CALCULATION_PRODUCTION_VOLUME_REQUIRED");
  }

  const trace: CalculationTraceNode[] = [];

  const indirectEmissions = electricityConsumed.times(gridFactor);
  trace.push(traceNode({
    formulaId: "CBAM_INDIRECT_EMISSIONS",
    inputs: {
      electricityConsumed: electricityConsumed.toString(),
      electricityUnit: caseData.electricityConsumed.canonicalUnit || caseData.electricityConsumed.unit || "MWh",
      gridEmissionFactor: gridFactor.toString(),
      gridFactorUnit: caseData.gridEmissionFactor.canonicalUnit || caseData.gridEmissionFactor.unit || "tCO2e/MWh",
    },
    outputValue: indirectEmissions,
    outputUnit: "tCO2e",
  }));

  let precursorDirect = new Decimal(0);
  let precursorIndirect = new Decimal(0);
  caseData.precursors.forEach((precursor, index) => {
    const direct = decimal(precursor.directEmissions.value, `precursors.${index}.directEmissions`);
    const indirect = decimal(precursor.indirectEmissions.value, `precursors.${index}.indirectEmissions`);
    if (direct.isNegative() || indirect.isNegative()) {
      throw new Error("CALCULATION_NEGATIVE_PRECURSOR_EMISSIONS");
    }
    precursorDirect = precursorDirect.plus(direct);
    precursorIndirect = precursorIndirect.plus(indirect);
  });

  const totalPrecursor = precursorDirect.plus(precursorIndirect);
  trace.push(traceNode({
    formulaId: "CBAM_PRECURSOR_EMISSIONS_SUM",
    inputs: {
      precursorCount: caseData.precursors.length,
      precursorDirect: precursorDirect.toString(),
      precursorIndirect: precursorIndirect.toString(),
    },
    outputValue: totalPrecursor,
    outputUnit: "tCO2e",
    warnings: caseData.precursors.length === 0 ? ["No precursor records were declared."] : [],
  }));

  const totalDirect = directEmissions.plus(precursorDirect);
  const totalIndirect = indirectEmissions.plus(precursorIndirect);
  const totalEmbedded = totalDirect.plus(totalIndirect);
  trace.push(traceNode({
    formulaId: "CBAM_TOTAL_EMBEDDED_EMISSIONS",
    inputs: {
      installationDirectEmissions: directEmissions.toString(),
      electricityIndirectEmissions: indirectEmissions.toString(),
      precursorDirectEmissions: precursorDirect.toString(),
      precursorIndirectEmissions: precursorIndirect.toString(),
    },
    outputValue: totalEmbedded,
    outputUnit: "tCO2e",
  }));

  const specificEmbedded = totalEmbedded.dividedBy(productionVolume);
  const roundedSpecific = specificEmbedded.toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
  trace.push(traceNode({
    formulaId: "CBAM_SPECIFIC_EMBEDDED_EMISSIONS",
    inputs: {
      totalEmbeddedEmissions: totalEmbedded.toString(),
      productionVolume: productionVolume.toString(),
    },
    outputValue: roundedSpecific,
    outputUnit: "tCO2e/t",
    rounding: { decimalPlaces: 6, mode: "ROUND_HALF_UP", stage: "final specific emissions" },
  }));

  const eligibleCertificateReduction = caseData.carbonPriceRecords.reduce(
    (total, record, index) => {
      const value = decimal(record.eligibleCertificateReduction, `carbonPriceRecords.${index}.eligibleCertificateReduction`);
      if (value.isNegative()) throw new Error("CALCULATION_NEGATIVE_CARBON_PRICE_REDUCTION");
      return total.plus(value);
    },
    new Decimal(0)
  );

  trace.push(traceNode({
    formulaId: "CBAM_CARBON_PRICE_REDUCTION",
    inputs: {
      records: caseData.carbonPriceRecords.map((record) => ({
        id: record.id,
        eligibleCertificateReduction: String(record.eligibleCertificateReduction),
        currency: record.currency,
      })),
    },
    outputValue: eligibleCertificateReduction,
    outputUnit: "certificate-equivalent",
    assumptions: caseData.carbonPriceRecords.length > 0
      ? ["Recognition remains subject to documentary evidence and the applicable CBAM rules."]
      : [],
  }));

  const calculationRootHash = hashObject({
    ruleset: CALCULATION_RULESET,
    engineVersion: CALCULATION_ENGINE_VERSION,
    trace: trace.map((node) => node.calculationHash),
    totals: {
      totalDirect: totalDirect.toString(),
      totalIndirect: totalIndirect.toString(),
      totalEmbedded: totalEmbedded.toString(),
      productionVolume: productionVolume.toString(),
      specificEmbedded: roundedSpecific.toString(),
      eligibleCertificateReduction: eligibleCertificateReduction.toString(),
    },
  });

  return {
    trace,
    totalDirectEmissions: totalDirect.toString(),
    totalIndirectEmissions: totalIndirect.toString(),
    totalPrecursorEmissions: totalPrecursor.toString(),
    totalEmbeddedEmissions: totalEmbedded.toString(),
    productionVolume: productionVolume.toString(),
    specificEmbeddedEmissions: roundedSpecific.toString(),
    eligibleCertificateReduction: eligibleCertificateReduction.toString(),
    calculationRootHash,
    ruleset: CALCULATION_RULESET,
    engineVersion: CALCULATION_ENGINE_VERSION,
  };
}
