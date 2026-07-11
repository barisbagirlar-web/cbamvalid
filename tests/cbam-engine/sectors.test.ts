import { describe, it, expect } from "vitest";
import { getSectorConfig, CbamSector } from "../../lib/cbam/sectors/sector-adapter";
import { resolveCNCodeScope } from "../../lib/cbam/regulatory/cn-scope-dataset";
import { determineApplicability } from "../../lib/cbam/engine/applicability-engine";

describe("Sector Adapter Configs", () => {
  it("Validates all 7 required sectors are defined", () => {
    const sectors = [
      "IRON_AND_STEEL",
      "ALUMINIUM",
      "CEMENT",
      "FERTILISERS",
      "HYDROGEN",
      "ELECTRICITY",
      "DOWNSTREAM_COMPLEX_GOODS",
    ];

    sectors.forEach((sec) => {
      const config = getSectorConfig(sec as CbamSector);
      expect(config).toBeDefined();
      expect(config.sector).toBe(sec);
      expect(config.allowedUnits.length).toBeGreaterThan(0);
      expect(config.allowedProductionRoutes.length).toBeGreaterThan(0);
    });
  });

  it("Asserts correct unit type for electricity", () => {
    const config = getSectorConfig("ELECTRICITY");
    expect(config.allowedUnits).toContain("MWh");
  });
});

describe("CN Code Scope Resolution & Classification", () => {
  it("Resolves official Annex I codes as in scope", () => {
    // Portland Cement (starts with 2523)
    const cement = resolveCNCodeScope("25231000");
    expect(cement.inScope).toBe(true);
    expect(cement.sector).toBe("CEMENT");
    expect(cement.reason).toBe("IN_SCOPE");

    // Steel (starts with 72)
    const steel = resolveCNCodeScope("72010000");
    expect(steel.inScope).toBe(true);
    expect(steel.sector).toBe("STEEL");

    // Screws and bolts (starts with 7318)
    const screws = resolveCNCodeScope("73181500");
    expect(screws.inScope).toBe(true);
    expect(screws.sector).toBe("STEEL");

    // Unwrought aluminium (starts with 7601)
    const aluminium = resolveCNCodeScope("76011000");
    expect(aluminium.inScope).toBe(true);
    expect(aluminium.sector).toBe("ALUMINIUM");

    // Hydrogen (28041000)
    const hydrogen = resolveCNCodeScope("28041000");
    expect(hydrogen.inScope).toBe(true);
    expect(hydrogen.sector).toBe("HYDROGEN");
  });

  it("Explicitly excludes 31056000 (mixed fertilisers without phosphorus/potash mix)", () => {
    const fertilizer = resolveCNCodeScope("31056000");
    expect(fertilizer.inScope).toBe(false);
    expect(fertilizer.reason).toBe("OUT_OF_SCOPE");
  });

  it("Proves generic material content alone cannot create CBAM scope", () => {
    // 7315 (steel chains) - not listed in Annex I but under chapter 73
    const chains = resolveCNCodeScope("73150000");
    expect(chains.inScope).toBe(false);
    expect(chains.reason).toBe("ADVISORY_REVIEW");

    // 84195000 (heat exchangers) - machinery under chapter 84 containing steel
    const heatExchanger = resolveCNCodeScope("84195000");
    expect(heatExchanger.inScope).toBe(false);
    expect(heatExchanger.reason).toBe("SOURCE_REQUIRED");

    // 95030000 (toys) - completely unlisted chapter
    const toys = resolveCNCodeScope("95030000");
    expect(toys.inScope).toBe(false);
    expect(toys.reason).toBe("OUT_OF_SCOPE");
  });

  it("Checks that applicability engine blocks unlisted CN codes", () => {
    const res = determineApplicability({
      cnCode: "84195000",
      totalMassTonnes: 100,
      role: "IMPORTER",
    });
    expect(res.isApplicable).toBe(false);
  });

  it("Blocks malformed, short, or non-numeric CN codes", () => {
    expect(resolveCNCodeScope("").reason).toBe("MALFORMED");
    expect(resolveCNCodeScope("123").reason).toBe("MALFORMED");
    expect(resolveCNCodeScope("1234567A").reason).toBe("MALFORMED");
  });
});
