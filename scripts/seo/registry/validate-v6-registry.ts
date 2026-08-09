import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPublicCnCodes } from "../../../lib/seo/cn-public-registry";
import { listSitemapRoutes } from "../../../lib/seo/registry";

export type RegistryStatus = "live" | "draft" | "redirected" | "retired";
export type RegistryType = "home" | "category" | "product" | "article" | "tool" | "landing" | "legal" | "other";
export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational" | null;
export type CostConfidence = "high" | "medium" | "low" | null;
export type PortfolioDecision = "INVEST" | "HOLD" | "HARVEST" | "DIVEST" | null;
export type GrowthLoop = "content_compounding" | "tool_virality" | "ugc_loop" | "programmatic_longtail" | null;

export interface SeoPageRecord {
  pageId: string;
  siteId: string;
  route: `/${string}`;
  type: RegistryType;
  status: RegistryStatus;
  primaryQueryClusterId: string | null;
  queryClusterIds: string[];
  primaryEntity: string | null;
  searchIntent: SearchIntent;
  templateId: string | null;
  serpFeatureTargets: string[];
  canonical: string | null;
  hreflangGroup: string | null;
  internalLinksIn: number;
  internalLinksOut: number;
  impressions28d: number | null;
  clicks28d: number | null;
  conversions28d: number | null;
  conversionValueMinor: number | null;
  firstTouchValueMinor: number | null;
  ltv12ValueMinor: number | null;
  assistedValueMinor: number | null;
  aiReferralValueMinor: number | null;
  productionCostMinor: number | null;
  costConfidence: CostConfidence;
  portfolioDecision: PortfolioDecision;
  growthLoop: GrowthLoop;
  ownerRoute: `/${string}` | null;
  lastCrawledAt: string | null;
  lastSignificantChangeAt: string | null;
  decayFlag: boolean;
  redirectTarget: string | null;
  retiredAt: string | null;
  notes: string | null;
  linkableAsset: boolean;
}

type RegistryArtifact = {
  meta: {
    artifact: string;
    siteId: string;
    partial: boolean;
    confidence: "low" | "medium" | "high";
  };
  data: {
    records: SeoPageRecord[];
  };
};

export type RegistryValidation = {
  blocks: string[];
  warnings: string[];
  stats: {
    recordCount: number;
    liveRecordCount: number;
    publicStaticRouteCount: number;
    publicStaticGapRatePct: number;
    productionCostGapPct: number;
    templateConcentrationPct: number;
  };
};

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const PUBLIC_APP_ROOT = resolve(ROOT, "app/(public)");
const REGISTRY_PATH = resolve(ROOT, "data/seo/registry/cbamvalid_seo_registry.json");
const MINOR_FIELDS = [
  "conversionValueMinor",
  "firstTouchValueMinor",
  "ltv12ValueMinor",
  "assistedValueMinor",
  "aiReferralValueMinor",
  "productionCostMinor",
] as const;
const VALID_TYPES = new Set<RegistryType>(["home", "category", "product", "article", "tool", "landing", "legal", "other"]);
const VALID_STATUSES = new Set<RegistryStatus>(["live", "draft", "redirected", "retired"]);
const VALID_INTENTS = new Set<Exclude<SearchIntent, null>>(["informational", "commercial", "transactional", "navigational"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRoute(value: unknown): value is `/${string}` {
  return typeof value === "string" && value.startsWith("/");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

export function assertRegistryWriterPhase(phase: string): string[] {
  return phase === "faz-01" ? [] : [`INV-1.7 registry writer phase must be faz-01, got ${phase}`];
}

export function discoverPublicStaticRoutes(root = PUBLIC_APP_ROOT): string[] {
  const routes: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || entry.name !== "page.tsx") continue;
      const relDir = relative(root, dir).replaceAll("\\", "/");
      if (relDir.includes("[")) continue;
      routes.push(relDir === "" ? "/" : (`/${relDir}` as `/${string}`));
    }
  };
  walk(root);
  return [...new Set(routes)].sort();
}

export function expectedConcreteSeoRoutes(root = PUBLIC_APP_ROOT): string[] {
  const staticRoutes = discoverPublicStaticRoutes(root);
  const cnRoutes = listPublicCnCodes().map((code) => `/cn-code/${code}`);
  return [...new Set([...staticRoutes, ...cnRoutes])].sort();
}

