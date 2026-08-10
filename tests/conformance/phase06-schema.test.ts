import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_PRICING } from "../../lib/billing/pricing-config";
import { buildSeoBreadcrumbItems } from "../../lib/seo/breadcrumbs";
import { generateSeoMetadata } from "../../lib/seo/build-metadata";
import { requireSeoRoute } from "../../lib/seo/registry";
import {
  buildPageGraph,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateProductOfferSchema,
  type JsonLdNode,
} from "../../lib/seo/schema";
import { countEntityId, validateProductSchemaClaimParity } from "../../lib/seo/schema-validation";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA";
  negativeTestPassed?: boolean;
};

const ROOT = resolve(process.cwd());
const ORG_ID = "https://cbamvalid.com/#organization";

describe("SEO V6 Phase 06 schema/entity contract", () => {
  it("keeps Product schema commercial claims on the visible verified SSOT", () => {
    const product = generateProductOfferSchema();
    expect(validateProductSchemaClaimParity(product)).toEqual([]);
    const visibleSource = readFileSync(resolve(ROOT, "app/(public)/product-classification/page.tsx"), "utf8");
    expect(visibleSource).toContain("{CANONICAL_PRICING.description}");
    expect(visibleSource).toContain("{CANONICAL_PRICING.priceFormatted}");
    expect(CANONICAL_PRICING.description).toContain("Self-service software access");
    expect(JSON.stringify(product)).not.toMatch(/prepared for independent verification|managed consulting/i);
  });

  it("binds WebPage JSON-LD copy to the same public metadata resolver", () => {
    const metadata = generateSeoMetadata("/product");
    expect(metadata.title).toBe("CBAMValid Product | Self-Service Emissions Data Software");
    expect(metadata.description).toBe(
      "Customer-controlled B2B software for emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
    );
    const jsonLdSource = readFileSync(resolve(ROOT, "components/seo/JsonLdForRoute.tsx"), "utf8");
    expect(jsonLdSource).toContain("generateSeoMetadata(path)");
    expect(jsonLdSource).toContain("name: publicTitle");
    expect(jsonLdSource).toContain("description: publicDescription");
  });

  it("deduplicates identical Organization identity at the schema layer", () => {
    const product = generateProductOfferSchema();
    const graph = product["@graph"] as JsonLdNode[];
    const document = buildPageGraph([generateOrganizationSchema(), ...graph]);
    expect(countEntityId(document, ORG_ID)).toBe(1);
  });

  it("uses one breadcrumb hierarchy for visible and JSON-LD consumers", () => {
    const route = requireSeoRoute("/cbam-default-values");
    const crumbs = buildSeoBreadcrumbItems(route);
    const schema = generateBreadcrumbSchema(crumbs);
    const elements = schema.itemListElement as Array<{ name: string; item: string }>;
    expect(elements.map((item) => item.name)).toEqual(crumbs.map((item) => item.name));
    expect(elements.map((item) => item.item)).toEqual(
      crumbs.map((item) => item.item === "/" ? "https://cbamvalid.com" : `https://cbamvalid.com${item.item}`),
    );
    const visibleSource = readFileSync(resolve(ROOT, "components/seo/SeoBreadcrumbs.tsx"), "utf8");
    const jsonLdSource = readFileSync(resolve(ROOT, "components/seo/JsonLdForRoute.tsx"), "utf8");
    expect(visibleSource).toContain("buildSeoBreadcrumbItems(route)");
    expect(jsonLdSource).toContain("buildSeoBreadcrumbItems(route)");
  });

  it("keeps FAQ schema deterministic and independent of measurement state", () => {
    const faqs = [{ question: "When am I charged?", answer: "When the working file is locked." }];
    const before = generateFAQSchema(faqs);
    process.env.SEO_FAKE_MEASUREMENT_STATE = "changed";
    const after = generateFAQSchema(faqs);
    delete process.env.SEO_FAKE_MEASUREMENT_STATE;
    expect(after).toEqual(before);
  });

  it("keeps every Phase-06 BLOCK result backed by passing negative coverage", () => {
    const artifact = JSON.parse(
      readFileSync(resolve(ROOT, "data/seo/invariant-results/faz-06.json"), "utf8"),
    ) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((row) => row.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });
});
