import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateCrawlEconomy } from "../../scripts/seo/crawl-economy";
import { cidrContains, extractManifestCidrs } from "../../scripts/seo/bot-identity";

type Config = {
  thresholds: { crawlWasteWarnPct: number };
  policy: { blockedSections: string[] };
};
const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as Config;

describe("SEO V6 Phase 08 crawl economy", () => {
  it("SKIPs rather than inventing crawl waste when request logs are absent", () => {
    const result = evaluateCrawlEconomy(config, []);
    expect(result.status).toBe("SKIP_NO_DATA");
    expect(result.wastePct).toBeNull();
    expect(result.partial).toBe(true);
  });

  it("WARNs when measured crawler waste exceeds the configured threshold", () => {
    const rows = [
      { timestamp: "2026-08-10T00:00:00Z", path: "/dashboard/private", status: 403, userAgent: "Googlebot/2.1" },
      { timestamp: "2026-08-10T00:01:00Z", path: "/missing", status: 404, userAgent: "OAI-SearchBot/1.0" },
      { timestamp: "2026-08-10T00:02:00Z", path: "/methodology", status: 200, userAgent: "PerplexityBot/1.0" },
    ];
    const result = evaluateCrawlEconomy(config, rows);
    expect(result.status).toBe("WARN");
    expect(result.wastePct).toBeGreaterThan(config.thresholds.crawlWasteWarnPct);
    expect(result.wasteReasons["private-or-blocked-section"]).toBeGreaterThan(0);
    expect(result.wasteReasons["http-error"]).toBeGreaterThan(0);
  });

  it("parses provider manifests and matches IPv4 and IPv6 CIDRs deterministically", () => {
    const manifest = {
      prefixes: [
        { ipv4Prefix: "192.0.2.0/24" },
        { ipv6Prefix: "2001:db8::/32" },
      ],
    };
    expect(extractManifestCidrs(manifest)).toEqual(["192.0.2.0/24", "2001:db8::/32"]);
    expect(cidrContains("192.0.2.0/24", "192.0.2.44")).toBe(true);
    expect(cidrContains("192.0.2.0/24", "198.51.100.1")).toBe(false);
    expect(cidrContains("2001:db8::/32", "2001:db8:abcd::1")).toBe(true);
    expect(cidrContains("2001:db8::/32", "2001:db9::1")).toBe(false);
  });
});
