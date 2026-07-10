import { describe, it, expect } from "vitest";
import { getSectorConfig, CbamSector } from "../../lib/cbam/sectors/sector-adapter";

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
