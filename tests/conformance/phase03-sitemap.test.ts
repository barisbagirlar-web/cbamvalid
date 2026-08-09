import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRobotsPolicy, PRIVATE_ROBOTS_DISALLOW, PUBLIC_CRAWLER_USER_AGENTS } from "../../app/robots";
import { buildSitemapEntries } from "../../app/sitemap";
import { SEO_ROUTE_REGISTRY } from "../../lib/seo/registry";
import { runSitemapAudit } from "../../scripts/seo/sitemap-audit-v6";
import { renderRobotsTxt, validateStaticRobotsParity } from "../../scripts/seo/sitemap-robots-sync-v6";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA";
  negativeTestPassed?: boolean;
};

describe("SEO V6 Phase 03 sitemap/robots/index-state", () => {
  it("passes the actual sitemap, robots, lastmod and parameter contract", () => {
    const result = runSitemapAudit();
    expect(result.blocks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.stats.sitemapUrlCount).toBe(result.stats.indexableRegistryCount);
    expect(result.stats.parameterDecisionCount).toBe(9);
    expect(result.stats.namedRobotGroupCount).toBe(PUBLIC_CRAWLER_USER_AGENTS.length);
  });

  it("keeps static robots byte-identical to the runtime SSOT", () => {
    const actual = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
    expect(validateStaticRobotsParity(actual, renderRobotsTxt())).toEqual([]);
  });

  it("applies every private disallow to every configured crawler group", () => {
    const policy = buildRobotsPolicy();
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    expect(rules).toHaveLength(PUBLIC_CRAWLER_USER_AGENTS.length);
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow].filter(Boolean);
      expect(disallow).toEqual([...PRIVATE_ROBOTS_DISALLOW]);
    }
  });

  it("produces sorted query-free sitemap URLs and excludes noindex routes", () => {
    const entries = buildSitemapEntries();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toEqual([...urls].sort((left, right) => new URL(left).pathname.localeCompare(new URL(right).pathname)));
    expect(urls.every((url) => !url.includes("?"))).toBe(true);
    const noindexPaths = new Set(SEO_ROUTE_REGISTRY.filter((route) => route.indexability === "noindex").map((route) => route.canonicalPath));
    expect(urls.every((url) => !noindexPaths.has(new URL(url).pathname))).toBe(true);
  });

  it("requires C-02 negativeTestPassed=true for every Phase-03 BLOCK result", () => {
    const artifact = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/seo/invariant-results/faz-03.json"), "utf8"),
    ) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((row) => row.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });
});