export function validateRecordShape(record: unknown, index: number): string[] {
  if (!isObject(record)) return [`record[${index}] must be object`];
  const errors: string[] = [];
  if (typeof record.pageId !== "string" || !/^pg_\d{6}$/.test(record.pageId)) errors.push(`record[${index}] invalid pageId`);
  if (record.siteId !== "cbamvalid") errors.push(`record[${index}] siteId must be cbamvalid`);
  if (!isRoute(record.route)) errors.push(`record[${index}] invalid route`);
  if (typeof record.type !== "string" || !VALID_TYPES.has(record.type as RegistryType)) errors.push(`record[${index}] invalid type`);
  if (typeof record.status !== "string" || !VALID_STATUSES.has(record.status as RegistryStatus)) errors.push(`record[${index}] invalid status`);
  if (!isNullableString(record.primaryQueryClusterId)) errors.push(`record[${index}] invalid primaryQueryClusterId`);
  if (!Array.isArray(record.queryClusterIds) || !record.queryClusterIds.every((value) => typeof value === "string")) errors.push(`record[${index}] invalid queryClusterIds`);
  if (!isNullableString(record.primaryEntity)) errors.push(`record[${index}] invalid primaryEntity`);
  if (record.searchIntent !== null && (typeof record.searchIntent !== "string" || !VALID_INTENTS.has(record.searchIntent as Exclude<SearchIntent, null>))) errors.push(`record[${index}] invalid searchIntent`);
  if (!isNullableString(record.templateId)) errors.push(`record[${index}] invalid templateId`);
  if (!Array.isArray(record.serpFeatureTargets) || !record.serpFeatureTargets.every((value) => typeof value === "string")) errors.push(`record[${index}] invalid serpFeatureTargets`);
  if (!isNullableString(record.canonical)) errors.push(`record[${index}] invalid canonical`);
  if (!isNullableString(record.hreflangGroup)) errors.push(`record[${index}] invalid hreflangGroup`);
  if (!Number.isInteger(record.internalLinksIn) || (record.internalLinksIn as number) < 0) errors.push(`record[${index}] invalid internalLinksIn`);
  if (!Number.isInteger(record.internalLinksOut) || (record.internalLinksOut as number) < 0) errors.push(`record[${index}] invalid internalLinksOut`);
  for (const metric of ["impressions28d", "clicks28d", "conversions28d"] as const) {
    if (!isNullableNumber(record[metric]) || (typeof record[metric] === "number" && (!Number.isInteger(record[metric]) || record[metric] < 0))) errors.push(`record[${index}] invalid ${metric}`);
  }
  for (const field of MINOR_FIELDS) {
    const value = record[field];
    if (value !== null && (!Number.isInteger(value) || (value as number) < 0)) errors.push(`INV-1.2 record[${index}] ${field} must be integer minor units or null`);
  }
  if (record.primaryQueryClusterId !== null && !isRoute(record.ownerRoute)) errors.push(`INV-1.3 record[${index}] cluster requires ownerRoute`);
  if (record.primaryQueryClusterId === null && record.ownerRoute !== null && !isRoute(record.ownerRoute)) errors.push(`record[${index}] invalid ownerRoute`);
  if (record.growthLoop !== null) errors.push(`INV-1.8 record[${index}] growthLoop must remain null in Phase 1`);
  if (typeof record.decayFlag !== "boolean") errors.push(`record[${index}] invalid decayFlag`);
  if (!isNullableString(record.redirectTarget) || !isNullableString(record.retiredAt) || !isNullableString(record.notes)) errors.push(`record[${index}] invalid nullable string field`);
  if (typeof record.linkableAsset !== "boolean") errors.push(`record[${index}] invalid linkableAsset`);
  return errors;
}

