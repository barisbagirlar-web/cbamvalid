import { describe, expect, it } from "vitest";
import { energyTimesFactor, mwh, tco2ePerMWh, formatCoverage, Decimal } from "../../src/dossier/00-schema/units";
import { getSectorRule } from "../../src/dossier/01-ruleset/sectors.rules";
import { computePricedSeeFromStrings } from "../../src/dossier/20-kernel/allocation";

describe("WP-00 branded units", () => {
  it("computes 100 MWh × 0.4 tCO2e/MWh = 40 exactly at 28 dp", () => {
    const result = energyTimesFactor(mwh("100"), tco2ePerMWh("0.4"));
    expect(result.toFixed(28)).toBe(new Decimal("40").toFixed(28));
    expect(result.toString()).toBe("40");
  });

  it("renders coverage with basis label", () => {
    expect(
      formatCoverage({
        numerator: new Decimal(365),
        denominator: new Decimal(365),
        basis: "DAYS",
      })
    ).toBe("365 / 365 days");
    expect(
      formatCoverage({
        numerator: new Decimal(1),
        denominator: new Decimal(1),
        basis: "BOOLEAN",
      })
    ).toBe("1 / 1 boolean");
  });
});

describe("WP-02 steel Annex II — BLOCKER regression", () => {
  it("steel-annexII: SEE_priced === 0.80, SEE_indirect === 0.40, exclusion ANNEX_II_DIRECT_ONLY", () => {
    const rule = getSectorRule("IRON_AND_STEEL");
    expect(rule.annexII).toBe(true);
    expect(rule.indirectPriced).toBe(false);

    // Installation: direct 80, indirect 40, production 100, single good 100%
    const aggregate = computePricedSeeFromStrings({
      totalDirect: "80",
      totalIndirect: "40",
      allocationShare: "1",
      productionTonnes: "100",
      rule,
    });
    expect(aggregate.seePriced).toBe("0.8");
    expect(aggregate.seeDirect).toBe("0.8");
    expect(aggregate.seeIndirect).toBe("0.4");
    expect(aggregate.indirectExclusionReason?.code).toBe("ANNEX_II_DIRECT_ONLY");

    // S0176 two-good split 0.6/0.4
    const g1 = computePricedSeeFromStrings({
      totalDirect: "80",
      totalIndirect: "40",
      allocationShare: "0.6",
      productionTonnes: "60",
      rule,
    });
    const g2 = computePricedSeeFromStrings({
      totalDirect: "80",
      totalIndirect: "40",
      allocationShare: "0.4",
      productionTonnes: "40",
      rule,
    });
    expect(g1.seePriced).toBe("0.8");
    expect(g2.seePriced).toBe("0.8");
    expect(g1.attributedPriced).toBe("48");
    expect(g2.attributedPriced).toBe("32");
  });

  it("cement-annexI: same numbers → SEE_priced === 1.20", () => {
    const rule = getSectorRule("CEMENT");
    expect(rule.annexII).toBe(false);
    expect(rule.indirectPriced).toBe(true);
    const result = computePricedSeeFromStrings({
      totalDirect: "80",
      totalIndirect: "40",
      allocationShare: "1",
      productionTonnes: "100",
      rule,
    });
    expect(result.seePriced).toBe("1.2");
    expect(result.indirectExclusionReason).toBeNull();
  });
});
