import { describe, expect, it } from "vitest";
import { loadRegistryArtifact, validateRecords } from "../../scripts/seo/registry-validate-v6";

describe("INV-1.5 negative fixture", () => {
  it("blocks retired routes that remain in sitemap", () => {
    const records = structuredClone(loadRegistryArtifact().data.records);
    records[0].status = "retired";
    const result = validateRecords(records, { sitemapRoutes: [records[0].route] });
    expect(result.blocks.some((block) => block.includes("INV-1.5"))).toBe(true);
  });
});
