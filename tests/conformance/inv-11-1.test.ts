import { describe, expect, it } from "vitest";
import { buildClusterMap, type RegistryRecord } from "../../scripts/seo/kac-prioritize";

function record(route: string, clusterId: string, ownerRoute: string): RegistryRecord {
  return {
    route,
    status: "live",
    primaryQueryClusterId: clusterId,
    primaryEntity: "fixture entity",
    searchIntent: "informational",
    ownerRoute,
    impressions28d: null,
    clicks28d: null,
    conversions28d: null,
    conversionValueMinor: null,
    productionCostMinor: null,
    portfolioDecision: null,
  };
}

describe("INV-11.1 one cluster one owner", () => {
  it("rejects two different owners for one primary cluster", () => {
    expect(() =>
      buildClusterMap([
        record("/alpha", "same-cluster", "/alpha"),
        record("/beta", "same-cluster", "/beta"),
      ]),
    ).toThrow(/INV-11\.1/);
  });
});