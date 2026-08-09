import { describe, expect, it } from "vitest";
import { loadRegistryArtifact, validateRecords } from "../../scripts/seo/registry/validate-v6-registry";

describe("INV-1.2 negative fixture", () => {
  it("blocks floating-point money", () => {
    const records = structuredClone(loadRegistryArtifact().data.records);
    records[0].conversionValueMinor = 10.5;
    const result = validateRecords(records);
    expect(result.blocks.some((block) => block.includes("INV-1.2") && block.includes("conversionValueMinor"))).toBe(true);
  });
});
