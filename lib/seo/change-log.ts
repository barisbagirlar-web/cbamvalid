/**
 * §24: SEO Change Log
 *
 * Protocol: Records every SEO change for experiment design,
 * regression analysis, and audit trail.
 *
 * [INTERNAL] SSOT for SEO change history
 */

export interface SeoChangeRecord {
  id: string;
  urlPattern: string;
  hypothesis: string;
  primaryMetric: string;
  guardrailMetrics: string[];
  appliedAt: string;
  rollbackRef: string;
  cohort: string;
  owner: string;
  status: "applied" | "rolled_back" | "superseded";
  result?: {
    metricDelta: number;
    significance: number;
    conclusion: string;
    decidedAt: string;
  };
}

// ─── Initial changes (populated retrospectively) ───

export const SEO_CHANGES: SeoChangeRecord[] = [
  {
    id: "SCO-001",
    urlPattern: "/*",
    hypothesis: "Explicit HTTPS redirect improves canonical signal strength vs protocol-relative",
    primaryMetric: "Indexed canonical URLs (GSC Coverage)",
    guardrailMetrics: ["HTTP 4xx rate", "Redirect chain count"],
    appliedAt: "2026-07-18",
    rollbackRef: "git revert 133c4d3",
    cohort: "global",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-002",
    urlPattern: "/cn-codes/*",
    hypothesis: "Content-based lastmod (vs build-time Date) improves crawl frequency and freshness signals",
    primaryMetric: "Sitemap URL crawl coverage (GSC)",
    guardrailMetrics: ["Indexed page count", "Crawl errors"],
    appliedAt: "2026-07-18",
    rollbackRef: "git revert 133c4d3",
    cohort: "all CN code pages",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-003",
    urlPattern: "/llms.txt, /llms-full.txt",
    hypothesis: "Enriching llms.txt >5KB increases AI model citation probability for CBAM queries",
    primaryMetric: "AI referral traffic (UTM source=llm)",
    guardrailMetrics: ["Organic CTR", "Branded search volume"],
    appliedAt: "2026-07-18",
    rollbackRef: "git revert d852629",
    cohort: "global",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-004",
    urlPattern: "/*",
    hypothesis: "Legislation-type citations in JSON-LD amplify topical authority for regulatory queries",
    primaryMetric: "Average position for regulatory compliance queries (GSC)",
    guardrailMetrics: ["Rich result eligibility", "Schema markup errors"],
    appliedAt: "2026-07-18",
    rollbackRef: "git revert 133c4d3",
    cohort: "all public pages",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-005",
    urlPattern: "/cn-codes/*, /sectors/*",
    hypothesis: "PassageIndexingFactBox with FAQPage markup increases AI Overview citation probability",
    primaryMetric: "AI Overview citations (GSC search appearance)", 
    guardrailMetrics: ["Organic CTR", "Average position"],
    appliedAt: "2026-07-18",
    rollbackRef: "remove PassageIndexingFactBox from cn-code pages",
    cohort: "all CN code and sector pages",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-006",
    urlPattern: "/*",
    hypothesis: "x-default hreflang improves international entity disambiguation",
    primaryMetric: "International organic traffic (GSC country report)",
    guardrailMetrics: ["Hreflang errors", "Crawl budget allocation"],
    appliedAt: "2026-07-18",
    rollbackRef: "remove x-default from build-metadata.ts alternates.languages",
    cohort: "global",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-007",
    urlPattern: "/cn-codes/*, /sectors/*",
    hypothesis: "Hub-Spoke TopologyLinker eliminates orphan pages and improves PageRank flow to programmatic pages",
    primaryMetric: "Orphan page count (verify-graph-connectivity.ts)",
    guardrailMetrics: ["Internal link count per page", "Indexed page count"],
    appliedAt: "2026-07-19",
    rollbackRef: "git revert 0c31119",
    cohort: "all CN code and sector pages",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
  {
    id: "SCO-008",
    urlPattern: "/reports/cbam-financial-impact-*",
    hypothesis: "Dataset schema on financial impact reports drives Google Dataset Search traffic and backlink acquisition",
    primaryMetric: "Dataset Search impressions + referral backlinks",
    guardrailMetrics: ["Organic CTR", "Bounce rate"],
    appliedAt: "2026-07-19",
    rollbackRef: "remove Dataset schema from report pages",
    cohort: "all 7 sector report pages",
    owner: "barisbagirlar@gmail.com",
    status: "applied",
  },
];
