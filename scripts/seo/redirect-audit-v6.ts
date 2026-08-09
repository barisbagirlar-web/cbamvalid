import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RedirectCondition = {
  type: "host";
  value: string;
};

export type RedirectRule = {
  source: string;
  destination: string;
  permanent: boolean;
  has: RedirectCondition[];
};

export type LedgerRedirect = {
  id: string;
  source: string;
  sourceHost: string;
  destination: string;
  statusCode: number;
  permanent: boolean;
  owner: string;
  firstObservedAt: string;
  ageKnown: boolean;
  lastReviewedAt: string;
  reviewDecision: "KEEP" | "REMOVE" | "REPLACE";
  rationale: string;
};

export type RedirectLedger = {
  canonicalOrigin: string;
  canonicalHost: string;
  runtimeOwners: {
    applicationRedirects: string;
    applicationHeaders: string;
    transportHttpsUpgrade: string;
    transportHttpsUpgradeRepositoryMutable: boolean;
  };
  hsts: {
    expectedValue: string;
    preload: boolean;
    preloadApprovalRecorded: boolean;
    decision: string;
  };
  redirects: LedgerRedirect[];
  variantPolicy: Record<string, string>;
  externalControls: Array<{
    id: string;
    control: string;
    owner: string;
    repositoryMutable: boolean;
    codeScopeStatus: string;
    reason: string;
  }>;
  capacity: {
    redirectLimit: number;
    applicationRuleCount: number;
    utilizationBasisPoints: number;
    warningThresholdPct: number;
    warning: boolean;
  };
};

export type Phase2Validation = {
  blocks: string[];
  warnings: string[];
  stats: {
    ruleCount: number;
    capacityBasisPoints: number;
    representativeTraceCount: number;
  };
};

export type TraceHop = {
  from: string;
  to: string;
  ruleSource: string;
};

export type RedirectTrace = {
  start: string;
  finalUrl: string;
  hops: TraceHop[];
  loopDetected: boolean;
};

type NextConfigLike = {
  redirects: () => Promise<unknown> | unknown;
  headers: () => Promise<unknown> | unknown;
  trailingSlash?: boolean;
  skipTrailingSlashRedirect?: boolean;
};

type LedgerArtifact = {
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
  data: RedirectLedger;
};

type SiteConfig = {
  site: { rootUrl: string };
  deployment: { redirectLimit: number };
  thresholds: { redirectCapacityWarnPct: number };
};

type LiveProbe = {
  id: string;
  startUrl: string;
  userAgent: string;
  finalUrl: string | null;
  finalStatus: number | null;
  redirects: Array<{ status: number; from: string; to: string }>;
  vary: string | null;
  hsts: string | null;
  error: string | null;
};

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const LEDGER_PATH = resolve(ROOT, "data/seo/redirects.json");
const SITE_CONFIG_PATH = resolve(ROOT, "sites/cbamvalid/seo.config.json");
const DECISION_LOG_PATH = resolve(ROOT, "docs/seo/KARAR_DEFTERI.md");
const NEXT_CONFIG_PATH = resolve(ROOT, "next.config.js");
const requireFromHere = createRequire(import.meta.url);
const EXPECTED_GENERATOR = "scripts/seo/redirect-audit-v6.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isUtcIso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function assertInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) throw new Error(`${label} must be integer >= ${minimum}`);
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function hasExplicitHstsPreloadApproval(decisionLog: string): boolean {
  return /^- Decision:\s*APPROVE_HSTS_PRELOAD\b/im.test(decisionLog);
}

