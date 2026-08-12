import { describe, expect, it } from "vitest";
import {
  CBAM_BENCHMARK_GROUP_COUNT,
  getBenchmarkVariants,
  resolveOfficialBenchmark,
} from "@/lib/cbam/registry/benchmarks-2025-2620";

describe("EU 2025/2620 benchmark registry", () => {
  it("loads the complete grouped official dataset", () => {
    expect(CBAM_BENCHMARK_GROUP_COUNT).toBe(182);
  });

  it("resolves the actual-value benchmark for hot-rolled steel", () => {
    expect(resolveOfficialBenchmark({ cnCode: "72085120", column: "ACTUAL", year: 2026 })).toMatchObject({
      status: "FOUND",
      benchmark: { value: 0.044, indicator: null },
    });
  });

  it("fails closed when a default benchmark has multiple production routes", () => {
    const result = resolveOfficialBenchmark({ cnCode: "72085120", column: "DEFAULT", year: 2026 });
    expect(result.status).toBe("AMBIGUOUS");
    if (result.status === "AMBIGUOUS") {
      expect(result.variants.map((variant) => [variant.indicator, variant.value])).toEqual([
        ["(C)", 1.37],
        ["(D)", 0.481],
        ["(E)", 0.072],
      ]);
    }
  });

  it("resolves an explicit production route without guessing", () => {
    expect(
      resolveOfficialBenchmark({ cnCode: "72085120", column: "DEFAULT", year: 2026, routeIndicator: "D" }),
    ).toMatchObject({ status: "FOUND", benchmark: { value: 0.481, indicator: "(D)" } });
  });

  it("filters year-specific variants", () => {
    const y2026 = getBenchmarkVariants({ cnCode: "72052100", column: "DEFAULT", year: 2026 });
    const y2028 = getBenchmarkVariants({ cnCode: "72052100", column: "DEFAULT", year: 2028 });
    expect(y2026.every((variant) => !variant.indicator?.includes("(2)"))).toBe(true);
    expect(y2028.every((variant) => !variant.indicator?.includes("(1)"))).toBe(true);
  });

  it("rejects non-eight-digit CN codes and unsupported years", () => {
    expect(() => resolveOfficialBenchmark({ cnCode: "7208", column: "ACTUAL", year: 2026 })).toThrow();
    expect(() => resolveOfficialBenchmark({ cnCode: "72085120", column: "ACTUAL", year: 2031 })).toThrow();
  });
});
