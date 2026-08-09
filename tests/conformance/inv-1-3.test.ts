import { describe, expect, it } from "vitest";
import { loadRegistryArtifact, validateRecords } from "../../scripts/seo/registry/validate-v6-registry";

describe("INV-1.3 negative fixture", () => {
  it("blocks cluster ownership without ownerRoute", () => {
    const records = structuredClone(loadRegistryArtifact().data.records);
    const target = records.find((record) => record.primaryQueryClusterId !== null);
    expect(target).toBeDefined();
    if (!target) return;
    target.ownerRoute = null;
    const result = validateRecords(records);
    expect(result.blocks.some((block) => block.includes("INV-1.3"))).toBe(true);
  });
});