export function validateArtifactEnvelope(input: unknown): string[] {
  if (!isObject(input) || !isObject(input.meta) || !isObject(input.data)) return ["C-01 redirect ledger artifact shape invalid"];
  const meta = input.meta;
  const errors: string[] = [];
  if (meta.artifact !== "redirects/cbamvalid_redirect_ledger") errors.push("C-01 redirect ledger artifact name invalid");
  if (meta.schemaVersion !== "6.1") errors.push("C-01 redirect ledger schemaVersion must be 6.1");
  if (!isUtcIso(meta.generatedAt)) errors.push("C-01 redirect ledger generatedAt must be UTC ISO-8601");
  if (meta.generatorScript !== EXPECTED_GENERATOR) errors.push(`C-01 redirect ledger generatorScript must be ${EXPECTED_GENERATOR}`);
  if (!isObject(meta.inputWindow) || meta.inputWindow.start !== null || meta.inputWindow.end !== null) errors.push("C-01 redirect ledger inputWindow must be null/null for configuration audit");
  if (meta.confidence !== "low" && meta.confidence !== "medium" && meta.confidence !== "high") errors.push("C-01 redirect ledger confidence invalid");
  if (typeof meta.partial !== "boolean") errors.push("C-01 redirect ledger partial must be boolean");
  if (meta.siteId !== "cbamvalid") errors.push("C-01 redirect ledger siteId must be cbamvalid");
  if (meta.coldStart !== null && typeof meta.coldStart !== "boolean") errors.push("C-01 redirect ledger coldStart invalid");
  if (!isStringArray(meta.structuralBreaksApplied)) errors.push("C-01 redirect ledger structuralBreaksApplied must be string[]");
  return errors;
}

export function parseRedirectRule(input: unknown, index: number): RedirectRule {
  if (!isObject(input) || typeof input.source !== "string" || typeof input.destination !== "string" || typeof input.permanent !== "boolean") {
    throw new Error(`redirect[${index}] invalid`);
  }
  const hasRaw = input.has ?? [];
  if (!Array.isArray(hasRaw)) throw new Error(`redirect[${index}].has invalid`);
  const has: RedirectCondition[] = hasRaw.map((condition, conditionIndex) => {
    if (!isObject(condition) || condition.type !== "host" || typeof condition.value !== "string") {
      throw new Error(`redirect[${index}].has[${conditionIndex}] invalid`);
    }
    return { type: "host", value: condition.value };
  });
  return { source: input.source, destination: input.destination, permanent: input.permanent, has };
}

export function parseRedirectRules(input: unknown): RedirectRule[] {
  if (!Array.isArray(input)) throw new Error("next redirects must be array");
  return input.map(parseRedirectRule);
}

function parseLedgerRedirect(input: unknown, index: number): LedgerRedirect {
  if (!isObject(input)) throw new Error(`ledger.redirects[${index}] invalid`);
  const requiredStrings = ["id", "source", "sourceHost", "destination", "owner", "firstObservedAt", "lastReviewedAt", "rationale"] as const;
  for (const key of requiredStrings) if (typeof input[key] !== "string") throw new Error(`ledger.redirects[${index}].${key} invalid`);
  assertInteger(input.statusCode, `ledger.redirects[${index}].statusCode`, 300);
  if (typeof input.permanent !== "boolean" || typeof input.ageKnown !== "boolean") throw new Error(`ledger.redirects[${index}] boolean field invalid`);
  if (input.reviewDecision !== "KEEP" && input.reviewDecision !== "REMOVE" && input.reviewDecision !== "REPLACE") throw new Error(`ledger.redirects[${index}].reviewDecision invalid`);
  if (!isUtcIso(input.firstObservedAt) || !isUtcIso(input.lastReviewedAt)) throw new Error(`ledger.redirects[${index}] timestamps invalid`);
  return input as unknown as LedgerRedirect;
}

export function parseLedgerArtifact(input: unknown): LedgerArtifact {
  const envelopeErrors = validateArtifactEnvelope(input);
  if (envelopeErrors.length > 0) throw new Error(envelopeErrors.join("; "));
  if (!isObject(input) || !isObject(input.meta) || !isObject(input.data)) throw new Error("ledger artifact invalid");
  const data = input.data;
  if (typeof data.canonicalOrigin !== "string" || typeof data.canonicalHost !== "string") throw new Error("ledger canonical fields invalid");
  if (!isObject(data.runtimeOwners) || !isObject(data.hsts) || !Array.isArray(data.redirects) || !isObject(data.variantPolicy) || !Array.isArray(data.externalControls) || !isObject(data.capacity)) {
    throw new Error("ledger data shape invalid");
  }
  const redirects = data.redirects.map(parseLedgerRedirect);
  const artifact = input as unknown as LedgerArtifact;
  artifact.data.redirects = redirects;
  return artifact;
}

