import { describe, expect, it } from "vitest";
import { normalizeUnsignedDecimalInput } from "../../lib/cbam/decimal-input";

describe("unsigned decimal input normalization", () => {
  it("normalizes a decimal comma without changing scale", () => {
    expect(normalizeUnsignedDecimalInput("0,4344")).toBe("0.4344");
    expect(normalizeUnsignedDecimalInput("0.4344")).toBe("0.4344");
  });

  it("preserves blank and incomplete decimal editing states", () => {
    expect(normalizeUnsignedDecimalInput("")).toBe("");
    expect(normalizeUnsignedDecimalInput("0,")).toBe("0.");
  });

  it("rejects ambiguous or non-decimal text", () => {
    expect(normalizeUnsignedDecimalInput("0,4,3")).toBeNull();
    expect(normalizeUnsignedDecimalInput("434 kg/MWh")).toBeNull();
    expect(normalizeUnsignedDecimalInput("-0.4")).toBeNull();
  });
});
