import { describe, expect, it } from "vitest";
import { assertValuationMethodologyRange } from "../../scripts/seo/valuation";

describe("INV-19.1 valuation methodology range", () => {
  it("rejects a point/single-valued valuation multiple range", () => {
    expect(() => assertValuationMethodologyRange(3, 3)).toThrow(/INV-19\.1/);
  });

  it("rejects inverted ranges", () => {
    expect(() => assertValuationMethodologyRange(4, 2)).toThrow(/INV-19\.1/);
  });
});
