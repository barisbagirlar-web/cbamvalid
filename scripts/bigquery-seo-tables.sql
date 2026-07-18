-- ─── §23 SEO Search Data Platform: BigQuery Table Definitions ───
-- Run these in BigQuery console to set up the SEO analytics mart.
-- [SITE-SPECIFIC] Customize project and dataset names.

-- Dataset: cbamvalid.seo_analytics

CREATE SCHEMA IF NOT EXISTS cbamvalid.seo_analytics
  OPTIONS(description="SEO Analytics Mart — §23 SSOT measurement layer");

-- §23.2 Zorunlu tablolar

-- T1: SEO Pages Registry
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_pages (
  page_path STRING NOT NULL,
  locale STRING DEFAULT 'en',
  page_role STRING,
  primary_intent STRING,
  last_modified TIMESTAMP,
  indexable BOOL DEFAULT true,
  quality_score FLOAT64,
  word_count INT64,
  schema_types ARRAY<STRING>,
  internal_links_in INT64,
  internal_links_out INT64,
  backlinks_count INT64,
  PRIMARY KEY (page_path) NOT ENFORCED
);

-- T2: Query-Page Daily Performance
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_query_page_daily (
  date DATE NOT NULL,
  query STRING NOT NULL,
  page STRING NOT NULL,
  impressions INT64,
  clicks INT64,
  avg_position FLOAT64,
  device STRING,
  country STRING,
  search_appearance STRING
) PARTITION BY date
  OPTIONS(description="GSC Bulk Export — daily query-page performance");

-- T3: Page Daily Metrics
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_url_daily (
  date DATE NOT NULL,
  page STRING NOT NULL,
  impressions INT64,
  clicks INT64,
  avg_position FLOAT64,
  ctr FLOAT64,
  distinct_queries INT64
) PARTITION BY date
  OPTIONS(description="Daily page-level search metrics");

-- T4: Conversion Attribution
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_conversions_daily (
  date DATE NOT NULL,
  page STRING NOT NULL,
  source STRING,
  medium STRING,
  campaign STRING,
  conversions INT64,
  revenue FLOAT64,
  assisted_conversions INT64
) PARTITION BY date
  OPTIONS(description="Organic conversion attribution");

-- T5: Crawl Data
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_crawl_daily (
  date DATE NOT NULL,
  page STRING NOT NULL,
  status_code INT64,
  crawl_source STRING,
  response_time_ms INT64,
  is_mobile BOOL,
  is_indexed BOOL
) PARTITION BY date
  OPTIONS(description="Googlebot crawl behavior");

-- T6: Index Sample
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_index_sample (
  inspected_at TIMESTAMP NOT NULL,
  page STRING NOT NULL,
  indexed BOOL,
  canonical_selected STRING,
  coverage_state STRING
);

-- T7: Schema Errors
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_schema_daily (
  date DATE NOT NULL,
  page STRING NOT NULL,
  error_type STRING,
  error_count INT64
) PARTITION BY date;

-- T8: Core Web Vitals
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_cwv_daily (
  date DATE NOT NULL,
  page STRING NOT NULL,
  lcp_good_pct FLOAT64,
  inp_good_pct FLOAT64,
  cls_good_pct FLOAT64,
  lcp_p75_ms FLOAT64,
  inp_p75_ms FLOAT64,
  cls_p75 FLOAT64
) PARTITION BY date;

-- T9: Incidents
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_incidents (
  incident_id STRING NOT NULL,
  detected_at TIMESTAMP,
  resolved_at TIMESTAMP,
  severity STRING,  -- P0, P1, P2, P3
  category STRING,
  affected_pages ARRAY<STRING>,
  description STRING,
  root_cause STRING,
  mitigation STRING
);

-- T10: Change Log
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_changes (
  change_id STRING NOT NULL,
  applied_at TIMESTAMP,
  url_pattern STRING,
  hypothesis STRING,
  primary_metric STRING,
  guardrail_metrics ARRAY<STRING>,
  rollback_ref STRING,
  cohort STRING,
  owner STRING,
  metric_delta FLOAT64,
  conclusion STRING
);

-- T11: Experiments
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_experiments (
  experiment_id STRING NOT NULL,
  start_date DATE,
  end_date DATE,
  variant_id STRING,
  url_pattern STRING,
  control_metric FLOAT64,
  variant_metric FLOAT64,
  delta_pct FLOAT64,
  significance FLOAT64,
  winner BOOL
);

-- T12: Alerts
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_alerts (
  alert_id STRING NOT NULL,
  created_at TIMESTAMP,
  severity STRING,
  workflow_id STRING,
  alert_type STRING,
  page STRING,
  evidence_payload JSON
);

-- T13: Dead Letter Queue
CREATE OR REPLACE TABLE cbamvalid.seo_analytics.seo_dlq (
  failure_id STRING NOT NULL,
  timestamp TIMESTAMP,
  workflow_id STRING,
  entity_key STRING,
  error_message STRING,
  retry_count INT64 DEFAULT 0,
  permanent_failure BOOL DEFAULT false,
  redacted_payload JSON
);
