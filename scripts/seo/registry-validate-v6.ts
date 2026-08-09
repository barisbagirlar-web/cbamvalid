import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPublicCnCodes } from "../../lib/seo/cn-public-registry";
import { listSitemapRoutes } from "../../lib/seo/registry";

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

export type ArtifactMeta = {
  artifact: string;
  schemaVersion: string;
  generatedAt: string;
  generatorScript: string;
  inputWindow: { start: string | null; end: string | null };
  confidence: "low" | "medium" | "high";
  partial: boolean;
  siteId: string;
  coldStart: boolean | null;
  structuralBreaksApplied: string[];
};

export type RegistryArtifact = {
  meta: ArtifactMeta;
  data: {
    inventoryBasis: string;
    measurementDebt: string;
    internalLinkCountSemantics: string;
    dynamicRouteFamilies?: Array<{
      routePattern: string;
      treatment: "materialized" | "noindex_utility";
      evidence: string;
    }>;
    records: SeoPageRecord[];
  };
};

export type RegistryValidation = {
  blocks: string[];
  warnings: string[];
  stats: {
    recordCount: number;
    liveRecordCount: number;
    expectedConcreteRouteCount: number;
    routeGapRatePct: number;
    productionCostGapPct: number;
    templateConcentrationPct: number;
  };
};

