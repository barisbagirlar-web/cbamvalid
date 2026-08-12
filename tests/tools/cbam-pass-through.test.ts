import { describe, expect, it } from "vitest";
import { calculateCbamPassThrough } from "@/lib/tools/cbam-pass-through";

const fixture = {
  cnCode: "720851",
  tonnage: 1000,
  embeddedEmissionsTco2PerT: 2,
  euaPriceEurPerTco2: 80,
  cbamExposurePct: 10,
  carbonPricePaidEurPerTco2: 20,
  contractValueEur: 1_000_000,
  incoterm: "FOB",
};

describe("CBAM pass-through engine", () => {
  it("is replay deterministic for identical normalized input", () => {
    expect(calculateCbamPassThrough(fixture)).toEqual(calculateCbamPassThrough(fixture));
  });

  it("computes the base scenario from pinned formula inputs", () => {
    const result = calculateCbamPassThrough(fixture);
    const base = result.scenarios.find((scenario) => scenario.label === "base");
    expect(result.payableEmbeddedEmissionsTco2).toBe(200);
    expect(base).toEqual({
      label: "base",
      euaPriceEurPerTco2: 80,
      certificateCostPerTonneEur: 12,
      totalContractImpactEur: 12_000,
      marginImpactPct: 1.2,
    });
  });

  it("floors net certificate price at zero", () => {
    const result = calculateCbamPassThrough({ ...fixture, carbonPricePaidEurPerTco2: 200 });
    expect(result.scenarios.every((scenario) => scenario.totalContractImpactEur === 0)).toBe(true);
  });

  it("handles zero tonnage without NaN or Infinity", () => {
    const result = calculateCbamPassThrough({ ...fixture, tonnage: 0 });
    expect(result.scenarios.every((scenario) => scenario.certificateCostPerTonneEur === 0)).toBe(true);
  });

  it("rejects exposure above 100% and malformed identifiers", () => {
    expect(() => calculateCbamPassThrough({ ...fixture, cbamExposurePct: 101 })).toThrow();
    expect(() => calculateCbamPassThrough({ ...fixture, cnCode: "steel" })).toThrow();
    expect(() => calculateCbamPassThrough({ ...fixture, incoterm: "FOBB" })).toThrow();
  });
});
