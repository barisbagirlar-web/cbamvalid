import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "../../app/sitemap";
import { buildRobotsPolicy } from "../../app/robots";
import { buildCanonicalUrl, resolveCanonicalPath } from "../../lib/seo/canonical";
import { SEO_ROUTE_REGISTRY, listSitemapRoutes } from "../../lib/seo/registry";
import type { SeoRouteContract } from "../../lib/seo/types";
import { validateStaticRobotsParity } from "./sitemap-robots-sync-v6";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PARAMETERS_PATH = resolve(ROOT, "data/seo/parameter_decisions.json");
const STATIC_ROBOTS_PATH = resolve(ROOT, "public/robots.txt");
const EXPECTED_GENERATOR = "scripts/seo/sitemap-audit-v6.ts";

type ParameterDecision = {
  parameter: string;
  class: string;
  canonicalTreatment: "STRIP";
  indexIdentity: "NO_SEPARATE_IDENTITY";
  sitemapEligible: false;
};

type ParameterArtifact = {
  meta: {
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
  data: {
    canonicalIdentity: "PATH_ONLY";
    sitemapQueryStringsAllowed: false;
    decisions: ParameterDecision[];
    unknownParameterPolicy: {
      canonicalTreatment: "PATH_ONLY";
      indexIdentity: "NO_SEPARATE_IDENTITY";
      sitemapEligible: false;
      rationale: string;
    };
  };
};

type RobotsRule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

type AuditResult = {
  blocks: string[];
  warnings: string[];
  stats: {
    sitemapUrlCount: number;
    indexableRegistryCount: number;
    parameterDecisionCount: number;
    namedRobotGroupCount: number;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcIso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function parseParameters(input: unknown): ParameterArtifact {
  if (!isObject(input) || !isObject(input.meta) || !isObject(input.data)) throw new Error("parameter decision artifact shape invalid");
  const meta = input.meta;
  if (meta.artifact !== "parameter-decisions/cbamvalid") throw new Error("parameter artifact name invalid");
  if (meta.schemaVersion !== "6.1") throw new Error("parameter schemaVersion invalid");
  if (!isUtcIso(meta.generatedAt)) throw new Error("parameter generatedAt invalid");
  if (meta.generatorScript !== EXPECTED_GENERATOR) throw new Error("parameter generatorScript invalid");
  if (!isObject(meta.inputWindow) || meta.inputWindow.start !== null || meta.inputWindow.end !== null) throw new Error("parameter inputWindow invalid");
  if (meta.siteId !== "cbamvalid") throw new Error("parameter siteId invalid");
  if (!Array.isArray(meta.structuralBreaksApplied) || !meta.structuralBreaksApplied.every((item) => typeof item === "string")) throw new Error("parameter structuralBreaksApplied invalid");

  const data = input.data;
  if (data.canonicalIdentity !== "PATH_ONLY" || data.sitemapQueryStringsAllowed !== false || !Array.isArray(data.decisions) || !isObject(data.unknownParameterPolicy)) throw new Error("parameter decision data invalid");
  const artifact = input as unknown as ParameterArtifact;
  for (const [index, decision] of artifact.data.decisions.entries()) {
    if (!decision.parameter || !decision.class || decision.canonicalTreatment !== "STRIP" || decision.indexIdentity !== "NO_SEPARATE_IDENTITY" || decision.sitemapEligible !== false) throw new Error(`parameter decision[${index}] invalid`);
  }
  if (!artifact.data.unknownParameterPolicy.rationale.trim()) throw new Error("unknown parameter policy rationale missing");
  return artifact;
}

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function sitemapPath(entry: MetadataRoute.Sitemap[number]): string {
  return new URL(entry.url).pathname;
}

export function validateSitemapRegistryParity(
  registryRoutes: readonly SeoRouteContract[],
  entries: MetadataRoute.Sitemap,
): string[] {
  const blocks: string[] = [];
  const expected = [...registryRoutes].map((route) => buildCanonicalUrl(route.canonicalPath)).sort();
  const actual = entries.map((entry) => entry.url).sort();
  if (new Set(actual).size !== actual.length) blocks.push("INV-3.1 sitemap contains duplicate URL entries");
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter((url) => !actualSet.has(url));
    const extra = actual.filter((url) => !expectedSet.has(url));
    blocks.push(`INV-3.1 sitemap/registry mismatch missing=${missing.join(",") || "none"} extra=${extra.join(",") || "none"}`);
  }
  return blocks;
}

function pathBlockedByRule(pathname: string, rule: string): boolean {
  if (rule === "") return false;
  if (rule.endsWith("$")) return pathname === rule.slice(0, -1);
  return pathname.startsWith(rule);
}

export function validateRobotsSitemapConflict(
  policy: MetadataRoute.Robots,
  entries: MetadataRoute.Sitemap,
): string[] {
  const blocks: string[] = [];
  const rulesRaw = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  const rules = rulesRaw as RobotsRule[];
  for (const rule of rules) {
    const agents = list(rule.userAgent);
    const disallow = list(rule.disallow);
    for (const entry of entries) {
      const path = sitemapPath(entry);
      const blocked = disallow.find((pattern) => pathBlockedByRule(path, pattern));
      if (blocked) blocks.push(`INV-3.2 sitemap URL ${path} blocked for ${agents.join("|")} by ${blocked}`);
    }
  }
  if (policy.sitemap) {
    for (const sitemapUrl of list(policy.sitemap)) {
      if (!/^https:\/\/cbamvalid\.com\/sitemap\.xml$/.test(sitemapUrl)) blocks.push(`INV-3.2 robots sitemap declaration invalid ${sitemapUrl}`);
    }
  } else {
    blocks.push("INV-3.2 robots sitemap declaration missing");
  }
  return [...new Set(blocks)].sort();
}

export function validateNoindexSitemapConflict(
  allRoutes: readonly SeoRouteContract[],
  entries: MetadataRoute.Sitemap,
): string[] {
  const sitemapPaths = new Set(entries.map(sitemapPath));
  return allRoutes
    .filter((route) => route.indexability === "noindex" && sitemapPaths.has(route.canonicalPath))
    .map((route) => `INV-3.3 noindex route present in sitemap ${route.canonicalPath}`)
    .sort();
}

export function validateTruthfulLastmod(
  registryRoutes: readonly SeoRouteContract[],
  entries: MetadataRoute.Sitemap,
  now = new Date(),
): string[] {
  const blocks: string[] = [];
  const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
  for (const route of registryRoutes) {
    const url = buildCanonicalUrl(route.canonicalPath);
    const entry = byUrl.get(url);
    if (!entry) continue;
    const actual = entry.lastModified;
    if (!route.factualLastModified) {
      if (actual !== undefined) blocks.push(`INV-3.4a lastmod emitted without factual source ${route.canonicalPath}`);
      continue;
    }
    if (actual === undefined) {
      blocks.push(`INV-3.4a factual lastmod omitted ${route.canonicalPath}`);
      continue;
    }
    const date = actual instanceof Date ? actual : new Date(actual);
    if (Number.isNaN(date.getTime())) {
      blocks.push(`INV-3.4a invalid lastmod ${route.canonicalPath}`);
      continue;
    }
    if (date.getTime() > now.getTime()) blocks.push(`INV-3.4a future lastmod ${route.canonicalPath}`);
    if (date.toISOString().slice(0, 10) !== route.factualLastModified) blocks.push(`INV-3.4a lastmod drift ${route.canonicalPath}`);
  }
  return blocks.sort();
}

export function validateParameterCoverage(artifact: ParameterArtifact): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const decision of artifact.data.decisions) {
    if (seen.has(decision.parameter)) warnings.push(`INV-3.5 duplicate parameter decision ${decision.parameter}`);
    seen.add(decision.parameter);
    const sample = `/pricing?${encodeURIComponent(decision.parameter)}=phase3`;
    if (resolveCanonicalPath(sample) !== "/pricing") warnings.push(`INV-3.5 canonical resolver drift for ${decision.parameter}`);
  }
  if (resolveCanonicalPath("/pricing?unknown_phase3_key=1") !== "/pricing") warnings.push("INV-3.5 unknown parameter policy drift");
  return warnings.sort();
}

