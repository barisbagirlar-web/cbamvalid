/**
 * §23: Google Search Console API Integration
 *
 * Protocol: Connects to GSC Search Analytics API for automated
 * search performance data ingestion. Supports striking-distance
 * analysis, cannibalization detection, and content decay monitoring.
 *
 * [GOOGLE] Search Console API v1
 * [INTERNAL] Requires GSC property verification + OAuth/Service Account
 *
 * Prerequisites:
 *   1. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env
 *   2. Verify site in Google Search Console
 *   3. Service account must have read permission on the property
 *
 * Usage: npx ts-node scripts/gsc-analytics.ts --days 28
 */

interface GscQuery {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface StrikingDistanceOpportunity {
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  opportunityScore: number;
}

// ─── Mock data for offline testing (replace with real API calls) ───

const MOCK_GSC_DATA: GscQuery[] = [
  { query: "cbam regulation 2026", page: "/methodology", clicks: 45, impressions: 1200, ctr: 0.0375, position: 8.5 },
  { query: "cbam carbon price calculator", page: "/cn-codes/25231000", clicks: 32, impressions: 890, ctr: 0.0360, position: 11.2 },
  { query: "eu ets carbon price 2026", page: "/cbam-impact-2026/cement", clicks: 28, impressions: 750, ctr: 0.0373, position: 9.8 },
  { query: "cement cbam default factor", page: "/cn-codes/25231000", clicks: 20, impressions: 600, ctr: 0.0333, position: 14.5 },
  { query: "steel cbam emissions 2026", page: "/cbam-impact-2026/steel", clicks: 15, impressions: 500, ctr: 0.0300, position: 12.1 },
  { query: "aluminium cbam compliance", page: "/cbam-impact-2026/aluminium", clicks: 12, impressions: 420, ctr: 0.0286, position: 15.3 },
  { query: "cbam xsd xml export format", page: "/product", clicks: 8, impressions: 350, ctr: 0.0229, position: 18.7 },
  { query: "how to calculate cbam emissions", page: "/methodology", clicks: 55, impressions: 1800, ctr: 0.0306, position: 7.2 },
  { query: "cbam cn code 7208", page: "/cn-codes/7208", clicks: 18, impressions: 400, ctr: 0.0450, position: 6.8 },
  { query: "fertiliser cbam default value", page: "/cn-codes/31052010", clicks: 10, impressions: 320, ctr: 0.0313, position: 16.4 },
];

/**
 * Compute Opportunity Score per §24.3:
 * OpportunityScore = impressions × CTRgap × rankFeasibility × contentFit × internalLinkPotential / cannibalizationRisk
 *
 * Simplified version for offline analysis:
 * opportunityScore = impressions × (1 - ctr) / avgPosition
 */
function computeOpportunities(
  queries: GscQuery[],
  minImpressions: number = 100,
  minPosition: number = 8,
  maxPosition: number = 20,
): StrikingDistanceOpportunity[] {
  return queries
    .filter(q => q.impressions >= minImpressions && q.position >= minPosition && q.position <= maxPosition)
    .map(q => ({
      query: q.query,
      page: q.page,
      impressions: q.impressions,
      clicks: q.clicks,
      ctr: q.ctr,
      avgPosition: q.position,
      opportunityScore: (q.impressions * (1 - q.ctr)) / q.position,
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

/**
 * Detect cannibalization: same query appearing on multiple pages
 * with meaningful impressions on both.
 */
function detectCannibalization(queries: GscQuery[]): { query: string; pages: string[] }[] {
  const queryMap = new Map<string, Set<string>>();
  for (const q of queries) {
    if (!queryMap.has(q.query)) queryMap.set(q.query, new Set());
    queryMap.get(q.query)!.add(q.page);
  }

  const cannibals: { query: string; pages: string[] }[] = [];
  for (const [query, pages] of queryMap) {
    if (pages.size >= 2) {
      cannibals.push({ query, pages: [...pages] });
    }
  }
  return cannibals;
}

/**
 * Detect content decay: significant CTR decline for queries
 * that previously performed well.
 */
function detectDecay(
  current: GscQuery[],
  previous: GscQuery[],
  minClicks: number = 10,
  decayThreshold: number = 0.20,
): { query: string; page: string; ctrDeclinePct: number }[] {
  const prevMap = new Map<string, number>();
  for (const q of previous) {
    prevMap.set(q.query + "|" + q.page, q.ctr);
  }

  const decaying: { query: string; page: string; ctrDeclinePct: number }[] = [];
  for (const q of current) {
    const key = q.query + "|" + q.page;
    const prevCtr = prevMap.get(key);
    if (prevCtr && q.clicks >= minClicks && prevCtr > 0) {
      const decline = (prevCtr - q.ctr) / prevCtr;
      if (decline > decayThreshold) {
        decaying.push({ query: q.query, page: q.page, ctrDeclinePct: Math.round(decline * 100) });
      }
    }
  }
  return decaying.sort((a, b) => b.ctrDeclinePct - a.ctrDeclinePct);
}

// ─── MAIN ───

console.log("[GSC-ANALYTICS] ========================================");
console.log("[GSC-ANALYTICS] §23: Google Search Console Analytics");
console.log("[GSC-ANALYTICS] ========================================\n");

// Note: In production, use googleapis SDK:
// import { google } from 'googleapis';
// const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
// const searchconsole = google.searchconsole('v1');
// const res = await searchconsole.searchanalytics.query({ siteUrl, requestBody });
console.log("[GSC-ANALYTICS] ℹ️ Offline mode: using mock data for demonstration.");
console.log("[GSC-ANALYTICS] ℹ️ Production: set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY in .env.");
console.log("[GSC-ANALYTICS] ℹ️ Site URL must be verified in GSC and service account added as owner.\n");

// 1. Striking-distance opportunities
console.log("[GSC-ANALYTICS] ─── Striking-Distance Opportunities (positions 8-20, impressions>100) ───");
const opportunities = computeOpportunities(MOCK_GSC_DATA);
console.log("  Query".padEnd(45) + "Page".padEnd(35) + "Impr".padEnd(8) + "Clicks".padEnd(8) + "Pos".padEnd(6) + "Score");
console.log("  " + "─".repeat(45 + 35 + 8 + 8 + 6 + 10));
for (const o of opportunities) {
  console.log(
    `  ${o.query.padEnd(43)} ${o.page.padEnd(33)} ${String(o.impressions).padEnd(6)} ${String(o.clicks).padEnd(6)} ${o.avgPosition.toFixed(1).padEnd(4)} ${Math.round(o.opportunityScore)}`,
  );
}

// 2. Cannibalization detection
console.log("\n[GSC-ANALYTICS] ─── Cannibalization Detection ───");
const cannibals = detectCannibalization(MOCK_GSC_DATA);
if (cannibals.length > 0) {
  for (const c of cannibals) {
    console.log(`  ⚠️ Query "${c.query}" appears on ${c.pages.length} pages:`);
    c.pages.forEach(p => console.log(`     → ${p}`));
  }
  console.log("  Fix: Consolidate content on one canonical URL, redirect/merge others.");
} else {
  console.log("  ✅ No cannibalization detected.");
}

// 3. Content decay detection
console.log("\n[GSC-ANALYTICS] ─── Content Decay Detection (CTR decline >20%) ───");
// Use slightly different mock data for "previous" period
const PREVIOUS_DATA: GscQuery[] = MOCK_GSC_DATA.map(q => ({
  ...q,
  ctr: Math.min(q.ctr * 1.3, 0.65), // Simulate higher CTR in previous period
}));
const decay = detectDecay(MOCK_GSC_DATA, PREVIOUS_DATA);
if (decay.length > 0) {
  for (const d of decay.slice(0, 10)) {
    console.log(`  ⚠️ ${d.ctrDeclinePct}% CTR decline: "${d.query}" → ${d.page}`);
  }
  console.log("  Fix: Update content freshness, improve title/meta, add new data/citations.");
} else {
  console.log("  ✅ No significant CTR decline detected.");
}

// 4. Summary
console.log("\n[GSC-ANALYTICS] ========================================");
console.log(`[GSC-ANALYTICS] Striking-distance: ${opportunities.length} opportunities`);
console.log(`[GSC-ANALYTICS] Cannibalization: ${cannibals.length} queries affected`);
console.log(`[GSC-ANALYTICS] Content decay: ${decay.length} queries declining`);
console.log("[GSC-ANALYTICS] ========================================\n");
console.log("[GSC-ANALYTICS] Next steps:");
console.log("[GSC-ANALYTICS]  1. Review striking-distance opportunities → update title/meta for top 5");
console.log("[GSC-ANALYTICS]  2. Fix cannibalization → consolidate pages or differentiate intent");
console.log("[GSC-ANALYTICS]  3. Refresh decaying content → add 2026 data + EUR-Lex citations");
console.log("[GSC-ANALYTICS]  4. Integrate with BigQuery Bulk Export for continuous monitoring");
console.log("[GSC-ANALYTICS] ========================================");

export {
  computeOpportunities,
  detectCannibalization,
  detectDecay,
};
export type {
  StrikingDistanceOpportunity,
  GscQuery,
};
