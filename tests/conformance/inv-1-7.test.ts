import { describe, expect, it } from "vitest";
import { assertRegistryWriterPhase } from "../../scripts/seo/registry-validate-v6";

describe("INV-1.7 negative fixture", () => {
  it("blocks registry writers outside Phase 1", () => {
    expect(assertRegistryWriterPhase("faz-02").some((block) => block.includes("INV-1.7"))).toBe(true);
    expect(assertRegistryWriterPhase("faz-01")).toEqual([]);
  });
});