export function runSitemapAudit(): AuditResult {
  const entries = buildSitemapEntries();
  const indexableRoutes = listSitemapRoutes();
  const robotsPolicy = buildRobotsPolicy();
  const parameterArtifact = parseParameters(JSON.parse(readFileSync(PARAMETERS_PATH, "utf8")) as unknown);
  const blocks = [
    ...validateSitemapRegistryParity(indexableRoutes, entries),
    ...validateRobotsSitemapConflict(robotsPolicy, entries),
    ...validateNoindexSitemapConflict(SEO_ROUTE_REGISTRY, entries),
    ...validateTruthfulLastmod(indexableRoutes, entries),
    ...validateStaticRobotsParity(readFileSync(STATIC_ROBOTS_PATH, "utf8")),
  ];
  const warnings = validateParameterCoverage(parameterArtifact);
  const rulesRaw = Array.isArray(robotsPolicy.rules) ? robotsPolicy.rules : [robotsPolicy.rules];
  return {
    blocks: [...new Set(blocks)].sort(),
    warnings: [...new Set(warnings)].sort(),
    stats: {
      sitemapUrlCount: entries.length,
      indexableRegistryCount: indexableRoutes.length,
      parameterDecisionCount: parameterArtifact.data.decisions.length,
      namedRobotGroupCount: rulesRaw.length,
    },
  };
}

function main(): void {
  const result = runSitemapAudit();
  console.log(`PHASE3_SITEMAP_URLS=${result.stats.sitemapUrlCount}`);
  console.log(`PHASE3_REGISTRY_INDEXABLE=${result.stats.indexableRegistryCount}`);
  console.log(`PHASE3_PARAMETER_DECISIONS=${result.stats.parameterDecisionCount}`);
  console.log(`PHASE3_ROBOT_GROUPS=${result.stats.namedRobotGroupCount}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const block of result.blocks) console.error(`BLOCK ${block}`);
  if (result.blocks.length > 0) process.exit(1);
  if (result.warnings.length > 0) process.exit(2);
  console.log(process.argv.includes("--dry-run") ? "SEO_V6_PHASE3=PASS_DRY_RUN" : "SEO_V6_PHASE3=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
