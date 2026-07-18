/**
 * §23.4 / Ek Kod-10: Striking-Distance SQL for BigQuery
 *
 * Protocol: SQL query template for identifying high-opportunity queries
 * in Google Search Console Bulk Export data.
 *
 * [GOOGLE] GSC Bulk Export → BigQuery
 * [INTERNAL] Template — customize project/dataset/table names.
 *
 * Integration: Run via n8n SEO-W06 workflow weekly.
 */

export const STRIKING_DISTANCE_SQL = `
-- ─── SEO-W06: Striking Distance Opportunity Engine ───
-- Finds queries ranking positions 8-20 with high impressions
-- and commercial value, scoring them for optimization priority.

WITH gsc AS (
  SELECT
    query,
    page,
    SUM(impressions) AS impressions,
    SUM(clicks) AS clicks,
    AVG(position) AS avg_position
  FROM \`[PROJECT].searchconsole.searchdata_site_impression\`
  WHERE DATE(date) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY)
    AND CURRENT_DATE()
    AND clicks < impressions  -- exclude perfect CTR (branded navigational)
  GROUP BY 1, 2
),

opportunities AS (
  SELECT
    query,
    page,
    impressions,
    clicks,
    avg_position,
    SAFE_DIVIDE(clicks, impressions) AS ctr,
    -- Opportunity Score: high impressions + low CTR + striking distance
    SAFE_DIVIDE(impressions * (1 - SAFE_DIVIDE(clicks, impressions)), avg_position) AS opportunity_score
  FROM gsc
  WHERE avg_position BETWEEN 8 AND 20
    AND impressions > 100
),

ranked AS (
  SELECT
    query,
    page,
    impressions,
    clicks,
    ROUND(avg_position, 1) AS avg_position,
    ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 1) AS ctr_pct,
    ROUND(opportunity_score, 0) AS opportunity_score,
    ROW_NUMBER() OVER (PARTITION BY query ORDER BY opportunity_score DESC) AS rank_in_cluster
  FROM opportunities
)

SELECT
  query,
  page,
  impressions,
  clicks,
  avg_position,
  ctr_pct,
  opportunity_score
FROM ranked
WHERE rank_in_cluster = 1
ORDER BY opportunity_score DESC
LIMIT 100;
`;

// ─── Content Decay SQL (Ek Kod-11 extension) ───

export const CONTENT_DECAY_SQL = `
-- ─── SEO-W08: Content Decay Detector ───
-- Compares recent 28-day performance to previous 28-day period.
-- Identifies pages losing clicks, CTR, or impressions.

WITH recent AS (
  SELECT
    page,
    SUM(impressions) AS impressions,
    SUM(clicks) AS clicks,
    AVG(position) AS avg_position
  FROM \`[PROJECT].searchconsole.searchdata_site_impression\`
  WHERE DATE(date) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY)
    AND CURRENT_DATE()
  GROUP BY page
),

previous AS (
  SELECT
    page,
    SUM(impressions) AS impressions_prev,
    SUM(clicks) AS clicks_prev,
    AVG(position) AS avg_position_prev
  FROM \`[PROJECT].searchconsole.searchdata_site_impression\`
  WHERE DATE(date) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 56 DAY)
    AND DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY)
  GROUP BY page
),

decay AS (
  SELECT
    r.page,
    r.clicks,
    p.clicks_prev,
    r.impressions,
    p.impressions_prev,
    SAFE_DIVIDE(r.clicks - p.clicks_prev, p.clicks_prev) AS click_change_pct,
    SAFE_DIVIDE(r.impressions - p.impressions_prev, p.impressions_prev) AS impression_change_pct
  FROM recent r
  LEFT JOIN previous p ON r.page = p.page
  WHERE r.clicks > 10  -- minimum meaningful traffic
)

SELECT *
FROM decay
WHERE click_change_pct < -0.15  -- 15%+ click decline
ORDER BY page;
`;

// ─── Schema for search analytics tables (§23.2) ───

export const SEARCH_ANALYTICS_SCHEMA = `
-- Required BigQuery tables per §23.2

CREATE TABLE IF NOT EXISTS seo_pages (
  page_path STRING NOT NULL,
  locale STRING,
  page_role STRING,
  primary_intent STRING,
  last_modified TIMESTAMP,
  indexable BOOL,
  quality_contract_applied BOOL,
  PRIMARY KEY (page_path) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS seo_query_page_daily (
  date DATE,
  query STRING,
  page STRING,
  impressions INT64,
  clicks INT64,
  avg_position FLOAT64,
  device STRING,
  country STRING,
  search_appearance STRING
) PARTITION BY date;

CREATE TABLE IF NOT EXISTS seo_conversions_daily (
  date DATE,
  page STRING,
  source STRING,
  medium STRING,
  conversions INT64,
  revenue FLOAT64
) PARTITION BY date;

CREATE TABLE IF NOT EXISTS seo_crawl_daily (
  date DATE,
  page STRING,
  status_code INT64,
  crawl_source STRING,
  response_time_ms INT64
) PARTITION BY date;

CREATE TABLE IF NOT EXISTS seo_incidents (
  incident_id STRING,
  detected_at TIMESTAMP,
  severity STRING,
  affected_pages ARRAY<STRING>,
  description STRING,
  resolved_at TIMESTAMP,
  root_cause STRING
);

CREATE TABLE IF NOT EXISTS seo_changes (
  change_id STRING,
  applied_at TIMESTAMP,
  url_pattern STRING,
  hypothesis STRING,
  primary_metric STRING,
  cohort STRING,
  owner STRING
);

CREATE TABLE IF NOT EXISTS seo_experiments (
  experiment_id STRING,
  start_date DATE,
  end_date DATE,
  variant_id STRING,
  url_pattern STRING,
  metric_delta FLOAT64,
  significance FLOAT64,
  winner BOOL
);

CREATE TABLE IF NOT EXISTS seo_dlq (
  failure_id STRING,
  timestamp TIMESTAMP,
  workflow_id STRING,
  entity_key STRING,
  error_message STRING,
  retry_count INT64,
  permanent_failure BOOL
);
`;

export function getStrikingDistanceSQL(project: string, dataset: string): string {
  return STRIKING_DISTANCE_SQL.replace("[PROJECT]", `${project}.${dataset}`);
}