export function validateRecords(
  records: SeoPageRecord[],
  options: { expectedRoutes?: string[]; sitemapRoutes?: string[]; phase?: string } = {},
): RegistryValidation {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const pageIds = new Set<string>();
  const routes = new Set<string>();
  const phase = options.phase ?? "faz-01";

  blocks.push(...assertRegistryWriterPhase(phase));

  records.forEach((record, index) => {
    blocks.push(...validateRecordShape(record, index));
    if (pageIds.has(record.pageId)) blocks.push(`INV-1.1 duplicate pageId ${record.pageId}`);
    pageIds.add(record.pageId);
    if (routes.has(record.route)) blocks.push(`INV-1.1 duplicate route ${record.route}`);
    routes.add(record.route);
  });

  const sorted = [...records].sort((left, right) => left.route.localeCompare(right.route)).map((record) => record.route);
  const actualOrder = records.map((record) => record.route);
  if (JSON.stringify(sorted) !== JSON.stringify(actualOrder)) blocks.push("AIP-06 registry records must be route-sorted");

  const expectedRoutes = options.expectedRoutes ?? [];
  for (const route of expectedRoutes) {
    if (!routes.has(route)) blocks.push(`INV-1.1 missing live public route ${route}`);
  }
  for (const record of records) {
    if (record.status === "live" && expectedRoutes.length > 0 && !expectedRoutes.includes(record.route)) blocks.push(`INV-1.1 unexpected live route ${record.route}`);
  }

  const sitemapRoutes = new Set(options.sitemapRoutes ?? []);
  for (const record of records) {
    if (record.status === "retired" && sitemapRoutes.has(record.route)) blocks.push(`INV-1.5 retired route appears in sitemap ${record.route}`);
  }

  const liveRecords = records.filter((record) => record.status === "live");
  const costGapCount = liveRecords.filter((record) => record.productionCostMinor === null).length;
  const productionCostGapPct = liveRecords.length === 0 ? 0 : (costGapCount / liveRecords.length) * 100;
  if (productionCostGapPct > 30) warnings.push(`INV-1.4 production cost gap ${productionCostGapPct.toFixed(2)}% > 30%; portfolio remains partial`);

  const templated = liveRecords.filter((record) => record.templateId !== null).length;
  const templateConcentrationPct = liveRecords.length === 0 ? 0 : (templated / liveRecords.length) * 100;
  if (templateConcentrationPct > 50) warnings.push(`INV-1.6 template concentration ${templateConcentrationPct.toFixed(2)}% > 50%`);

  const publicStaticRouteCount = expectedRoutes.length;
  const missingCount = expectedRoutes.filter((route) => !routes.has(route)).length;
  const publicStaticGapRatePct = publicStaticRouteCount === 0 ? 0 : (missingCount / publicStaticRouteCount) * 100;

  return {
    blocks: [...new Set(blocks)].sort(),
    warnings: [...new Set(warnings)].sort(),
    stats: {
      recordCount: records.length,
      liveRecordCount: liveRecords.length,
      publicStaticRouteCount,
      publicStaticGapRatePct,
      productionCostGapPct,
      templateConcentrationPct,
    },
  };
}

export function loadRegistryArtifact(path = REGISTRY_PATH): RegistryArtifact {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isObject(parsed) || !isObject(parsed.meta) || !isObject(parsed.data) || !Array.isArray(parsed.data.records)) {
    throw new Error("Registry artifact shape is invalid");
  }
  if (parsed.meta.siteId !== "cbamvalid" || parsed.meta.artifact !== "registry/cbamvalid_seo_registry") {
    throw new Error("Registry artifact metadata is invalid");
  }
  return parsed as unknown as RegistryArtifact;
}

export function runRegistryValidation(): RegistryValidation {
  const artifact = loadRegistryArtifact();
  const expectedRoutes = expectedConcreteSeoRoutes();
  const sitemapRoutes = listSitemapRoutes().map((entry) => entry.path);
  return validateRecords(artifact.data.records, { expectedRoutes, sitemapRoutes, phase: "faz-01" });
}

function main(): void {
  const result = runRegistryValidation();
  console.log(`REGISTRY_RECORDS=${result.stats.recordCount}`);
  console.log(`REGISTRY_LIVE_RECORDS=${result.stats.liveRecordCount}`);
  console.log(`REGISTRY_EXPECTED_PUBLIC_ROUTES=${result.stats.publicStaticRouteCount}`);
  console.log(`REGISTRY_GAP_RATE_PCT=${result.stats.publicStaticGapRatePct.toFixed(2)}`);
  console.log(`REGISTRY_PRODUCTION_COST_GAP_PCT=${result.stats.productionCostGapPct.toFixed(2)}`);
  console.log(`REGISTRY_TEMPLATE_CONCENTRATION_PCT=${result.stats.templateConcentrationPct.toFixed(2)}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const block of result.blocks) console.error(`BLOCK ${block}`);
  if (result.blocks.length > 0) process.exit(1);
  console.log("SEO_V6_REGISTRY_VALIDATION=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
