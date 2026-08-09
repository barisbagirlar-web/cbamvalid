import { describe, expect, it } from "vitest";
import { runRegistryValidation } from "../../scripts/seo/registry/validate-v6-registry";

describe("SEO V6 Phase 1 registry", () => {
  it("covers the concrete public SEO inventory with no BLOCK violations", () => {
    const result = runRegistryValidation();
    expect(result.blocks).toEqual([]);
    expect(result.stats.recordCount).toBe(result.stats.publicStaticRouteCount);
    expect(result.stats.publicStaticGapRatePct).toBe(0);
  });

  it("keeps portfolio economics partial while production cost is unavailable", () => {
    const result = runRegistryValidation();
    expect(result.stats.productionCostGapPct).toBeGreaterThan(30);
    expect(result.warnings.some((warning) => warning.startsWith("INV-1.4"))).toBe(true);
  });

  it("has no Phase 18 template concentration in Phase 1", () => {
    const result = runRegistryValidation();
    expect(result.stats.templateConcentrationPct).toBe(0);
  });
});
