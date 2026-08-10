import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRelatedCnEntries } from "../../lib/seo/cn-related-links";
import { listIndexablePublicCnEntries } from "../../lib/seo/cn-public-registry";
import { computePageRank, evaluateLinkGraph } from "../../scripts/seo/link-equity";

type Config = { thresholds: { orphanPageWarnPct: number; anchorConcentrationWarnPct: number } };
const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as Config;

describe("SEO V6 Phase 07 link economy", () => {
  it("gives every public CN detail at least two distinct sibling inbound sources", () => {
    const entries = listIndexablePublicCnEntries();
    const inbound = new Map(entries.map((entry) => [entry.cnCode, new Set<string>()]));
    for (const source of entries) {
      for (const target of getRelatedCnEntries(source.cnCode)) {
        inbound.get(target.cnCode)?.add(source.cnCode);
      }
    }
    for (const entry of entries) {
      expect(inbound.get(entry.cnCode)?.size ?? 0, entry.cnCode).toBeGreaterThanOrEqual(2);
    }
  });

  it("WARNs on an artificial orphan using the configured orphan threshold", () => {
    const result = evaluateLinkGraph({
      siteId: "fixture",
      baseUrl: "https://example.test",
      paths: ["/a", "/b", "/c"],
      edges: [
        { source: "/a", target: "/b", anchor: "b" },
        { source: "/b", target: "/a", anchor: "a" },
      ],
      thresholds: config.thresholds,
      measuredAt: "2026-08-10T00:00:00Z",
    });
    expect(result.orphanRoutes).toContain("/c");
    expect(result.warnings.some((warning) => warning.includes("INV-7.1"))).toBe(true);
  });

  it("WARNs when one anchor dominates a target beyond the configured threshold", () => {
    const result = evaluateLinkGraph({
      siteId: "fixture",
      baseUrl: "https://example.test",
      paths: ["/a", "/b", "/c", "/d"],
      edges: [
        { source: "/a", target: "/d", anchor: "same anchor" },
        { source: "/b", target: "/d", anchor: "same anchor" },
        { source: "/c", target: "/d", anchor: "different anchor" },
      ],
      thresholds: config.thresholds,
      measuredAt: "2026-08-10T00:00:00Z",
    });
    expect(result.anchorWarnings.some((warning) => warning.target === "/d")).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("INV-7.3"))).toBe(true);
  });

  it("computes deterministic normalized PageRank for the same graph", () => {
    const paths = ["/a", "/b", "/c"];
    const edges = [
      { source: "/a", target: "/b" },
      { source: "/b", target: "/c" },
      { source: "/c", target: "/a" },
    ];
    const first = computePageRank(paths, edges);
    const second = computePageRank(paths, edges);
    expect([...first.entries()]).toEqual([...second.entries()]);
    const sum = [...first.values()].reduce((total, value) => total + value, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
