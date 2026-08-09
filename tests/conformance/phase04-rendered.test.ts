import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_PRICING } from "../../lib/billing/pricing-config";
import { generateSeoMetadata } from "../../lib/seo/build-metadata";
import { SEO_ROUTE_REGISTRY } from "../../lib/seo/registry";
import {
  PHASE4_CRITICAL_PATHS,
  discoverFailClosedNoindexUtilityRoutes,
  discoverStaticPublicRouteRecords,
  validateCurrentPriceHtml,
  validatePublicStaticRegistryCoverage,
} from "../../scripts/seo/crawl-rendered";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA";
  negativeTestPassed?: boolean;
};

const ROOT = resolve(process.cwd());

describe("SEO V6 Phase 04 rendered/commercial contract", () => {
  it("governs every static public route as registry identity or fail-closed noindex utility", () => {
    const publicRecords = discoverStaticPublicRouteRecords();
    const publicRoutes = publicRecords.map((record) => record.route);
    const registryPaths = SEO_ROUTE_REGISTRY.map((route) => route.path);
    const noindexUtilities = discoverFailClosedNoindexUtilityRoutes(publicRecords, registryPaths);
    expect(validatePublicStaticRegistryCoverage(publicRoutes, registryPaths, noindexUtilities)).toEqual([]);
    for (const path of PHASE4_CRITICAL_PATHS) expect(registryPaths, path).toContain(path);
    expect(noindexUtilities).toContain("/verify/package");
  });

  it("keeps unregistered verify/package as explicit fail-closed noindex utility", () => {
    const metadata = generateSeoMetadata("/verify/package");
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    });
    expect(metadata.alternates).toBeUndefined();
    expect(SEO_ROUTE_REGISTRY.some((route) => route.path === "/verify/package")).toBe(false);
  });

  it("has the current commercial SSOT on every critical money route fixture", () => {
    const html = `<main>${CANONICAL_PRICING.currency} ${CANONICAL_PRICING.displayPrice}</main>`;
    for (const path of ["/", "/pricing", "/product", "/product-classification"]) {
      expect(validateCurrentPriceHtml(html, path), path).toEqual([]);
    }
  });

  it("forbids duplicated numeric list-price literals on commercial/SEO source surfaces", () => {
    const files = [
      "app/(public)/product/page.tsx",
      "app/(public)/pricing/page.tsx",
      "lib/seo/registry.ts",
    ];
    const hardcodedPrice = /(?:\bUSD\s+\d{2,5}\b|\$\d{2,5}\b)/;
    for (const file of files) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(source, file).not.toMatch(hardcodedPrice);
    }
  });

  it("keeps product-classification indexable with evidence-backed lastmod", () => {
    const route = SEO_ROUTE_REGISTRY.find((item) => item.path === "/product-classification");
    expect(route?.indexability).toBe("index");
    expect(route?.sitemapEligible).toBe(true);
    expect(route?.factualLastModified).toBe("2026-08-04");
  });

  it("runs Chromium hydration parity by default in the Phase-04 runtime gate", () => {
    const gate = readFileSync(resolve(ROOT, "scripts/seo/run-rendered-gate.sh"), "utf8");
    expect(gate).toContain('BROWSER_MODE="${SEO_RENDER_BROWSER:-1}"');
    expect(gate).toContain("npx playwright install --with-deps chromium");
    expect(gate).toContain('SEO_RENDER_BROWSER="$BROWSER_MODE"');
  });

  it("requires passing negative coverage for every Phase-04 BLOCK result", () => {
    const artifact = JSON.parse(
      readFileSync(resolve(ROOT, "data/seo/invariant-results/faz-04.json"), "utf8"),
    ) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((row) => row.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });
});
