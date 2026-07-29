import { Decimal } from "decimal.js";

export type CarbonPricePolicyStatus = "PROVEN" | "NOT_PROVEN";

export const CALCULATION_CONTRACT = Object.freeze({
  rulesetIdentity: "EU-CBAM-DEFINITIVE-2026",
  rulesetVersion: "3.0.0",
  engineVersion: "3.0.0",
  effectiveDate: "2026-01-01",
  source:
    "Regulation (EU) 2023/956, Annex IV; active definitive-period implementing rules",
  carbonPricePolicy: Object.freeze({
    status: "NOT_PROVEN" as CarbonPricePolicyStatus,
    reason:
      "The authoritative carbon-price certificate-conversion formula and currency-conversion policy are not registered as verified rules.",
  }),
});

export const ALLOCATION_TOLERANCE = new Decimal("0.000001");
export const EMISSIONS_RECONCILIATION_TOLERANCE = new Decimal("0.000000000001");

export type ProductionMassUnit = "t" | "kg" | "metric_tonne";

export function toCanonicalTonnes(
  value: Decimal,
  unit: ProductionMassUnit
): Decimal {
  return unit === "kg" ? value.dividedBy(1000) : value;
}

export function expectedPricedAllocation(params: {
  totalDirect: Decimal;
  totalIndirect: Decimal;
  allocations: ReadonlyArray<{
    share: Decimal;
    indirectPriced: boolean;
  }>;
}): Decimal {
  return params.allocations.reduce((total, allocation) => {
    const pricedInstallationEmissions = allocation.indirectPriced
      ? params.totalDirect.plus(params.totalIndirect)
      : params.totalDirect;
    return total.plus(pricedInstallationEmissions.times(allocation.share));
  }, new Decimal(0));
}

export function allocationReconciliationDelta(params: {
  totalDirect: Decimal;
  totalIndirect: Decimal;
  allocations: ReadonlyArray<{
    share: Decimal;
    indirectPriced: boolean;
    actualAllocated: Decimal;
  }>;
}): Decimal {
  const expected = expectedPricedAllocation({
    totalDirect: params.totalDirect,
    totalIndirect: params.totalIndirect,
    allocations: params.allocations,
  });
  const actual = params.allocations.reduce(
    (total, allocation) => total.plus(allocation.actualAllocated),
    new Decimal(0)
  );
  return actual.minus(expected).abs();
}
