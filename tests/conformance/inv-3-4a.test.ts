import { describe, expect, it } from "vitest";
import { validateTruthfulLastmod } from "../../scripts/seo/sitemap-audit-v6";
import type { SeoRouteContract } from "../../lib/seo/types";

const route: SeoRouteContract = {
  path: "/truthful-lastmod",
  pageType: "guide",
  indexability: "index",
  title: "Truthful lastmod",
  description: "Truthful lastmod fixture",
  h1: "Truthful lastmod",
  canonicalPath: "/truthful-lastmod",
  primaryIntent: "fixture",
  audience: [],
  sitemapEligible: true,
  schemaTypes: [],
  internalLinkTargets: [],
  regulatorySourceIds: [],
  regulatoryContentVersion: "fixture",
  factualLastModified: "2026-01-01",
};

describe("INV-3.4a negative fixture", () => {
  it("blocks lastmod that does not match the factual source date", () => {
    const blocks = validateTruthfulLastmod(
      [route],
      [{ url: "https://cbamvalid.com/truthful-lastmod", lastModified: new Date("2026-08-01T00:00:00.000Z") }],
      new Date("2026-08-09T00:00:00.000Z"),
    );
    expect(blocks.some((block) => block.includes("INV-3.4a") && block.includes("lastmod drift"))).toBe(true);
  });

  it("blocks future lastmod", () => {
    const futureRoute: SeoRouteContract = { ...route, factualLastModified: "2026-08-10" };
    const blocks = validateTruthfulLastmod(
      [futureRoute],
      [{ url: "https://cbamvalid.com/truthful-lastmod", lastModified: new Date("2026-08-10T00:00:00.000Z") }],
      new Date("2026-08-09T00:00:00.000Z"),
    );
    expect(blocks.some((block) => block.includes("INV-3.4a") && block.includes("future lastmod"))).toBe(true);
  });
});
