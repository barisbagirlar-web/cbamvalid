import crypto from "crypto";
import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode, InputDatum } from "./schema";
import { resolveCertificatePrice } from "./engine/certificate-engine";

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export const CALCULATION_RULESET = "EU-CBAM-DEFINITIVE-2026";
export const CALCULATION_ENGINE_VERSION = "3.0.0";
export const CALCULATION_SOURCE = "Regulation (EU) 2023/956, Annex IV; active definitive-period implementing rules";
export const ALLOCATION_TOLERANCE = new Decimal("0.000001");

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, JsonValue>>((result, key) => {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return String(value);
}

function hashObject(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function calculationId(formulaId: string, inputs: Record<string, unknown>): string {
  return `calc_${hashObject({ formulaId, inputs, ruleset: CALCULATION_RULESET }).slice(0, 32)}`;
}

function decimalRequired(value: unknown, field: string): Decimal {
  if (value === null || value === undefined || value === "") throw new Error(`CALCULATION_INPUT_REQUIRED:${field}`);
  try {
    const parsed = new Decimal(value as Decimal.Value);
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new Error(`CALCULATION_INPUT_INVALID:${field}`);
  }
}



function unitOf(datum: InputDatum, fallback: string): string {
  return datum.canonicalUnit || datum.unit || datum.rawUnit || fallback;
}

function requireUnit(datum: InputDatum, field: string, accepted: string[], fallback: string): string {
  const unit = unitOf(datum, fallback);
  if (!accepted.includes(unit)) throw new Error(`CALCULATION_UNIT_UNSUPPORTED:${field}:${unit}`);
  return unit;
}

function tonnes(value: Decimal, datum: InputDatum, field: string): { value: Decimal; conversion?: Record<string, unknown> } {
  const unit = requireUnit(datum, field, ["t", "kg", "metric_tonne"], "t");
  if (unit === "kg") return { value: value.dividedBy(1000), conversion: { fromUnit: "kg", toUnit: "t", divisor: "1000" } };
  return { value, conversion: unit === "metric_tonne" ? { fromUnit: "metric_tonne", toUnit: "t", factor: "1" } : undefined };
}

function traceNode(params: {
  formulaId: string;
  inputs: Record<string, unknown>;
  outputValue: Decimal;
  outputUnit: string;
  conversions?: Record<string, unknown>;
  intermediateCalculations?: Record<string, unknown>;
  assumptions?: string[];
  warnings?: string[];
  rounding?: Record<string, unknown>;
}): CalculationTraceNode {
  const normalizedInputs = canonicalize(params.inputs) as Record<string, JsonValue>;
  const payload = {
    formulaId: params.formulaId,
    formulaVersion: CALCULATION_RULESET,
    officialSource: CALCULATION_SOURCE,
    sourceVersion: "definitive period",
    effectiveDate: "2026-01-01",
    inputs: normalizedInputs,
    conversions: params.conversions,
    intermediateCalculations: params.intermediateCalculations,
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
    sourceVersion: "definitive period",
    effectiveDate: "2026-01-01",
    inputs: normalizedInputs,
    conversions: params.conversions,
    intermediateCalculations: params.intermediateCalculations,
    roundingApplied: params.rounding,
    assumptions: params.assumptions || [],
    warnings: params.warnings || [],
    outputValue: params.outputValue.toString(),
    outputUnit: params.outputUnit,
    calculationHash: hashObject(payload),
  };
}

export interface GoodCalculationResult {
  goodIndex: number;
  cnCode: string;
  sector: string;
  productionVolume: string;
  productionUnit: "t";
  allocationShare: string;
  allocationMethod: "SINGLE_GOOD_100_PERCENT" | "USER_DOCUMENTED_SHARE";
  allocatedDirectEmissions: string;
  allocatedIndirectEmissions: string;
  allocatedPrecursorEmissions: string;
  allocatedEmbeddedEmissions: string;
  specificDirectEmissions: string;
  specificIndirectEmissions: string;
  specificEmbeddedEmissions: string;
  traceCalculationId: string;
}

export interface DossierCalculationResult {
  trace: CalculationTraceNode[];
  goods: GoodCalculationResult[];
  perGoodResults: GoodCalculationResult[];
  installationDirectEmissions: string;
  electricityIndirectEmissions: string;
  precursorDirectEmissions: string;
  precursorIndirectEmissions: string;
  totalDirectEmissions: string;
  totalIndirectEmissions: string;
  totalPrecursorEmissions: string;
  totalEmbeddedEmissions: string;
  productionVolume: string;
  specificDirectEmissions: string;
  specificIndirectEmissions: string;
  specificEmbeddedEmissions: string;
  eligibleCertificateReduction: string;
  certificatesBeforeReduction: string;
  netCertificatesDue: string;
  estimatedCertificateCostEur: string;
  pricing: any;
  allocationShareTotal: string;
  allocationReconciliationDelta: string;
  calculationRootHash: string;
  ruleset: string;
  engineVersion: string;
  isComplexGood: boolean;
  inputs?: any;
  applicability?: any;
  formulasUsed?: any;
}

function resolveAllocationShares(caseData: AuditReadyCase): Decimal[] {
  if (caseData.goods.length === 0) throw new Error("CALCULATION_GOODS_REQUIRED");
  if (caseData.goods.length === 1) return [new Decimal(1)];
  const shares = caseData.goods.map((good, index) => {
    const share = decimalRequired(good.allocationShare?.value, `goods.${index}.allocationShare`);
    requireUnit(good.allocationShare || { value: share.toString(), sourceType: "ESTIMATED", confidenceStatus: "LOW_ESTIMATE" }, `goods.${index}.allocationShare`, ["fraction"], "fraction");
    if (share.lte(0) || share.gt(1)) throw new Error(`CALCULATION_ALLOCATION_SHARE_OUT_OF_RANGE:goods.${index}.allocationShare`);
    return share;
  });
  const total = shares.reduce((sum, share) => sum.plus(share), new Decimal(0));
  if (total.minus(1).abs().gt(ALLOCATION_TOLERANCE)) throw new Error(`CALCULATION_ALLOCATION_NOT_RECONCILED:${total.toString()}`);
  return shares;
}

export function performDossierCalculations(caseData: AuditReadyCase): DossierCalculationResult {
  const isComplexGoodParam = !!((caseData as any).isComplexGood || (caseData.goods?.[0] as any)?.isComplexGood);

  let directEmissions = decimalRequired(caseData.directEmissions.value, "directEmissions");
  let electricityConsumed = decimalRequired(caseData.electricityConsumed.value, "electricityConsumed");
  const gridFactor = decimalRequired(caseData.gridEmissionFactor.value, "gridEmissionFactor");
  requireUnit(caseData.directEmissions, "directEmissions", ["tCO2e"], "tCO2e");
  requireUnit(caseData.electricityConsumed, "electricityConsumed", ["MWh"], "MWh");
  requireUnit(caseData.gridEmissionFactor, "gridEmissionFactor", ["tCO2e/MWh"], "tCO2e/MWh");
  if (directEmissions.isNegative() || electricityConsumed.isNegative() || gridFactor.isNegative()) throw new Error("CALCULATION_NEGATIVE_INPUT");

  // Read precursors
  let rawPrecursorDirect = new Decimal(0);
  let rawPrecursorIndirect = new Decimal(0);
  caseData.precursors.forEach((precursor, index) => {
    const direct = decimalRequired(precursor.directEmissions.value, `precursors.${index}.directEmissions`);
    const indirect = decimalRequired(precursor.indirectEmissions.value, `precursors.${index}.indirectEmissions`);
    const quantity = decimalRequired(precursor.quantity.value, `precursors.${index}.quantity`);
    requireUnit(precursor.directEmissions, `precursors.${index}.directEmissions`, ["tCO2e"], "tCO2e");
    requireUnit(precursor.indirectEmissions, `precursors.${index}.indirectEmissions`, ["tCO2e"], "tCO2e");
    tonnes(quantity, precursor.quantity, `precursors.${index}.quantity`);
    if (direct.isNegative() || indirect.isNegative() || quantity.lte(0)) throw new Error(`CALCULATION_INVALID_PRECURSOR_INPUT:${index}`);
    rawPrecursorDirect = rawPrecursorDirect.plus(direct);
    rawPrecursorIndirect = rawPrecursorIndirect.plus(indirect);
  });

  let precursorDirect = new Decimal(0);
  let precursorIndirect = new Decimal(0);
  const trace: CalculationTraceNode[] = [];

  if (isComplexGoodParam) {
    // Complex Good: keep precursor values separate
    precursorDirect = rawPrecursorDirect;
    precursorIndirect = rawPrecursorIndirect;
  } else {
    // Simple Good: fold precursor emissions into facility-level direct and indirect emissions
    directEmissions = directEmissions.plus(rawPrecursorDirect);
    const foldedIndirect = electricityConsumed.times(gridFactor).plus(rawPrecursorIndirect);
    // Adjust electricity consumed to match the folded total indirect emissions for mathematical parity
    electricityConsumed = gridFactor.gt(0) ? foldedIndirect.dividedBy(gridFactor) : new Decimal(0);
  }

  const productionRecords = caseData.goods.map((good, index) => {
    const raw = decimalRequired(good.productionVolume.value, `goods.${index}.productionVolume`);
    if (raw.lte(0)) throw new Error(`CALCULATION_PRODUCTION_VOLUME_REQUIRED:goods.${index}`);
    const normalized = tonnes(raw, good.productionVolume, `goods.${index}.productionVolume`);
    return { good, normalized: normalized.value, conversion: normalized.conversion };
  });
  const productionVolume = productionRecords.reduce((total, record) => total.plus(record.normalized), new Decimal(0));
  if (productionVolume.lte(0)) throw new Error("CALCULATION_PRODUCTION_VOLUME_REQUIRED");

  // 1. Indirect Electricity Emissions
  const indirectEmissions = electricityConsumed.times(gridFactor);
  trace.push(traceNode({
    formulaId: "CBAM_INDIRECT_ELECTRICITY",
    inputs: { electricityConsumed: electricityConsumed.toString(), electricityUnit: "MWh", gridEmissionFactor: gridFactor.toString(), gridFactorUnit: "tCO2e/MWh" },
    outputValue: indirectEmissions,
    outputUnit: "tCO2e",
    intermediateCalculations: { multiplication: `${electricityConsumed.toString()} × ${gridFactor.toString()}` }
  }));

  // 2. Precursor Emissions Sum (Only pushed if complex good)
  const totalPrecursor = precursorDirect.plus(precursorIndirect);
  if (isComplexGoodParam) {
    trace.push(traceNode({
      formulaId: "CBAM_PRECURSOR_EMISSIONS_SUM",
      inputs: { precursorCount: caseData.precursors.length, precursorDirect: precursorDirect.toString(), precursorIndirect: precursorIndirect.toString() },
      outputValue: totalPrecursor,
      outputUnit: "tCO2e"
    }));
  }

  // 3. Facility Direct Emissions Node
  trace.push(traceNode({
    formulaId: "CBAM_DIRECT_EMISSIONS",
    inputs: { directEmissions: directEmissions.toString(), directUnit: "tCO2e" },
    outputValue: directEmissions,
    outputUnit: "tCO2e"
  }));

  const totalDirect = directEmissions.plus(precursorDirect);
  const totalIndirect = indirectEmissions.plus(precursorIndirect);
  const totalEmbedded = totalDirect.plus(totalIndirect);

  // 4. Total Attributed Emissions
  trace.push(traceNode({
    formulaId: "CBAM_TOTAL_EMBEDDED_EMISSIONS",
    inputs: { installationDirectEmissions: directEmissions.toString(), electricityIndirectEmissions: indirectEmissions.toString(), precursorDirectEmissions: precursorDirect.toString(), precursorIndirectEmissions: precursorIndirect.toString() },
    outputValue: totalEmbedded,
    outputUnit: "tCO2e"
  }));

  const allocationShares = resolveAllocationShares(caseData);
  const allocationShareTotal = allocationShares.reduce((total, share) => total.plus(share), new Decimal(0));
  const allocationReconciliationDelta = allocationShareTotal.minus(1).abs();
  const goods = productionRecords.map((record, index): GoodCalculationResult => {
    const share = allocationShares[index];
    const allocatedDirect = totalDirect.times(share);
    const allocatedIndirect = totalIndirect.times(share);
    const allocatedPrecursor = totalPrecursor.times(share);
    const allocatedEmbedded = totalEmbedded.times(share);
    // Formatted to exactly 4 decimal places to preserve strict monotonicity
    const specific = allocatedEmbedded.dividedBy(record.normalized).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const specificDirect = allocatedDirect.dividedBy(record.normalized).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const specificIndirect = allocatedIndirect.dividedBy(record.normalized).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const cnCode = String(record.good.cnCode.value || "");
    const formulaId = `CBAM_GOOD_EMISSIONS_ALLOCATION_${index + 1}`;
    const goodTrace = traceNode({
      formulaId,
      inputs: {
        goodIndex: index + 1,
        cnCode,
        sector: record.good.sector,
        totalEmbeddedEmissions: totalEmbedded.toString(),
        allocationShare: share.toString(),
        productionVolume: record.normalized.toString(),
        productionUnit: "t"
      },
      conversions: record.conversion,
      intermediateCalculations: {
        allocatedDirectEmissions: allocatedDirect.toString(),
        allocatedIndirectEmissions: allocatedIndirect.toString(),
        allocatedEmbeddedEmissions: allocatedEmbedded.toString(),
        specificDirectEmissions: `${allocatedDirect.toString()} ÷ ${record.normalized.toString()}`,
        specificIndirectEmissions: `${allocatedIndirect.toString()} ÷ ${record.normalized.toString()}`,
        specificEmbeddedEmissions: `${allocatedEmbedded.toString()} ÷ ${record.normalized.toString()}`
      },
      outputValue: specific,
      outputUnit: "tCO2e/t",
      rounding: { decimalPlaces: 4, mode: "ROUND_HALF_UP", stage: "per-good specific embedded emissions" }
    });
    trace.push(goodTrace);
    return {
      goodIndex: index + 1,
      cnCode,
      sector: record.good.sector,
      productionVolume: record.normalized.toString(),
      productionUnit: "t",
      allocationShare: share.toString(),
      allocationMethod: caseData.goods.length === 1 ? "SINGLE_GOOD_100_PERCENT" : "USER_DOCUMENTED_SHARE",
      allocatedDirectEmissions: allocatedDirect.toString(),
      allocatedIndirectEmissions: allocatedIndirect.toString(),
      allocatedPrecursorEmissions: allocatedPrecursor.toString(),
      allocatedEmbeddedEmissions: allocatedEmbedded.toString(),
      specificDirectEmissions: specificDirect.toString(),
      specificIndirectEmissions: specificIndirect.toString(),
      specificEmbeddedEmissions: specific.toString(),
      traceCalculationId: goodTrace.calculationId
    };
  });

  const allocatedTotal = goods.reduce((sum, good) => sum.plus(good.allocatedEmbeddedEmissions), new Decimal(0));
  if (allocatedTotal.minus(totalEmbedded).abs().gt("0.000000000001")) throw new Error(`CALCULATION_ALLOCATED_EMISSIONS_NOT_RECONCILED:${allocatedTotal.toString()}`);
  trace.push(traceNode({ formulaId: "CBAM_GOODS_ALLOCATION_RECONCILIATION", inputs: { allocationShares: goods.map((good) => good.allocationShare), allocatedEmbeddedEmissions: goods.map((good) => good.allocatedEmbeddedEmissions), totalEmbeddedEmissions: totalEmbedded.toString() }, outputValue: allocatedTotal.minus(totalEmbedded).abs(), outputUnit: "tCO2e", assumptions: caseData.goods.length === 1 ? ["A single good receives 100% of installation emissions."] : [] }));

  // aggregateSpecific calculated to exactly 4 decimal places
  const aggregateSpecific = totalEmbedded.dividedBy(productionVolume).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  trace.push(traceNode({
    formulaId: "CBAM_SPECIFIC_EMISSIONS",
    inputs: { totalEmbeddedEmissions: totalEmbedded.toString(), aggregateProductionVolume: productionVolume.toString() },
    outputValue: aggregateSpecific,
    outputUnit: "tCO2e/t",
    rounding: { decimalPlaces: 4, mode: "ROUND_HALF_UP", stage: "aggregate diagnostic only" },
    assumptions: ["The aggregate intensity is a portfolio diagnostic; reportable values are the per-good intensities."]
  }));

  // 1. Resolve Certificate Price
  const importYear = Number(caseData.reportingPeriod?.year?.value) || 2026;
  const importQuarter = Number(caseData.reportingPeriod?.quarter?.value) || 1;
  const pricing = resolveCertificatePrice({ importYear, importQuarter });
  const certPrice = new Decimal(pricing.priceEurPerTonne);

  // 2. Calculate Carbon Price Reduction Equivalent
  const eligibleCertificateReduction = caseData.carbonPriceRecords.reduce((total, record, index) => {
    const amount = new Decimal(record.amountPaid || 0);
    if (amount.isNegative()) throw new Error("CALCULATION_NEGATIVE_CARBON_PRICE_AMOUNT");
    const reduction = certPrice.gt(0) ? amount.dividedBy(certPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0);
    record.eligibleCertificateReduction = Number(reduction.toString());
    return total.plus(reduction);
  }, new Decimal(0));
  trace.push(traceNode({
    formulaId: "CBAM_CARBON_PRICE_REDUCTION",
    inputs: { records: caseData.carbonPriceRecords.map((record) => ({ id: record.id, amountPaid: String(record.amountPaid), currency: record.currency, certificatePrice: certPrice.toString() })) },
    outputValue: eligibleCertificateReduction,
    outputUnit: "certificate-equivalent",
    assumptions: caseData.carbonPriceRecords.length > 0 ? ["Deduction calculated dynamically: amountPaid / certificatePrice (rounded per record)."] : []
  }));

  const specificDirect = totalDirect.dividedBy(productionVolume).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const specificIndirect = totalIndirect.dividedBy(productionVolume).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  // CBAM Regulation (EU) 2023/956: CBAM certificates correspond 1:1 to embedded emissions.
  const freeAllocationAdjustment = new Decimal(0);

  // Gross CBAM certificates = total embedded emissions, ceiling to whole certificate
  const certificatesBeforeReduction = Decimal.max(0, totalEmbedded.minus(freeAllocationAdjustment).ceil());

  // 5. Net CBAM Certificates Due
  const netCertificatesDue = Decimal.max(0, certificatesBeforeReduction.minus(eligibleCertificateReduction));
  trace.push(traceNode({
    formulaId: "CBAM_NET_OBLIGATION",
    inputs: { grossCertificates: certificatesBeforeReduction.toString(), eligibleReduction: eligibleCertificateReduction.toString() },
    outputValue: netCertificatesDue,
    outputUnit: "certificates"
  }));

  // 5. Estimated Financial Obligation (EUR)
  const estimatedCertificateCostEur = netCertificatesDue.times(pricing.priceEurPerTonne);

  const calculationRootHash = hashObject({ ruleset: CALCULATION_RULESET, engineVersion: CALCULATION_ENGINE_VERSION, trace: trace.map((item) => item.calculationHash), totals: { installationDirect: directEmissions.toString(), electricityIndirect: indirectEmissions.toString(), precursorDirect: precursorDirect.toString(), precursorIndirect: precursorIndirect.toString(), totalDirect: totalDirect.toString(), totalIndirect: totalIndirect.toString(), totalPrecursor: totalPrecursor.toString(), totalEmbedded: totalEmbedded.toString(), productionVolume: productionVolume.toString(), aggregateSpecific: aggregateSpecific.toString(), eligibleCertificateReduction: eligibleCertificateReduction.toString(), allocationShareTotal: allocationShareTotal.toString(), allocationReconciliationDelta: allocationReconciliationDelta.toString(), certificatesBeforeReduction: certificatesBeforeReduction.toString(), netCertificatesDue: netCertificatesDue.toString(), estimatedCertificateCostEur: estimatedCertificateCostEur.toString() }, goods });

  return {
    trace,
    goods,
    perGoodResults: goods,
    installationDirectEmissions: directEmissions.toString(),
    electricityIndirectEmissions: indirectEmissions.toString(),
    precursorDirectEmissions: precursorDirect.toString(),
    precursorIndirectEmissions: precursorIndirect.toString(),
    totalDirectEmissions: totalDirect.toString(),
    totalIndirectEmissions: totalIndirect.toString(),
    totalPrecursorEmissions: totalPrecursor.toString(),
    totalEmbeddedEmissions: totalEmbedded.toString(),
    productionVolume: productionVolume.toString(),
    specificDirectEmissions: specificDirect.toString(),
    specificIndirectEmissions: specificIndirect.toString(),
    specificEmbeddedEmissions: aggregateSpecific.toString(),
    eligibleCertificateReduction: eligibleCertificateReduction.toString(),
    certificatesBeforeReduction: certificatesBeforeReduction.toString(),
    netCertificatesDue: netCertificatesDue.toString(),
    estimatedCertificateCostEur: estimatedCertificateCostEur.toString(),
    pricing,
    allocationShareTotal: allocationShareTotal.toString(),
    allocationReconciliationDelta: allocationReconciliationDelta.toString(),
    calculationRootHash,
    ruleset: CALCULATION_RULESET,
    engineVersion: CALCULATION_ENGINE_VERSION,
    isComplexGood: isComplexGoodParam,
    inputs: {
      role: caseData.importerIdentity?.eoriNumber?.value ? "IMPORTER" : "EXPORTER",
      importYear: Number(caseData.reportingPeriod?.year?.value || 2026),
      importQuarter: (Number(caseData.reportingPeriod?.quarter?.value) || 1),
      cnCode: String(caseData.goods?.[0]?.cnCode?.value || ""),
      productionVolume: Number(caseData.goods?.[0]?.productionVolume?.value || 0),
      productionUnit: "t",
      directEmissions: Number(caseData.directEmissions?.value || 0),
      electricityConsumed: Number(caseData.electricityConsumed?.value || 0),
      gridEmissionFactor: Number(caseData.gridEmissionFactor?.value || 0),
      precursorDirectEmissions: precursorDirect.toNumber(),
      precursorIndirectEmissions: precursorIndirect.toNumber(),
    },
    applicability: {
      sector: String(caseData.goods?.[0]?.sector || "IRON_AND_STEEL"),
    },
    formulasUsed: {}
  };
}
