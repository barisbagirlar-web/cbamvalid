import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode } from "./schema";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const PREVIEW_RULESET = "EU-CBAM-DEFINITIVE-2026";
export const PREVIEW_ENGINE_VERSION = "3.0.0-preview";
export const PREVIEW_SOURCE = "Regulation (EU) 2023/956, Annex IV; preview only";
const ALLOCATION_TOLERANCE = new Decimal("0.000001");

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function canonicalize(value: unknown): JsonLike {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, JsonLike>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return String(value);
}

function previewHash(value: unknown): string {
  const source = JSON.stringify(canonicalize(value));
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const codePoint = source.charCodeAt(index);
    first = Math.imul(first ^ codePoint, 0x01000193) >>> 0;
    second = Math.imul(second ^ (codePoint + index), 0x85ebca6b) >>> 0;
  }
  return `preview_${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

function decimal(value: unknown, field: string): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const parsed = new Decimal(value as Decimal.Value);
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new Error(`CALCULATION_INPUT_INVALID:${field}`);
  }
}

function node(params: {
  formulaId: string;
  inputs: Record<string, unknown>;
  outputValue: Decimal | "NOT_CALCULATED";
  outputUnit: string;
  warnings?: string[];
  roundingApplied?: Record<string, unknown>;
}): CalculationTraceNode {
  const normalizedInputs = canonicalize(params.inputs) as Record<string, JsonLike>;
  const outputValue = params.outputValue === "NOT_CALCULATED" ? params.outputValue : params.outputValue.toString();
  const payload = {
    formulaId: params.formulaId,
    inputs: normalizedInputs,
    outputValue,
    outputUnit: params.outputUnit,
    warnings: params.warnings || [],
    ruleset: PREVIEW_RULESET,
  };
  return {
    calculationId: previewHash(payload),
    formulaId: params.formulaId,
    formulaVersion: PREVIEW_RULESET,
    officialSource: PREVIEW_SOURCE,
    sourceVersion: "definitive period preview",
    effectiveDate: "2026-01-01",
    inputs: normalizedInputs,
    roundingApplied: params.roundingApplied,
    assumptions: [],
    warnings: params.warnings || [],
    outputValue,
    outputUnit: params.outputUnit,
    calculationHash: previewHash(payload),
  };
}

export type GoodCalculationPreview = {
  goodIndex: number;
  cnCode: string;
  sector: string;
  allocationShare: string;
  productionVolume: string;
  allocatedEmbeddedEmissions: string;
  specificEmbeddedEmissions: string;
};

export type DossierCalculationPreview = {
  trace: CalculationTraceNode[];
  goods: GoodCalculationPreview[];
  totalDirectEmissions: string;
  totalIndirectEmissions: string;
  totalPrecursorEmissions: string;
  totalEmbeddedEmissions: string;
  productionVolume: string;
  specificEmbeddedEmissions: string;
  allocationShareTotal: string;
  allocationReconciliationDelta: string;
};

export function performDossierCalculations(caseData: AuditReadyCase): DossierCalculationPreview {
  const trace: CalculationTraceNode[] = [];
  const direct = decimal(caseData.directEmissions.value, "directEmissions");
  const electricity = decimal(caseData.electricityConsumed.value, "electricityConsumed");
  const gridFactor = decimal(caseData.gridEmissionFactor.value, "gridEmissionFactor");

  const productionRecords = caseData.goods.map((good, index) => ({
    good,
    production: decimal(good.productionVolume.value, `goods.${index}.productionVolume`),
  }));
  const productionComplete = productionRecords.every((record) => record.production !== null && record.production.gt(0));
  const production = productionComplete
    ? productionRecords.reduce((total, record) => total.plus(record.production!), new Decimal(0))
    : null;

  if ([direct, electricity, gridFactor].some((value) => value?.isNegative())) throw new Error("CALCULATION_NEGATIVE_INPUT");

  const indirect = electricity !== null && gridFactor !== null ? electricity.times(gridFactor) : null;
  trace.push(node({
    formulaId: "CBAM_INDIRECT_EMISSIONS",
    inputs: { electricityConsumed: electricity?.toString() ?? null, gridEmissionFactor: gridFactor?.toString() ?? null },
    outputValue: indirect ?? "NOT_CALCULATED",
    outputUnit: "tCO2e",
    warnings: indirect === null ? ["Electricity consumption and grid emission factor are required."] : [],
  }));

  let precursorDirect = new Decimal(0);
  let precursorIndirect = new Decimal(0);
  let precursorComplete = true;
  caseData.precursors.forEach((precursor, index) => {
    const directValue = decimal(precursor.directEmissions.value, `precursors.${index}.directEmissions`);
    const indirectValue = decimal(precursor.indirectEmissions.value, `precursors.${index}.indirectEmissions`);
    if (directValue === null || indirectValue === null) {
      precursorComplete = false;
      return;
    }
    if (directValue.isNegative() || indirectValue.isNegative()) throw new Error("CALCULATION_NEGATIVE_PRECURSOR_EMISSIONS");
    precursorDirect = precursorDirect.plus(directValue);
    precursorIndirect = precursorIndirect.plus(indirectValue);
  });

  const precursorTotal = precursorComplete ? precursorDirect.plus(precursorIndirect) : null;
  trace.push(node({
    formulaId: "CBAM_PRECURSOR_EMISSIONS_SUM",
    inputs: { precursorCount: caseData.precursors.length },
    outputValue: precursorTotal ?? "NOT_CALCULATED",
    outputUnit: "tCO2e",
    warnings: precursorComplete ? [] : ["One or more precursor emissions values are missing."],
  }));

  const totalDirect = direct !== null && precursorComplete ? direct.plus(precursorDirect) : null;
  const totalIndirect = indirect !== null && precursorComplete ? indirect.plus(precursorIndirect) : null;
  const totalEmbedded = totalDirect !== null && totalIndirect !== null ? totalDirect.plus(totalIndirect) : null;
  trace.push(node({
    formulaId: "CBAM_TOTAL_EMBEDDED_EMISSIONS",
    inputs: {
      installationDirectEmissions: direct?.toString() ?? null,
      electricityIndirectEmissions: indirect?.toString() ?? null,
      precursorDirectEmissions: precursorDirect.toString(),
      precursorIndirectEmissions: precursorIndirect.toString(),
    },
    outputValue: totalEmbedded ?? "NOT_CALCULATED",
    outputUnit: "tCO2e",
    warnings: totalEmbedded === null ? ["Required emissions values are incomplete."] : [],
  }));

  const shares = caseData.goods.length === 1
    ? [new Decimal(1)]
    : caseData.goods.map((good, index) => decimal(good.allocationShare?.value, `goods.${index}.allocationShare`));
  const sharesComplete = shares.length > 0 && shares.every((share) => share !== null && share.gt(0) && share.lte(1));
  const allocationShareTotal = sharesComplete
    ? (shares as Decimal[]).reduce((total, share) => total.plus(share), new Decimal(0))
    : null;
  const allocationReconciliationDelta = allocationShareTotal === null
    ? null
    : allocationShareTotal.minus(1).abs();
  const allocationReady = allocationReconciliationDelta !== null && allocationReconciliationDelta.lte(ALLOCATION_TOLERANCE);

  const goods: GoodCalculationPreview[] = [];
  if (totalEmbedded !== null && productionComplete && allocationReady) {
    productionRecords.forEach((record, index) => {
      const share = (shares as Decimal[])[index];
      const allocated = totalEmbedded.times(share);
      const specific = allocated.dividedBy(record.production!).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
      goods.push({
        goodIndex: index + 1,
        cnCode: String(record.good.cnCode.value || ""),
        sector: record.good.sector,
        allocationShare: share.toString(),
        productionVolume: record.production!.toString(),
        allocatedEmbeddedEmissions: allocated.toString(),
        specificEmbeddedEmissions: specific.toString(),
      });
      trace.push(node({
        formulaId: `CBAM_GOOD_EMISSIONS_ALLOCATION_${index + 1}`,
        inputs: {
          totalEmbeddedEmissions: totalEmbedded.toString(),
          allocationShare: share.toString(),
          productionVolume: record.production!.toString(),
        },
        outputValue: specific,
        outputUnit: "tCO2e/t",
        roundingApplied: { decimalPlaces: 6, mode: "ROUND_HALF_UP", stage: "per-good specific embedded emissions" },
      }));
    });
  }

  const aggregateSpecific = totalEmbedded !== null && production !== null
    ? totalEmbedded.dividedBy(production).toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
    : null;

  return {
    trace,
    goods,
    totalDirectEmissions: totalDirect?.toString() ?? "NOT_CALCULATED",
    totalIndirectEmissions: totalIndirect?.toString() ?? "NOT_CALCULATED",
    totalPrecursorEmissions: precursorTotal?.toString() ?? "NOT_CALCULATED",
    totalEmbeddedEmissions: totalEmbedded?.toString() ?? "NOT_CALCULATED",
    productionVolume: production?.toString() ?? "NOT_CALCULATED",
    specificEmbeddedEmissions: aggregateSpecific?.toString() ?? "NOT_CALCULATED",
    allocationShareTotal: allocationShareTotal?.toString() ?? "NOT_CALCULATED",
    allocationReconciliationDelta: allocationReconciliationDelta?.toString() ?? "NOT_CALCULATED",
  };
}
