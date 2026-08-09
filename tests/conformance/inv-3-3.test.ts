import { describe, expect, it } from "vitest";
import { validateNoindexSitemapConflict } from "../../scripts/seo/sitemap-audit-v6";
import type { SeoRouteContract } from "../../lib/seo/types";

const noindexRoute: SeoRouteContract = {
  path: "/hidden",
  pageType: "guide",
  indexability: "noindex",
  title: "Hidden",
  description: "Hidden fixture",
  h1: "Hidden",
  canonicalPath: "/hidden",
  primaryIntent: "fixture",
  audience: [],
  sitemapEligible: false,
  schemaTypes: [],
  internalLinkTargets: [],
  regulatorySourceIds: [],
  regulatoryContentVersion: "fixture",
};

describe("INV-3.3 negative fixture", () => {
  it("blocks a noindex route that appears in the sitemap", () => {
    const blocks = validateNoindexSitemapConflict(
      [noindexRoute],
      [{ url: "https://cbamvalid.com/hidden" }],
    );
    expect(blocks.some((block) => block.includes("INV-3.3") && block.includes("/hidden"))).toBe(true);
  });
});
