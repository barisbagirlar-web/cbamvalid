import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode } from "./schema";
import {
  GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH,
  GRID_EMISSION_FACTOR_SCALE_ERROR,
} from "./input-constraints";
import { getSectorRule } from "../dossier/01-ruleset/sectors.rules";
import { computePricedSeeFromStrings } from "../dossier/20-kernel/allocation";

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
  installationDirectEmissions: string;
  electricityIndirectEmissions: string;
  precursorDirectEmissions: string;
  precursorIndirectEmissions: string;
  totalDirectEmissions: string;
  totalIndirectEmissions: string;
  totalPrecursorEmissions: string;
  totalEmbeddedEmissions: string;
  productionVolume: string;
  specificEmbeddedEmissions: string;
  allocationShareTotal: string;
  allocationReconciliationDelta: string;
  /**
   * FAZ 4 — A–H emission segregation (mirrors the server-side engine):
   *   A installation direct · B precursor attributable direct · C total direct
   *   D electricity indirect · E precursor indirect · F total indirect
   *   G certificate-relevant embedded · H total informational embedded
   * For Annex II goods (iron & steel, aluminium, hydrogen) only direct
   * emissions are taken into account for certificates: G excludes indirect.
   */
  emissionsByCategory: {
    A_INSTALLATION_DIRECT: string;
    B_PRECURSOR_ATTRIBUTABLE_DIRECT: string;
    C_TOTAL_DIRECT_EMBEDDED: string;
    D_ELECTRICITY_INDIRECT: string;
    E_PRECURSOR_INDIRECT: string;
    F_TOTAL_DISCLOSED_INDIRECT: string;
    G_CERTIFICATE_RELEVANT_EMBEDDED: string;
    H_TOTAL_INFORMATIONAL_EMBEDDED: string;
  };
};

export function performDossierCalculations(caseData: AuditReadyCase): DossierCalculationPreview {
  const trace: CalculationTraceNode[] = [];
  const direct = decimal(caseData.directEmissions.value, "directEmissions");
  const electricity = decimal(caseData.electricityConsumed.value, "electricityConsumed");
  const gridFactor = decimal(caseData.gridEmissionFactor.value, "gridEmissionFactor");

  if (gridFactor?.gt(GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH)) {
    throw new Error(`CALCULATION_GRID_FACTOR_SCALE_INVALID:${GRID_EMISSION_FACTOR_SCALE_ERROR}`);
  }

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
  const totalDisclosed = totalDirect !== null && totalIndirect !== null ? totalDirect.plus(totalIndirect) : null;
  trace.push(node({
    formulaId: "CBAM_TOTAL_EMBEDDED_EMISSIONS",
    inputs: {
      installationDirectEmissions: direct?.toString() ?? null,
      electricityIndirectEmissions: indirect?.toString() ?? null,
      precursorDirectEmissions: precursorDirect.toString(),
      precursorIndirectEmissions: precursorIndirect.toString(),
    },
    outputValue: totalDisclosed ?? "NOT_CALCULATED",
    outputUnit: "tCO2e",
    warnings: totalDisclosed === null ? ["Required emissions values are incomplete."] : [],
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
  let totalPriced: Decimal | null = null;
  if (totalDirect !== null && totalIndirect !== null && productionComplete && allocationReady) {
    totalPriced = new Decimal(0);
    productionRecords.forEach((record, index) => {
      const share = (shares as Decimal[])[index];
      const rule = getSectorRule(record.good.sector);
      const priced = computePricedSeeFromStrings({
        totalDirect: totalDirect.toString(),
        totalIndirect: totalIndirect.toString(),
        allocationShare: share.toString(),
        productionTonnes: record.production!.toString(),
        rule,
      });
      totalPriced = totalPriced!.plus(priced.attributedPriced);
      goods.push({
        goodIndex: index + 1,
        cnCode: String(record.good.cnCode.value || ""),
        sector: record.good.sector,
        allocationShare: share.toString(),
        productionVolume: record.production!.toString(),
        allocatedEmbeddedEmissions: priced.attributedPriced,
        specificEmbeddedEmissions: priced.seePriced,
      });
      trace.push(node({
        formulaId: `CBAM_GOOD_EMISSIONS_ALLOCATION_${index + 1}`,
        inputs: {
          totalDirectEmissions: totalDirect.toString(),
          totalIndirectEmissions: totalIndirect.toString(),
          allocationShare: share.toString(),
          productionVolume: record.production!.toString(),
          annexII: rule.annexII,
          indirectPriced: rule.indirectPriced,
        },
        outputValue: new Decimal(priced.seePriced),
        outputUnit: "tCO2e/t",
        roundingApplied: { decimalPlaces: 6, mode: "ROUND_HALF_UP", stage: "per-good specific embedded emissions (priced)" },
      }));
    });
  }

  const aggregateSpecific = totalPriced !== null && production !== null
    ? totalPriced.dividedBy(production).toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
    : null;

  return {
    trace,
    goods,
    installationDirectEmissions: direct?.toString() ?? "NOT_CALCULATED",
    electricityIndirectEmissions: indirect?.toString() ?? "NOT_CALCULATED",
    precursorDirectEmissions: precursorComplete ? precursorDirect.toString() : "NOT_CALCULATED",
    precursorIndirectEmissions: precursorComplete ? precursorIndirect.toString() : "NOT_CALCULATED",
    totalDirectEmissions: totalDirect?.toString() ?? "NOT_CALCULATED",
    totalIndirectEmissions: totalIndirect?.toString() ?? "NOT_CALCULATED",
    totalPrecursorEmissions: precursorTotal?.toString() ?? "NOT_CALCULATED",
    totalEmbeddedEmissions: totalPriced?.toString() ?? "NOT_CALCULATED",
    productionVolume: production?.toString() ?? "NOT_CALCULATED",
    specificEmbeddedEmissions: aggregateSpecific?.toString() ?? "NOT_CALCULATED",
    allocationShareTotal: allocationShareTotal?.toString() ?? "NOT_CALCULATED",
    allocationReconciliationDelta: allocationReconciliationDelta?.toString() ?? "NOT_CALCULATED",
    emissionsByCategory: {
      A_INSTALLATION_DIRECT: direct?.toString() ?? "NOT_CALCULATED",
      B_PRECURSOR_ATTRIBUTABLE_DIRECT: precursorComplete ? precursorDirect.toString() : "NOT_CALCULATED",
      C_TOTAL_DIRECT_EMBEDDED: totalDirect?.toString() ?? "NOT_CALCULATED",
      D_ELECTRICITY_INDIRECT: indirect?.toString() ?? "NOT_CALCULATED",
      E_PRECURSOR_INDIRECT: precursorComplete ? precursorIndirect.toString() : "NOT_CALCULATED",
      F_TOTAL_DISCLOSED_INDIRECT: totalIndirect?.toString() ?? "NOT_CALCULATED",
      G_CERTIFICATE_RELEVANT_EMBEDDED: totalPriced?.toString() ?? "NOT_CALCULATED",
      H_TOTAL_INFORMATIONAL_EMBEDDED: totalDisclosed?.toString() ?? "NOT_CALCULATED",
    },
  };
}
