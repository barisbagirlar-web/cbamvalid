import { describe, expect, it } from "vitest";
import { assertNoInvariantExemptions } from "../../scripts/seo/programmatic-factory";

describe("INV-18.3 no invariant exemption", () => {
  it("rejects any programmatic invariant exemption", () => {
    expect(() => assertNoInvariantExemptions(["INV-5.2"])).toThrow(/INV-18\.3/);
  });
});