export function parseSiteConfig(input: unknown): SiteConfig {
  if (!isObject(input) || !isObject(input.site) || !isObject(input.deployment) || !isObject(input.thresholds)) throw new Error("site config shape invalid");
  if (typeof input.site.rootUrl !== "string") throw new Error("site.rootUrl invalid");
  assertInteger(input.deployment.redirectLimit, "deployment.redirectLimit", 1);
  assertInteger(input.thresholds.redirectCapacityWarnPct, "thresholds.redirectCapacityWarnPct", 1);
  return input as unknown as SiteConfig;
}

function pathMatches(source: string, pathname: string): { matches: boolean; pathStar: string } {
  if (source === "/:path*") return { matches: true, pathStar: pathname.replace(/^\//, "").replace(/\/$/, "") };
  return { matches: source === pathname, pathStar: "" };
}

function hostMatches(rule: RedirectRule, url: URL): boolean {
  const hostConditions = rule.has.filter((condition) => condition.type === "host");
  return hostConditions.every((condition) => url.hostname.toLowerCase() === condition.value.toLowerCase());
}

export function applyRedirectRule(urlText: string, rules: RedirectRule[]): { to: string; ruleSource: string } | null {
  const url = new URL(urlText);
  for (const rule of rules) {
    const path = pathMatches(rule.source, url.pathname);
    if (!path.matches || !hostMatches(rule, url)) continue;
    const destination = rule.destination.replace(":path*", path.pathStar);
    const target = new URL(destination, url.origin);
    target.search = url.search;
    return { to: target.toString(), ruleSource: rule.source };
  }
  return null;
}

export function traceRedirects(start: string, rules: RedirectRule[], maxHops = 8): RedirectTrace {
  const seen = new Set<string>();
  const hops: TraceHop[] = [];
  let current = new URL(start).toString();
  for (let index = 0; index < maxHops; index += 1) {
    if (seen.has(current)) return { start, finalUrl: current, hops, loopDetected: true };
    seen.add(current);
    const applied = applyRedirectRule(current, rules);
    if (!applied) return { start, finalUrl: current, hops, loopDetected: false };
    hops.push({ from: current, to: applied.to, ruleSource: applied.ruleSource });
    current = applied.to;
  }
  return { start, finalUrl: current, hops, loopDetected: true };
}

function canonicalVariantCases(canonicalOrigin: string, canonicalHost: string): Array<{ start: string; expected: string }> {
  const wwwOrigin = `https://www.${canonicalHost}`;
  return [
    { start: `${wwwOrigin}/`, expected: `${canonicalOrigin}/` },
    { start: `${wwwOrigin}/pricing`, expected: `${canonicalOrigin}/pricing` },
    { start: `${wwwOrigin}/credits`, expected: `${canonicalOrigin}/credits/buy` },
    { start: `${wwwOrigin}/cbam-methodology`, expected: `${canonicalOrigin}/methodology` },
    { start: `${canonicalOrigin}/credits`, expected: `${canonicalOrigin}/credits/buy` },
    { start: `${canonicalOrigin}/cbam-methodology`, expected: `${canonicalOrigin}/methodology` },
  ];
}

function ledgerRuleKey(source: string, host: string): string {
  return `${host.toLowerCase()}|${source}`;
}

function runtimeRuleHost(rule: RedirectRule): string {
  return rule.has.find((condition) => condition.type === "host")?.value ?? "*";
}

export function validateLedgerParity(rules: RedirectRule[], ledger: RedirectLedger): string[] {
  const blocks: string[] = [];
  const runtime = new Map(rules.map((rule) => [ledgerRuleKey(rule.source, runtimeRuleHost(rule)), rule]));
  const recorded = new Map(ledger.redirects.map((rule) => [ledgerRuleKey(rule.source, rule.sourceHost), rule]));
  if (runtime.size !== recorded.size) blocks.push(`INV-2.1 redirect ledger count ${recorded.size} != runtime ${runtime.size}`);
  for (const [key, rule] of runtime) {
    const entry = recorded.get(key);
    if (!entry) {
      blocks.push(`INV-2.1 runtime redirect missing from ledger ${key}`);
      continue;
    }
    if (entry.destination !== rule.destination) blocks.push(`INV-2.1 redirect destination drift ${key}`);
    if (!rule.permanent || !entry.permanent || entry.statusCode !== 308) blocks.push(`INV-2.1 permanent redirect must resolve as 308 ${key}`);
  }
  for (const key of recorded.keys()) if (!runtime.has(key)) blocks.push(`INV-2.1 ledger redirect missing from runtime ${key}`);
  return blocks;
}

export function validateSingleHopRedirects(rules: RedirectRule[], canonicalOrigin: string, canonicalHost: string): string[] {
  const blocks: string[] = [];
  for (const sample of canonicalVariantCases(canonicalOrigin, canonicalHost)) {
    const trace = traceRedirects(sample.start, rules);
    if (trace.loopDetected) {
      blocks.push(`INV-2.2 redirect loop ${sample.start}`);
      continue;
    }
    if (trace.hops.length !== 1) blocks.push(`INV-2.1 canonical redirect must be exactly one application hop ${sample.start}; got ${trace.hops.length}`);
    if (trace.finalUrl !== new URL(sample.expected).toString()) blocks.push(`INV-2.1 canonical redirect target mismatch ${sample.start} -> ${trace.finalUrl}`);
  }
  return blocks;
}

export function detectRedirectChains(rules: RedirectRule[], canonicalOrigin: string, canonicalHost: string): string[] {
  const blocks: string[] = [];
  const samples = canonicalVariantCases(canonicalOrigin, canonicalHost);
  for (const sample of samples) {
    const trace = traceRedirects(sample.start, rules);
    if (trace.loopDetected || trace.hops.length > 1) blocks.push(`INV-2.2 redirect chain/loop ${sample.start}: ${trace.hops.map((hop) => hop.to).join(" -> ")}`);
  }
  return blocks;
}

export function validateHsts(hstsValue: string | null, preloadApproved: boolean, expectedValue: string): string[] {
  const blocks: string[] = [];
  if (!hstsValue) return ["INV-2.3 HSTS header missing"];
  if (/\bpreload\b/i.test(hstsValue) && !preloadApproved) blocks.push("INV-2.3 HSTS preload present without explicit irreversible approval");
  if (hstsValue !== expectedValue) blocks.push(`INV-2.3 HSTS value drift: expected '${expectedValue}', got '${hstsValue}'`);
  return blocks;
}

export function validateDuplicateVariantResponses(responses: Array<{ id: string; canonical: boolean; status: number }>): string[] {
  const blocks: string[] = [];
  for (const response of responses) {
    if (!response.canonical && response.status >= 200 && response.status < 300) blocks.push(`INV-2.5 duplicate URL variant returned ${response.status}: ${response.id}`);
  }
  return blocks;
}

function findHstsValue(headersRaw: unknown): string | null {
  if (!Array.isArray(headersRaw)) throw new Error("next headers must be array");
  for (const rule of headersRaw) {
    if (!isObject(rule) || !Array.isArray(rule.headers)) continue;
    for (const header of rule.headers) {
      if (isObject(header) && typeof header.key === "string" && header.key.toLowerCase() === "strict-transport-security" && typeof header.value === "string") return header.value;
    }
  }
  return null;
}

export function validatePhase2Contract(input: {
  rules: RedirectRule[];
  ledger: RedirectLedger;
  hstsValue: string | null;
  preloadApproved: boolean;
  redirectLimit: number;
  redirectCapacityWarnPct: number;
  trailingSlash?: boolean;
  skipTrailingSlashRedirect?: boolean;
}): Phase2Validation {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const canonicalUrl = new URL(input.ledger.canonicalOrigin);
  if (canonicalUrl.protocol !== "https:" || canonicalUrl.origin !== input.ledger.canonicalOrigin) blocks.push("INV-2.1 canonicalOrigin must be HTTPS origin only");
  if (canonicalUrl.hostname !== input.ledger.canonicalHost) blocks.push("INV-2.1 canonical host/origin mismatch");

  blocks.push(...validateLedgerParity(input.rules, input.ledger));
  blocks.push(...validateSingleHopRedirects(input.rules, input.ledger.canonicalOrigin, input.ledger.canonicalHost));
  blocks.push(...detectRedirectChains(input.rules, input.ledger.canonicalOrigin, input.ledger.canonicalHost));
  blocks.push(...validateHsts(input.hstsValue, input.preloadApproved, input.ledger.hsts.expectedValue));

  if (input.trailingSlash === true) blocks.push("INV-2.5 trailingSlash=true would change the declared non-trailing canonical variant policy");
  if (input.skipTrailingSlashRedirect === true) blocks.push("INV-2.5 skipTrailingSlashRedirect=true would permit unmanaged slash variants");

  for (const entry of input.ledger.redirects) {
    if (entry.reviewDecision !== "KEEP") warnings.push(`INV-2.4 redirect ${entry.id} reviewDecision=${entry.reviewDecision}`);
    if (!entry.rationale.trim()) warnings.push(`INV-2.4 redirect ${entry.id} missing review rationale`);
  }

  const capacityBasisPoints = Math.floor((input.rules.length * 10000) / input.redirectLimit);
  if (capacityBasisPoints >= input.redirectCapacityWarnPct * 100) warnings.push(`INV-2.6 redirect capacity ${capacityBasisPoints}bp >= ${input.redirectCapacityWarnPct * 100}bp`);
  if (input.ledger.capacity.redirectLimit !== input.redirectLimit || input.ledger.capacity.applicationRuleCount !== input.rules.length || input.ledger.capacity.utilizationBasisPoints !== capacityBasisPoints || input.ledger.capacity.warningThresholdPct !== input.redirectCapacityWarnPct || input.ledger.capacity.warning !== (capacityBasisPoints >= input.redirectCapacityWarnPct * 100)) {
    blocks.push("INV-2.1 redirect capacity ledger drift");
  }

  return {
    blocks: [...new Set(blocks)].sort(),
    warnings: [...new Set(warnings)].sort(),
    stats: {
      ruleCount: input.rules.length,
      capacityBasisPoints,
      representativeTraceCount: canonicalVariantCases(input.ledger.canonicalOrigin, input.ledger.canonicalHost).length,
    },
  };
}

async function loadRuntime(): Promise<{ nextConfig: NextConfigLike; rules: RedirectRule[]; hstsValue: string | null }> {
  const raw: unknown = requireFromHere(NEXT_CONFIG_PATH);
  if (!isObject(raw) || typeof raw.redirects !== "function" || typeof raw.headers !== "function") throw new Error("next.config.js missing redirects()/headers()");
  const nextConfig = raw as unknown as NextConfigLike;
  const rules = parseRedirectRules(await nextConfig.redirects());
  const hstsValue = findHstsValue(await nextConfig.headers());
  return { nextConfig, rules, hstsValue };
}

export async function runStaticValidation(): Promise<Phase2Validation> {
  const ledgerArtifact = parseLedgerArtifact(loadJson(LEDGER_PATH));
  const siteConfig = parseSiteConfig(loadJson(SITE_CONFIG_PATH));
  const decisionLog = readFileSync(DECISION_LOG_PATH, "utf8");
  const runtime = await loadRuntime();
  if (siteConfig.site.rootUrl !== ledgerArtifact.data.canonicalOrigin) {
    return {
      blocks: ["INV-2.1 site config rootUrl != redirect ledger canonicalOrigin"],
      warnings: [],
      stats: { ruleCount: runtime.rules.length, capacityBasisPoints: 0, representativeTraceCount: 0 },
    };
  }
  return validatePhase2Contract({
    rules: runtime.rules,
    ledger: ledgerArtifact.data,
    hstsValue: runtime.hstsValue,
    preloadApproved: hasExplicitHstsPreloadApproval(decisionLog),
    redirectLimit: siteConfig.deployment.redirectLimit,
    redirectCapacityWarnPct: siteConfig.thresholds.redirectCapacityWarnPct,
    trailingSlash: runtime.nextConfig.trailingSlash,
    skipTrailingSlashRedirect: runtime.nextConfig.skipTrailingSlashRedirect,
  });
}

async function probeUrl(id: string, startUrl: string, userAgent: string, maxHops = 6): Promise<LiveProbe> {
  const redirects: LiveProbe["redirects"] = [];
  let current = startUrl;
  let vary: string | null = null;
  let hsts: string | null = null;
  try {
    for (let hop = 0; hop <= maxHops; hop += 1) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": userAgent, accept: "text/html,*/*;q=0.8" },
      });
      vary = response.headers.get("vary");
      hsts = response.headers.get("strict-transport-security");
      if (response.status < 300 || response.status >= 400) {
        await response.body?.cancel();
        return { id, startUrl, userAgent, finalUrl: current, finalStatus: response.status, redirects, vary, hsts, error: null };
      }
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return { id, startUrl, userAgent, finalUrl: current, finalStatus: response.status, redirects, vary, hsts, error: "redirect_without_location" };
      const to = new URL(location, current).toString();
      redirects.push({ status: response.status, from: current, to });
      current = to;
    }
    return { id, startUrl, userAgent, finalUrl: current, finalStatus: null, redirects, vary, hsts, error: "max_hops_exceeded" };
  } catch (error) {
    return { id, startUrl, userAgent, finalUrl: null, finalStatus: null, redirects, vary, hsts, error: error instanceof Error ? error.message : "unknown_fetch_error" };
  }
}

export async function runLiveAudit(): Promise<LiveProbe[]> {
  const ledgerArtifact = parseLedgerArtifact(loadJson(LEDGER_PATH));
  const origin = ledgerArtifact.data.canonicalOrigin;
  const host = ledgerArtifact.data.canonicalHost;
  const targets = [
    ["canonical", `${origin}/`],
    ["http-apex", `http://${host}/`],
    ["https-www", `https://www.${host}/`],
    ["http-www", `http://www.${host}/`],
    ["legacy-methodology", `${origin}/cbam-methodology`],
    ["legacy-methodology-www", `https://www.${host}/cbam-methodology`],
    ["trailing-slash", `${origin}/pricing/`],
    ["case-variant", `${origin}/Pricing`],
  ] as const;
  const agents = [
    "Mozilla/5.0 SEO-V6-Phase2-Audit",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
  ] as const;
  const probes: LiveProbe[] = [];
  for (const [id, url] of targets) for (const userAgent of agents) probes.push(await probeUrl(id, url, userAgent));
  return probes;
}

function parseArgs(argv: string[]): { live: boolean; dryRun: boolean } {
  return { live: argv.includes("--live"), dryRun: argv.includes("--dry-run") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const staticResult = await runStaticValidation();
  console.log(`PHASE2_RULE_COUNT=${staticResult.stats.ruleCount}`);
  console.log(`PHASE2_CAPACITY_BASIS_POINTS=${staticResult.stats.capacityBasisPoints}`);
  console.log(`PHASE2_TRACE_CASES=${staticResult.stats.representativeTraceCount}`);
  for (const warning of staticResult.warnings) console.warn(`WARN ${warning}`);
  for (const block of staticResult.blocks) console.error(`BLOCK ${block}`);
  if (staticResult.blocks.length > 0) process.exit(1);
  console.log(args.dryRun ? "SEO_V6_PHASE2_STATIC=PASS_DRY_RUN" : "SEO_V6_PHASE2_STATIC=PASS");

  if (args.live) {
    const probes = await runLiveAudit();
    console.log(`SEO_V6_PHASE2_LIVE=${JSON.stringify(probes)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(4);
  });
}
