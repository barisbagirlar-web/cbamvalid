import { describe, expect, it } from "vitest";
import { buildSeoPnl, validateMinorUnitMoney } from "../../scripts/seo/seo-pnl";

describe("INV-9.1 integer minor-unit money", () => {
  it("rejects fractional monetary values", () => {
    const input = {
      currency: "USD",
      directRevenueMinor: 100.5,
      assistedRevenueMinor: 0,
      productionCostMinor: 10,
      toolingCostMinor: 0,
      conversions: 1,
      conversionValueMinor: 100,
      generativeAiClicks: 999,
    };
    expect(validateMinorUnitMoney(input)).toContain(
      "INV-9.1 directRevenueMinor must be a safe integer minor-unit amount",
    );
    expect(() => buildSeoPnl(input)).toThrow(/INV-9.1/);
  });

  it("keeps generative AI clicks outside the money formula", () => {
    const base = {
      currency: "USD",
      directRevenueMinor: 10_000,
      assistedRevenueMinor: 0,
      productionCostMinor: 2_000,
      toolingCostMinor: 500,
      conversions: 1,
      conversionValueMinor: 0,
    };
    const a = buildSeoPnl({ ...base, generativeAiClicks: 1 });
    const b = buildSeoPnl({ ...base, generativeAiClicks: 1_000_000 });
    expect(a.revenueMinor).toBe(b.revenueMinor);
    expect(a.profitMinor).toBe(b.profitMinor);
    expect(a.roiBps).toBe(b.roiBps);
  });
});
