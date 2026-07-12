import assert from "node:assert/strict";
import fc from "fast-check";
import { executeDeterministicCalculation } from "../lib/cbam/calculation/calculation-engine.ts";

const round4 = (value) => Number(value.toFixed(4));
const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;

function calculate(overrides = {}) {
  return executeDeterministicCalculation({
    role: "IMPORTER",
    importYear: 2026,
    importQuarter: 1,
    cnCode: "72010000",
    productionVolume: 100,
    installationName: "Property Test Installation",
    hasActualData: true,
    isVerified: false,
    directEmissionsInput: 0,
    electricityConsumedInput: 0,
    gridEmissionFactorInput: 0.45,
    isComplexGood: false,
    precursorDirectEmissionsInput: 0,
    precursorIndirectEmissionsInput: 0,
    carbonPricePaidInput: 0,
    ...overrides,
  });
}

const volumeArb = fc.double({ min: 100, max: 10_000, noNaN: true, noDefaultInfinity: true });
const emissionsArb = fc.double({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true });
const electricityArb = fc.double({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true });
const factorArb = fc.double({ min: 0.0001, max: 10, noNaN: true, noDefaultInfinity: true });
const precursorArb = fc.double({ min: 0, max: 1_000, noNaN: true, noDefaultInfinity: true });

fc.assert(
  fc.property(
    volumeArb,
    emissionsArb,
    electricityArb,
    factorArb,
    precursorArb,
    precursorArb,
    (productionVolume, direct, electricity, factor, precursorDirect, precursorIndirect) => {
      const input = {
        productionVolume,
        directEmissionsInput: direct,
        electricityConsumedInput: electricity,
        gridEmissionFactorInput: factor,
        isComplexGood: true,
        precursorDirectEmissionsInput: precursorDirect,
        precursorIndirectEmissionsInput: precursorIndirect,
      };

      const first = calculate(input);
      const second = calculate(input);

      assert.deepEqual(first, second, "Same input and ruleset must be deterministic");
      assert.notEqual(first.status, "CALCULATION_BLOCKED", "Valid in-scope inputs must calculate");

      const numericOutputs = [
        first.totalEmbeddedEmissions,
        first.specificEmbeddedEmissions,
        first.freeAllocationAdjustment,
        first.embeddedEmissionsTco2e,
        first.carbonPricePaidCurrency,
        first.carbonPricePaidPerTco2e,
        first.eligibleCertificateReduction,
        first.certificatesBeforeReduction,
        first.certificatesAfterReduction,
        first.netCertificatesDue,
        first.estimatedCertificateCostEur,
        first.dataCompletenessScore,
      ];

      assert.ok(numericOutputs.every(finiteNonNegative), "Outputs must be finite and non-negative");

      const unroundedTotal = direct + electricity * factor + precursorDirect + precursorIndirect;
      const expectedTotal = round4(unroundedTotal);
      const expectedSpecific = round4(unroundedTotal / productionVolume);

      assert.equal(first.totalEmbeddedEmissions, expectedTotal, "Total emissions must reconcile");
      assert.equal(first.specificEmbeddedEmissions, expectedSpecific, "Specific emissions must reconcile");
      assert.ok(
        first.certificatesAfterReduction <= first.certificatesBeforeReduction,
        "Relief cannot increase certificates due",
      );
    },
  ),
  {
    numRuns: 500,
    seed: 20260713,
    endOnFailure: true,
    verbose: true,
  },
);

const zeroProduction = calculate({ productionVolume: 0 });
assert.equal(zeroProduction.status, "CALCULATION_BLOCKED", "Zero production must block calculation");

const outOfScope = calculate({ cnCode: "95030000", productionVolume: 100 });
assert.equal(outOfScope.status, "CALCULATION_BLOCKED", "Out-of-scope goods must be blocked");

console.log("CALCULATION_PROPERTY_INVARIANTS=PASS");