type RegistryThresholds = {
  productionCostMissingWarnPct: number;
  programmaticShareWarnPct: number;
};

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PUBLIC_APP_ROOT = resolve(ROOT, "app/(public)");
const REGISTRY_PATH = resolve(ROOT, "data/seo/registry/cbamvalid_seo_registry.json");
const CONFIG_PATH = resolve(ROOT, "sites/cbamvalid/seo.config.json");
const EXPECTED_GENERATOR = "scripts/seo/registry-validate-v6.ts";
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
const VALID_COST_CONFIDENCE = new Set<Exclude<CostConfidence, null>>(["high", "medium", "low"]);
const VALID_PORTFOLIO = new Set<Exclude<PortfolioDecision, null>>(["INVEST", "HOLD", "HARVEST", "DIVEST"]);
const VALID_GROWTH_LOOPS = new Set<Exclude<GrowthLoop, null>>([
  "content_compounding",
  "tool_virality",
  "ugc_loop",
  "programmatic_longtail",
]);

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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isUtcIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isNullableUtcIsoTimestamp(value: unknown): value is string | null {
  return value === null || isUtcIsoTimestamp(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function requireThresholds(): RegistryThresholds {
  const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as unknown;
  if (!isObject(parsed) || !isObject(parsed.thresholds)) throw new Error("SEO config thresholds missing");
  const cost = parsed.thresholds.productionCostMissingWarnPct;
  const template = parsed.thresholds.programmaticShareWarnPct;
  if (!isNonNegativeInteger(cost) || !isNonNegativeInteger(template)) {
    throw new Error("Phase 1 registry thresholds must be non-negative integers");
  }
  return { productionCostMissingWarnPct: cost, programmaticShareWarnPct: template };
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

export function discoverPublicDynamicRouteFamilies(root = PUBLIC_APP_ROOT): string[] {
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
      if (!relDir.includes("[")) continue;
      routes.push(`/${relDir}`);
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

export function validateArtifactMeta(meta: unknown): string[] {
  if (!isObject(meta)) return ["C-01 registry artifact meta must be object"];
  const errors: string[] = [];
  if (meta.artifact !== "registry/cbamvalid_seo_registry") errors.push("C-01 invalid registry artifact name");
  if (meta.schemaVersion !== "6.1") errors.push("C-01 registry schemaVersion must be 6.1");
  if (!isUtcIsoTimestamp(meta.generatedAt)) errors.push("C-01 generatedAt must be UTC ISO-8601");
  if (meta.generatorScript !== EXPECTED_GENERATOR) errors.push(`C-01 generatorScript must be ${EXPECTED_GENERATOR}`);
  if (!isObject(meta.inputWindow)) {
    errors.push("C-01 inputWindow missing");
  } else {
    const start = meta.inputWindow.start;
    const end = meta.inputWindow.end;
    if (start !== null && !isDateOnly(start)) errors.push("C-01 inputWindow.start must be YYYY-MM-DD or null");
    if (end !== null && !isDateOnly(end)) errors.push("C-01 inputWindow.end must be YYYY-MM-DD or null");
  }
  if (meta.confidence !== "low" && meta.confidence !== "medium" && meta.confidence !== "high") errors.push("C-01 invalid confidence");
  if (typeof meta.partial !== "boolean") errors.push("C-01 partial must be boolean");
  if (meta.siteId !== "cbamvalid") errors.push("C-01 siteId must be cbamvalid");
  if (meta.coldStart !== null && typeof meta.coldStart !== "boolean") errors.push("C-01 coldStart must be boolean or null");
  if (!isStringArray(meta.structuralBreaksApplied)) errors.push("C-01 structuralBreaksApplied must be string[]");
  return errors;
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
  if (!isStringArray(record.queryClusterIds) || !hasUniqueStrings(record.queryClusterIds)) {
    errors.push(`record[${index}] invalid queryClusterIds`);
  } else if (typeof record.primaryQueryClusterId === "string" && !record.queryClusterIds.includes(record.primaryQueryClusterId)) {
    errors.push(`record[${index}] primaryQueryClusterId must appear in queryClusterIds`);
  }

  if (!isNullableString(record.primaryEntity)) errors.push(`record[${index}] invalid primaryEntity`);
  if (record.searchIntent !== null && (typeof record.searchIntent !== "string" || !VALID_INTENTS.has(record.searchIntent as Exclude<SearchIntent, null>))) {
    errors.push(`record[${index}] invalid searchIntent`);
  }

  if (!isNullableString(record.templateId)) errors.push(`record[${index}] invalid templateId`);
  if (!isStringArray(record.serpFeatureTargets) || !hasUniqueStrings(record.serpFeatureTargets)) errors.push(`record[${index}] invalid serpFeatureTargets`);
  if (record.canonical !== null && !isRoute(record.canonical)) errors.push(`record[${index}] invalid canonical`);
  if (!isNullableString(record.hreflangGroup)) errors.push(`record[${index}] invalid hreflangGroup`);

  if (!isNonNegativeInteger(record.internalLinksIn)) errors.push(`record[${index}] invalid internalLinksIn`);
  if (!isNonNegativeInteger(record.internalLinksOut)) errors.push(`record[${index}] invalid internalLinksOut`);

  for (const metric of ["impressions28d", "clicks28d", "conversions28d"] as const) {
    const value = record[metric];
    if (!isNullableNumber(value) || (value !== null && !isNonNegativeInteger(value))) errors.push(`record[${index}] invalid ${metric}`);
  }

  for (const field of MINOR_FIELDS) {
    const value = record[field];
    if (value !== null && !isNonNegativeInteger(value)) errors.push(`INV-1.2 record[${index}] ${field} must be integer minor units or null`);
  }

  if (record.costConfidence !== null && (typeof record.costConfidence !== "string" || !VALID_COST_CONFIDENCE.has(record.costConfidence as Exclude<CostConfidence, null>))) {
    errors.push(`record[${index}] invalid costConfidence`);
  }
  if (record.productionCostMinor === null && record.costConfidence !== null) errors.push(`record[${index}] costConfidence requires productionCostMinor`);
  if (record.productionCostMinor !== null && record.costConfidence === null) errors.push(`record[${index}] productionCostMinor requires costConfidence`);

  if (record.portfolioDecision !== null && (typeof record.portfolioDecision !== "string" || !VALID_PORTFOLIO.has(record.portfolioDecision as Exclude<PortfolioDecision, null>))) {
    errors.push(`record[${index}] invalid portfolioDecision`);
  }
  if (record.portfolioDecision !== null) errors.push(`record[${index}] portfolioDecision must remain null until Phase 17`);

  if (record.growthLoop !== null && (typeof record.growthLoop !== "string" || !VALID_GROWTH_LOOPS.has(record.growthLoop as Exclude<GrowthLoop, null>))) {
    errors.push(`record[${index}] invalid growthLoop`);
  }
  if (record.growthLoop !== null) errors.push(`INV-1.8 record[${index}] growthLoop must remain null in Phase 1`);

  if (record.primaryQueryClusterId !== null && !isRoute(record.ownerRoute)) errors.push(`INV-1.3 record[${index}] cluster requires ownerRoute`);
  if (record.ownerRoute !== null && !isRoute(record.ownerRoute)) errors.push(`record[${index}] invalid ownerRoute`);

  if (!isNullableUtcIsoTimestamp(record.lastCrawledAt)) errors.push(`record[${index}] invalid lastCrawledAt`);
  if (!isNullableUtcIsoTimestamp(record.lastSignificantChangeAt)) errors.push(`record[${index}] invalid lastSignificantChangeAt`);
  if (typeof record.decayFlag !== "boolean") errors.push(`record[${index}] invalid decayFlag`);

  if (record.redirectTarget !== null && !isRoute(record.redirectTarget)) errors.push(`record[${index}] invalid redirectTarget`);
  if (!isNullableUtcIsoTimestamp(record.retiredAt)) errors.push(`record[${index}] invalid retiredAt`);
  if (!isNullableString(record.notes)) errors.push(`record[${index}] invalid notes`);
  if (typeof record.linkableAsset !== "boolean") errors.push(`record[${index}] invalid linkableAsset`);

  if (record.status === "redirected" && !isRoute(record.redirectTarget)) errors.push(`record[${index}] redirected status requires redirectTarget`);
  if (record.status !== "redirected" && record.redirectTarget !== null) errors.push(`record[${index}] redirectTarget requires redirected status`);
  if (record.status === "retired" && !isUtcIsoTimestamp(record.retiredAt)) errors.push(`record[${index}] retired status requires retiredAt`);
  if (record.status !== "retired" && record.retiredAt !== null) errors.push(`record[${index}] retiredAt requires retired status`);

  return errors;
}

export function validateDynamicRouteCoverage(artifact: RegistryArtifact): string[] {
  const blocks: string[] = [];
  const discovered = discoverPublicDynamicRouteFamilies();
  const declared = artifact.data.dynamicRouteFamilies ?? [];
  const declaredPatterns = new Set(declared.map((item) => item.routePattern));

  for (const routePattern of discovered) {
    if (!declaredPatterns.has(routePattern)) blocks.push(`INV-1.1 unclassified dynamic public route family ${routePattern}`);
  }
  for (const item of declared) {
    if (!discovered.includes(item.routePattern)) blocks.push(`INV-1.1 declared dynamic route family missing from filesystem ${item.routePattern}`);
    if (!item.evidence.trim()) blocks.push(`INV-1.1 dynamic route family ${item.routePattern} missing evidence`);
  }

  const cnFamily = declared.find((item) => item.routePattern === "/cn-code/[code]");
  if (!cnFamily || cnFamily.treatment !== "materialized") blocks.push("INV-1.1 /cn-code/[code] must be declared materialized into concrete Stage-1 records");
  for (const utility of ["/verify/[publicToken]", "/verify/package/[packageId]"]) {
    const match = declared.find((item) => item.routePattern === utility);
    if (!match || match.treatment !== "noindex_utility") blocks.push(`INV-1.1 ${utility} must be declared noindex_utility`);
  }
  return blocks;
}

export function validateRecords(
  records: SeoPageRecord[],
  options: { expectedRoutes?: string[]; sitemapRoutes?: string[]; phase?: string; thresholds?: RegistryThresholds } = {},
): RegistryValidation {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const pageIds = new Set<string>();
  const routes = new Set<string>();
  const phase = options.phase ?? "faz-01";
  const thresholds = options.thresholds ?? requireThresholds();

  blocks.push(...assertRegistryWriterPhase(phase));

  records.forEach((record, index) => {
    blocks.push(...validateRecordShape(record, index));
    if (pageIds.has(record.pageId)) blocks.push(`INV-1.1 duplicate pageId ${record.pageId}`);
    pageIds.add(record.pageId);
    if (routes.has(record.route)) blocks.push(`INV-1.1 duplicate route ${record.route}`);
    routes.add(record.route);
  });

  const sorted = [...records].sort((left, right) => (left.route < right.route ? -1 : left.route > right.route ? 1 : 0)).map((record) => record.route);
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
  if (productionCostGapPct > thresholds.productionCostMissingWarnPct) warnings.push(`INV-1.4 production cost gap ${productionCostGapPct.toFixed(2)}% > config threshold ${thresholds.productionCostMissingWarnPct}%; portfolio remains partial`);

  const templated = liveRecords.filter((record) => record.templateId !== null).length;
  const templateConcentrationPct = liveRecords.length === 0 ? 0 : (templated / liveRecords.length) * 100;
  if (templateConcentrationPct > thresholds.programmaticShareWarnPct) warnings.push(`INV-1.6 template concentration ${templateConcentrationPct.toFixed(2)}% > config threshold ${thresholds.programmaticShareWarnPct}%`);

  const expectedConcreteRouteCount = expectedRoutes.length;
  const missingCount = expectedRoutes.filter((route) => !routes.has(route)).length;
  const routeGapRatePct = expectedConcreteRouteCount === 0 ? 0 : (missingCount / expectedConcreteRouteCount) * 100;

  return {
    blocks: [...new Set(blocks)].sort(),
    warnings: [...new Set(warnings)].sort(),
    stats: {
      recordCount: records.length,
      liveRecordCount: liveRecords.length,
      expectedConcreteRouteCount,
      routeGapRatePct,
      productionCostGapPct,
      templateConcentrationPct,
    },
  };
}

export function loadRegistryArtifact(path = REGISTRY_PATH): RegistryArtifact {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isObject(parsed) || !isObject(parsed.meta) || !isObject(parsed.data) || !Array.isArray(parsed.data.records)) throw new Error("Registry artifact shape is invalid");

  const metaErrors = validateArtifactMeta(parsed.meta);
  if (metaErrors.length > 0) throw new Error(metaErrors.join("; "));

  if (typeof parsed.data.inventoryBasis !== "string" || typeof parsed.data.measurementDebt !== "string" || typeof parsed.data.internalLinkCountSemantics !== "string") {
    throw new Error("Registry artifact data provenance fields are invalid");
  }

  if (parsed.data.dynamicRouteFamilies !== undefined && (!Array.isArray(parsed.data.dynamicRouteFamilies) || !parsed.data.dynamicRouteFamilies.every((item) => isObject(item) && typeof item.routePattern === "string" && (item.treatment === "materialized" || item.treatment === "noindex_utility") && typeof item.evidence === "string"))) {
    throw new Error("Registry dynamicRouteFamilies shape is invalid");
  }

  return parsed as unknown as RegistryArtifact;
}

export function runRegistryValidation(): RegistryValidation {
  const artifact = loadRegistryArtifact();
  const expectedRoutes = expectedConcreteSeoRoutes();
  const sitemapRoutes = listSitemapRoutes().map((entry) => entry.path);
  const result = validateRecords(artifact.data.records, { expectedRoutes, sitemapRoutes, phase: "faz-01" });
  result.blocks.push(...validateDynamicRouteCoverage(artifact));
  result.blocks = [...new Set(result.blocks)].sort();
  return result;
}

function main(): void {
  const result = runRegistryValidation();
  console.log(`REGISTRY_RECORDS=${result.stats.recordCount}`);
  console.log(`REGISTRY_LIVE_RECORDS=${result.stats.liveRecordCount}`);
  console.log(`REGISTRY_EXPECTED_CONCRETE_ROUTES=${result.stats.expectedConcreteRouteCount}`);
  console.log(`REGISTRY_GAP_RATE_PCT=${result.stats.routeGapRatePct.toFixed(2)}`);
  console.log(`REGISTRY_PRODUCTION_COST_GAP_PCT=${result.stats.productionCostGapPct.toFixed(2)}`);
  console.log(`REGISTRY_TEMPLATE_CONCENTRATION_PCT=${result.stats.templateConcentrationPct.toFixed(2)}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const block of result.blocks) console.error(`BLOCK ${block}`);
  if (result.blocks.length > 0) process.exit(1);
  console.log("SEO_V6_REGISTRY_VALIDATION=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
