import { describe, it, expect } from "vitest";
import { assertCalculationNodeIntegrity } from "../../functions/src/cbam/calculator";
import { nodeId } from "../../functions/src/dossier/00-schema/ids";
import { Decimal } from "decimal.js";
import type { CalculationTraceNode } from "../../functions/src/cbam/schema";

function node(overrides: Partial<CalculationTraceNode> = {}): CalculationTraceNode {
  return {
    calculationId: "calc_abc123",
    formulaId: "CBAM_TEST_FORMULA",
    formulaVersion: "EU-CBAM-DEFINITIVE-2026",
    officialSource: "Regulation (EU) 2023/956, Annex IV",
    sourceVersion: "definitive period",
    effectiveDate: "2026-01-01",
    inputs: { calcNodeId: nodeId("TEST", "NODE") },
    conversions: undefined,
    intermediateCalculations: undefined,
    roundingApplied: undefined,
    assumptions: [],
    warnings: [],
    outputValue: "10",
    outputUnit: "tCO2e",
    calculationHash: "abc123def456abc123def456abc123def456abc123def456abc123def456ab12",
    ...overrides,
  };
}

const totals = {
  totalPriced: new Decimal("10"),
  totalDisclosed: new Decimal("10"),
  totalDirect: new Decimal("10"),
  totalIndirect: new Decimal("0"),
};

describe("FAZ 4 — Calculation node integrity guards", () => {
  it("passes a well-formed trace with valid node references", () => {
    expect(() => assertCalculationNodeIntegrity([node()], totals)).not.toThrow();
  });

  it("blocks a node missing its calculationId", () => {
    const bad = node({ calculationId: "" });
    expect(() => assertCalculationNodeIntegrity([bad], totals)).toThrow("CALCULATION_NODE_ID_MISSING");
  });

  it("blocks a node missing its output unit", () => {
    const bad = node({ outputUnit: "" });
    expect(() => assertCalculationNodeIntegrity([bad], totals)).toThrow("CALCULATION_UNIT_MISSING");
  });

  it("blocks a non-finite output value", () => {
    const bad = node({ outputValue: "NaN" });
    expect(() => assertCalculationNodeIntegrity([bad], totals)).toThrow("CALCULATION_NON_FINITE_OUTPUT");
  });

  it("blocks a bare CBAM_GOOD_ formula id without good index", () => {
    const bad = node({ formulaId: "CBAM_GOOD_" });
    expect(() => assertCalculationNodeIntegrity([bad], totals)).toThrow("CALCULATION_GENERIC_GOOD_NODE_FORBIDDEN");
  });

  it("blocks a node with a missing graph node reference", () => {
    const bad = node({ inputs: {} });
    expect(() => assertCalculationNodeIntegrity([bad], totals)).toThrow("CALCULATION_GRAPH_NODE_REFERENCE_MISSING");
  });

  it("blocks duplicate node ids across the trace", () => {
    const first = node();
    const duplicate = node({ calculationId: "calc_second" });
    expect(() => assertCalculationNodeIntegrity([first, duplicate], totals)).toThrow("CALCULATION_DUPLICATE_NODE_ID");
  });

  it("blocks a negative total", () => {
    const negativeTotals = { ...totals, totalPriced: new Decimal("-5") };
    expect(() => assertCalculationNodeIntegrity([node()], negativeTotals)).toThrow("CALCULATION_NEGATIVE_TOTAL");
  });

  it("allows distinct good node ids in a multi-good trace", () => {
    const good1 = node({
      calculationId: "calc_good1",
      inputs: { calcNodeId: nodeId("GOOD", "1", "SEE_PRICED") },
    });
    const good2 = node({
      calculationId: "calc_good2",
      inputs: { calcNodeId: nodeId("GOOD", "2", "SEE_PRICED") },
    });
    expect(() => assertCalculationNodeIntegrity([good1, good2], totals)).not.toThrow();
  });
});
