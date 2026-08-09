import { describe, expect, it } from "vitest";
import { validateSitemapRegistryParity } from "../../scripts/seo/sitemap-audit-v6";
import type { SeoRouteContract } from "../../lib/seo/types";

const route = (path: string): SeoRouteContract => ({
  path,
  pageType: "guide",
  indexability: "index",
  title: path,
  description: path,
  h1: path,
  canonicalPath: path,
  primaryIntent: path,
  audience: [],
  sitemapEligible: true,
  schemaTypes: [],
  internalLinkTargets: [],
  regulatorySourceIds: [],
  regulatoryContentVersion: "fixture",
});

describe("INV-3.1 negative fixture", () => {
  it("blocks sitemap/registry drift", () => {
    const blocks = validateSitemapRegistryParity([route("/a"), route("/b")], [
      { url: "https://cbamvalid.com/a" },
    ]);
    expect(blocks.some((block) => block.includes("INV-3.1"))).toBe(true);
  });
});
