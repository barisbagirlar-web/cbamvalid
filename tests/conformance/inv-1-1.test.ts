import { describe, expect, it } from "vitest";
import { loadRegistryArtifact, validateRecords } from "../../scripts/seo/registry/validate-v6-registry";

describe("INV-1.1 negative fixture", () => {
  it("blocks duplicate pageId", () => {
    const records = structuredClone(loadRegistryArtifact().data.records);
    records[1].pageId = records[0].pageId;
    const result = validateRecords(records);
    expect(result.blocks.some((block) => block.includes("INV-1.1 duplicate pageId"))).toBe(true);
  });

  it("blocks a missing expected live route", () => {
    const records = structuredClone(loadRegistryArtifact().data.records);
    const expectedRoutes = records.map((record) => record.route);
    records.pop();
    const result = validateRecords(records, { expectedRoutes });
    expect(result.blocks.some((block) => block.includes("INV-1.1 missing live public route"))).toBe(true);
  });
});
