import { describe, expect, it } from "vitest";
import { evaluateCnIndexability } from "@/lib/seo/indexability";
import { listSitemapRoutes, SEO_ROUTE_REGISTRY } from "@/lib/seo/registry";
import { generateProductOfferSchema } from "@/lib/seo/schema";
import { PRICE_CLAIM } from "@/lib/seo/claims";
import { resolveCanonicalPath } from "@/lib/seo/canonical";
import { SEO_REGULATORY_FACTS } from "@/lib/seo/regulatory-sources";

describe("SEO mandate negative tests", () => {
  it("Case A: unknown CN in valid chapter is not indexable and not in sitemap", () => {
    const result = evaluateCnIndexability("72019999");
    expect(result.indexable).toBe(false);
    expect(listSitemapRoutes().some((route) => route.path === "/cn-code/72019999")).toBe(false);
  });

  it("Case B: known stage-1 CN is indexable only with content/regulatory data", () => {
    const result = evaluateCnIndexability("72011011");
    expect(result.indexable).toBe(true);
    expect(result.entry?.description.length).toBeGreaterThan(10);
    expect(result.entry?.requiredProducerData.length).toBeGreaterThan(0);
  });

  it("Case C/D: schema price matches commerce SSOT and emits no reviews", () => {
    const schema = JSON.stringify(generateProductOfferSchema());
    expect(schema).toContain(`"price":"${PRICE_CLAIM.value.amount}"`);
    expect(schema).toContain(`"priceCurrency":"${PRICE_CLAIM.value.currency}"`);
    expect(schema).not.toContain("AggregateRating");
    expect(schema).not.toContain("Demir Metal");
    expect(schema).not.toContain("150.00");
  });

  it("Case E: noindex routes never appear in sitemap", () => {
    for (const route of SEO_ROUTE_REGISTRY) {
      if (route.indexability === "noindex") {
        expect(listSitemapRoutes().some((item) => item.path === route.path)).toBe(false);
      }
    }
  });

  it("Case F: every indexable route has canonicalPath", () => {
    for (const route of SEO_ROUTE_REGISTRY.filter((item) => item.indexability === "index")) {
      expect(route.canonicalPath).toBe(route.path);
    }
  });

  it("Case G helpers: UTM query does not change canonical identity", () => {
    expect(resolveCanonicalPath("/pricing?utm_source=newsletter")).toBe("/pricing");
    expect(resolveCanonicalPath("/product?fbclid=abc")).toBe("/product");
  });

  it("Case H: private prefixes absent from sitemap", () => {
    const blocked = ["/dashboard", "/admin", "/api", "/cases", "/reports", "/account", "/credits"];
    for (const route of listSitemapRoutes()) {
      expect(blocked.some((prefix) => route.path.startsWith(prefix))).toBe(false);
    }
  });

  it("rejects transitional quarterly misinformation and keeps 30 Sep 2027 fact", () => {
    expect(SEO_REGULATORY_FACTS.FIRST_DECLARATION_DEADLINE.statement).toContain("30 September 2027");
    for (const route of SEO_ROUTE_REGISTRY) {
      expect(route.description).not.toMatch(/April 30, 2026/);
      expect(route.title).not.toMatch(/quarterly report template/i);
    }
  });
});
