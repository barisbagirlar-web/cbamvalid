import { describe, expect, it } from "vitest";
import { calculateFreeAllocationAdjustment } from "@/lib/cbam/registry/free-allocation";

describe("CBAM free allocation adjustment", () => {
  it("calculates 2026 actual-data FAA using official benchmark, CBAM factor and CSCF", () => {
    const result = calculateFreeAllocationAdjustment({
      cnCode: "72085120",
      year: 2026,
      massTonnes: 1000,
      dataBasis: "ACTUAL",
    });
    expect(result).toMatchObject({
      status: "CALCULATED",
      benchmarkValue: 0.044,
      cbamFactor: 0.975,
      cscf: 1,
      specificEmbeddedFreeAllocationTco2ePerT: 0.0429,
      freeAllocationAdjustmentTco2e: 42.9,
    });
  });

  it("requires a production route when default benchmark is ambiguous", () => {
    expect(
      calculateFreeAllocationAdjustment({
        cnCode: "72085120",
        year: 2026,
        massTonnes: 1000,
        dataBasis: "DEFAULT",
      }).status,
    ).toBe("BENCHMARK_AMBIGUOUS");
  });

  it("uses the selected route for default values", () => {
    const result = calculateFreeAllocationAdjustment({
      cnCode: "72085120",
      year: 2026,
      massTonnes: 1000,
      dataBasis: "DEFAULT",
      routeIndicator: "D",
    });
    expect(result).toMatchObject({
      status: "CALCULATED",
      benchmarkValue: 0.481,
      freeAllocationAdjustmentTco2e: 468.975,
    });
  });

  it("sets electricity free allocation adjustment to zero", () => {
    expect(
      calculateFreeAllocationAdjustment({
        cnCode: "27160000",
        year: 2026,
        massTonnes: 500,
        dataBasis: "DEFAULT",
      }),
    ).toMatchObject({ status: "CALCULATED", freeAllocationAdjustmentTco2e: 0 });
  });
});
