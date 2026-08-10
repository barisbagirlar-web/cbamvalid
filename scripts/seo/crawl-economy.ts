import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CrawlConfig = {
  thresholds: { crawlWasteWarnPct: number };
  policy: { blockedSections: string[] };
};

export type CrawlLogRow = {
  timestamp: string;
  path: string;
  status: number;
  userAgent: string;
};

export type CrawlEconomyResult = {
  status: "PASS" | "WARN" | "SKIP_NO_DATA";
  partial: boolean;
  confidence: "high" | "low";
  totalCrawlerRequests: number;
  wasteRequests: number;
  wastePct: number | null;
  thresholdPct: number;
  wasteReasons: Record<string, number>;
  reason: string;
};

const BOT_UA = /Googlebot|OAI-SearchBot|OAI-AdsBot|GPTBot|ClaudeBot|PerplexityBot|Perplexity-User/i;

function normalizePath(input: string): { pathname: string; hasQuery: boolean } {
  try {
    const url = new URL(input, "https://cbamvalid.com");
    return { pathname: url.pathname || "/", hasQuery: Boolean(url.search) };
  } catch {
    return { pathname: input.split("?")[0] || "/", hasQuery: input.includes("?") };
  }
}

function matchesBlocked(pathname: string, blocked: readonly string[]): boolean {
  return blocked.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

export function evaluateCrawlEconomy(config: CrawlConfig, rows: readonly CrawlLogRow[]): CrawlEconomyResult {
  const crawlers = rows.filter((row) => BOT_UA.test(row.userAgent));
  if (crawlers.length === 0) {
    return {
      status: "SKIP_NO_DATA",
      partial: true,
      confidence: "low",
      totalCrawlerRequests: 0,
      wasteRequests: 0,
      wastePct: null,
      thresholdPct: config.thresholds.crawlWasteWarnPct,
      wasteReasons: {},
      reason: "No crawler request-log observations were supplied; crawl waste is not inferred from robots policy alone.",
    };
  }

  const wasteReasons: Record<string, number> = {};
  let wasteRequests = 0;
  for (const row of crawlers) {
    const { pathname, hasQuery } = normalizePath(row.path);
    const reasons = new Set<string>();
    if (matchesBlocked(pathname, config.policy.blockedSections)) reasons.add("private-or-blocked-section");
    if (row.status >= 400) reasons.add("http-error");
    if (hasQuery) reasons.add("query-variant");
    if (reasons.size > 0) {
      wasteRequests += 1;
      for (const reason of reasons) wasteReasons[reason] = (wasteReasons[reason] ?? 0) + 1;
    }
  }

  const wastePct = (wasteRequests / crawlers.length) * 100;
  const status = wastePct > config.thresholds.crawlWasteWarnPct ? "WARN" : "PASS";
  return {
    status,
    partial: false,
    confidence: "high",
    totalCrawlerRequests: crawlers.length,
    wasteRequests,
    wastePct,
    thresholdPct: config.thresholds.crawlWasteWarnPct,
    wasteReasons,
    reason:
      status === "WARN"
        ? `Crawler waste ${wastePct.toFixed(2)}% exceeds configured ${config.thresholds.crawlWasteWarnPct}% threshold.`
        : `Crawler waste ${wastePct.toFixed(2)}% is within configured threshold.`,
  };
}

function main() {
  const siteIndex = process.argv.indexOf("--site");
  const site = siteIndex >= 0 ? process.argv[siteIndex + 1] : "cbamvalid";
  const logIndex = process.argv.indexOf("--log-json");
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), `sites/${site}/seo.config.json`), "utf8"),
  ) as CrawlConfig;

  if (logIndex < 0 || !process.argv[logIndex + 1]) {
    const result = evaluateCrawlEconomy(config, []);
    console.log(`SEO_CRAWL_ECONOMY_RESULT=${JSON.stringify(result)}`);
    return;
  }
  const rows = JSON.parse(
    readFileSync(resolve(process.cwd(), process.argv[logIndex + 1]), "utf8"),
  ) as CrawlLogRow[];
  const result = evaluateCrawlEconomy(config, rows);
  console.log(`SEO_CRAWL_ECONOMY_RESULT=${JSON.stringify(result)}`);
  process.exitCode = result.status === "WARN" ? 2 : 0;
}

if (process.argv[1]?.endsWith("crawl-economy.ts")) main();
