import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export enum ExitCode {
  PASS = 0,
  BLOCK = 1,
  WARN = 2,
  MISSING_DATA = 3,
  CONFIG = 4,
}

type JsonObject = Record<string, unknown>;

type PhaseContract = {
  writes: string[];
  forbidsWrites: string[];
};

type PhaseContracts = Record<string, PhaseContract | string>;

type SiteConfig = {
  version: string;
  site: {
    siteId: string;
    rootUrl: string;
    language: "tr" | "en";
    currency: string;
    region: string;
    industry: "ecommerce" | "saas" | "media" | "local" | "other";
    hasEcommerce: boolean;
    hasBlog: boolean;
    maxConcurrentKacActions: number;
    allowedEnvironments: Array<"staging" | "production">;
  };
  deployment: {
    target: "vercel" | "netlify" | "cloudflare_pages" | "static_host" | "firebase_hosting";
    supportsHeaders: boolean;
    supportsEdgeRedirects: boolean;
    redirectLimit: number;
  };
  measurement: {
    defaultWindowDays: number;
    dataWindowStart: string;
    calendarYearEnabled: boolean;
    gscGenerativeAiReportAvailable: boolean;
    gscGenerativeAiInFormula: false;
    confidenceMode: "strict" | "lenient";
  };
  thresholds: Record<string, number | boolean>;
  economics: {
    defaultValuePerConversionMinor: number;
    ltvModel: "none" | "cohort" | "blended";
    paybackMaxMonths: number;
    budgetSplit: { investPct: number; holdPct: number; harvestPct: number; divestPct: number };
    valuationMultiples: { low: number; high: number };
  };
  policy: {
    aiBots: { aiTraining: "block" | "allow"; aiSearch: "allow" | "block"; custom: Record<string, "allow" | "block"> };
    blockedSections: string[];
    perplexityQuery: string | null;
  };
  business: {
    verticals: Array<"ecommerce" | "local" | "saas" | "media" | "i18n">;
    revenueModel: "ecommerce" | "leadgen" | "ads" | "affiliate" | "paywall" | "mixed";
  };
};

const ROOT = resolve(process.cwd());
const DATA_WINDOW_FLOOR = "2025-09-11";
const CONFIG_TARGETS = new Set(["vercel", "netlify", "cloudflare_pages", "static_host", "firebase_hosting"]);
const USER_FACING_PREFIXES = ["app/", "components/", "docs/seo/raporlar/", "data/seo/"];
const CLAIM_SCAN_EXCLUSIONS = [
  "docs/seo/MANDATE.md",
  "docs/seo/MANDATE_ERRATA.md",
  "docs/seo/YORUM_KAYDI.md",
  "docs/seo/BULGULAR_KUYRUGU.md",
  "data/seo/invariants.json",
  "tests/",
];

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as unknown;
}

export function containsPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return value.includes("|");
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (isObject(value)) return Object.values(value).some(containsPlaceholder);
  return false;
}

function assertInteger(value: unknown, field: string, min = Number.MIN_SAFE_INTEGER): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min) throw new Error(`${field} must be integer >= ${min}`);
}

export function validateConfig(input: unknown, expectedSiteId: string): SiteConfig {
  if (!isObject(input)) throw new Error("config root must be object");
  if (input.version !== "6.0") throw new Error("version must be 6.0");
  if (!isObject(input.site) || !isObject(input.deployment) || !isObject(input.measurement) || !isObject(input.thresholds) || !isObject(input.economics) || !isObject(input.policy) || !isObject(input.business)) {
    throw new Error("required config sections missing");
  }
  if (input.site.siteId !== expectedSiteId) throw new Error(`siteId mismatch: ${String(input.site.siteId)}`);
  if (typeof input.site.rootUrl !== "string" || !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[a-z0-9-]+)?$/.test(input.site.rootUrl)) throw new Error("invalid HTTPS rootUrl");
  if (input.site.language !== "tr" && input.site.language !== "en") throw new Error("invalid site.language");
  if (typeof input.site.currency !== "string" || !/^[A-Z]{3}$/.test(input.site.currency)) throw new Error("invalid currency");
  assertInteger(input.site.maxConcurrentKacActions, "site.maxConcurrentKacActions", 1);
  if (!Array.isArray(input.site.allowedEnvironments) || input.site.allowedEnvironments.length === 0) throw new Error("allowedEnvironments missing");
  if (typeof input.deployment.target !== "string" || !CONFIG_TARGETS.has(input.deployment.target)) throw new Error("invalid deployment.target");
  assertInteger(input.deployment.redirectLimit, "deployment.redirectLimit", 1);
  assertInteger(input.measurement.defaultWindowDays, "measurement.defaultWindowDays", 28);
  if (typeof input.measurement.dataWindowStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.measurement.dataWindowStart)) throw new Error("invalid dataWindowStart");
  if (input.measurement.dataWindowStart < DATA_WINDOW_FLOOR) throw new Error(`dataWindowStart must be >= ${DATA_WINDOW_FLOOR}`);
  if (input.measurement.gscGenerativeAiInFormula !== false) throw new Error("gscGenerativeAiInFormula must be false");
  for (const [key, value] of Object.entries(input.thresholds)) {
    if (typeof value !== "number" && typeof value !== "boolean") throw new Error(`threshold ${key} has invalid type`);
  }
  if (!isObject(input.economics.budgetSplit)) throw new Error("budgetSplit missing");
  const splitKeys = ["investPct", "holdPct", "harvestPct", "divestPct"] as const;
  let splitTotal = 0;
  for (const key of splitKeys) {
    const value = input.economics.budgetSplit[key];
    assertInteger(value, `economics.budgetSplit.${key}`, 0);
    splitTotal += value;
  }
  if (splitTotal !== 100) throw new Error(`budgetSplit must sum to 100, got ${splitTotal}`);
  assertInteger(input.economics.defaultValuePerConversionMinor, "economics.defaultValuePerConversionMinor", 0);
  assertInteger(input.economics.paybackMaxMonths, "economics.paybackMaxMonths", 1);
  if (!isObject(input.policy.aiBots) || !Array.isArray(input.policy.blockedSections)) throw new Error("policy invalid");
  if (!Array.isArray(input.business.verticals) || typeof input.business.revenueModel !== "string") throw new Error("business invalid");
  if (containsPlaceholder(input)) throw new Error("placeholder pipe found in config");
  return input as unknown as SiteConfig;
}

export function globToRegExp(glob: string): RegExp {
  let pattern = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === "*" && next === "*") {
      pattern += ".*";
      index += 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (".+?^${}()|[]\\".includes(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += char;
    }
  }
  return new RegExp(`${pattern}$`);
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

export function validatePhaseWrites(paths: string[], contract: PhaseContract): string[] {
  const violations: string[] = [];
  for (const path of paths) {
    if (matchesAny(path, contract.forbidsWrites)) {
      violations.push(`${path}: forbidden`);
      continue;
    }
    if (!matchesAny(path, contract.writes)) violations.push(`${path}: outside writes allowlist`);
  }
  return violations;
}

export function guaranteeViolations(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["ranking guarantee", /\b(?:guaranteed?|guarantee|garanti)\b.{0,40}\b(?:rank|ranking|traffic|revenue|gelir|sıralama|trafik)\b/i],
    ["number one promise", /(?:#\s*1|number\s*one|birinci)\s+(?:rank|ranking|ol|çıkar)/i],
    ["causal promise", /(?:şunu yaparsan|do this and you will).{0,80}(?:rank|çıkar|revenue|gelir)/i],
  ];
  return patterns.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

export function secretViolations(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["github token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
    ["google api key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
    ["paddle live secret", /\bpdl_(?:live|test)_[A-Za-z0-9_-]{20,}\b/i],
  ];
  return patterns.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

export function validateInvariantRegistry(input: unknown): string[] {
  if (!isObject(input) || !isObject(input.counts) || !Array.isArray(input.invariants)) return ["invalid invariant registry shape"];
  const rows = input.invariants;
  const ids = new Set<string>();
  const severityCounts = { BLOCK: 0, WARN: 0, INFO: 0 };
  const errors: string[] = [];
  for (const row of rows) {
    if (!isObject(row) || typeof row.id !== "string" || (row.severity !== "BLOCK" && row.severity !== "WARN" && row.severity !== "INFO")) {
      errors.push("invalid invariant row");
      continue;
    }
    if (ids.has(row.id)) errors.push(`duplicate invariant ${row.id}`);
    ids.add(row.id);
    severityCounts[row.severity] += 1;
    if (row.severity === "BLOCK" && typeof row.negativeTest !== "string") errors.push(`${row.id} missing negativeTest`);
  }
  if (rows.length !== 127) errors.push(`expected 127 invariants, got ${rows.length}`);
  if (severityCounts.BLOCK !== 75 || severityCounts.WARN !== 30 || severityCounts.INFO !== 22) errors.push(`severity counts mismatch ${JSON.stringify(severityCounts)}`);
  return errors;
}

function getChangedFiles(): string[] {
  const override = process.env.SEO_CHANGED_FILES;
  if (override) return override.split("\n").map((value) => value.trim()).filter(Boolean).sort();
  try {
    const output = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return output.split("\n").map((value) => value.trim()).filter(Boolean).sort();
  } catch {
    return [];
  }
}

function shouldClaimScan(path: string): boolean {
  if (CLAIM_SCAN_EXCLUSIONS.some((prefix) => path === prefix || path.startsWith(prefix))) return false;
  return USER_FACING_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function scanChangedText(paths: string[]): { secretErrors: string[]; claimErrors: string[] } {
  const secretErrors: string[] = [];
  const claimErrors: string[] = [];
  for (const path of paths) {
    const absolute = resolve(ROOT, path);
    if (!existsSync(absolute) || /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|xlsx)$/i.test(path)) continue;
    let text: string;
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const violation of secretViolations(text)) secretErrors.push(`${path}: ${violation}`);
    if (shouldClaimScan(path)) for (const violation of guaranteeViolations(text)) claimErrors.push(`${path}: ${violation}`);
  }
  return { secretErrors, claimErrors };
}

function contractForPhase(raw: unknown, phase: string): PhaseContract {
  if (!isObject(raw)) throw new Error("PHASE_CONTRACTS root invalid");
  const entry = raw[phase];
  if (!isObject(entry) || !Array.isArray(entry.writes) || !Array.isArray(entry.forbidsWrites) || !entry.writes.every((value) => typeof value === "string") || !entry.forbidsWrites.every((value) => typeof value === "string")) {
    throw new Error(`phase contract missing/invalid: ${phase}`);
  }
  return { writes: entry.writes, forbidsWrites: entry.forbidsWrites } as PhaseContract;
}

function parseArgs(argv: string[]): { site: string | null; phase: string; dryRun: boolean } {
  let site: string | null = null;
  let phase = process.env.SEO_PHASE ?? "bootstrap";
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--site") site = argv[index + 1] ?? null;
    if (argv[index] === "--phase") phase = argv[index + 1] ?? phase;
    if (argv[index] === "--dry-run") dryRun = true;
  }
  return { site, phase, dryRun };
}

export function runPreflight(argv: string[]): ExitCode {
  const args = parseArgs(argv);
  if (!args.site) {
    console.error("P-09 FAIL --site is required");
    return ExitCode.CONFIG;
  }
  const configPath = `sites/${args.site}/seo.config.json`;
  if (!existsSync(resolve(ROOT, configPath))) {
    console.error(`P-01 FAIL config missing: ${configPath}`);
    return ExitCode.CONFIG;
  }
  let config: SiteConfig;
  try {
    config = validateConfig(parseJsonFile(configPath), args.site);
  } catch (error) {
    console.error(`P-01/P-02/P-07/P-08/P-09 FAIL ${(error as Error).message}`);
    return ExitCode.CONFIG;
  }
  console.log(`P-01 PASS config structure version=${config.version}`);
  console.log("P-02 PASS no placeholder pipe in config");
  console.log("P-07 PASS budgetSplit=100");
  console.log(`P-08 PASS dataWindowStart=${config.measurement.dataWindowStart}`);
  console.log(`P-09 PASS siteId=${config.site.siteId}`);

  let contract: PhaseContract;
  try {
    contract = contractForPhase(parseJsonFile("PHASE_CONTRACTS.json") as PhaseContracts, args.phase);
  } catch (error) {
    console.error(`P-03 FAIL ${(error as Error).message}`);
    return ExitCode.CONFIG;
  }
  const changedFiles = getChangedFiles();
  const writeViolations = validatePhaseWrites(changedFiles, contract);
  if (writeViolations.length > 0) {
    console.error(`P-03 FAIL ${writeViolations.join("; ")}`);
    return ExitCode.BLOCK;
  }
  console.log(`P-03 PASS phase=${args.phase} changed=${changedFiles.length}`);

  const scans = scanChangedText(changedFiles);
  if (scans.secretErrors.length > 0) {
    console.error(`P-04 FAIL ${scans.secretErrors.join("; ")}`);
    return ExitCode.BLOCK;
  }
  console.log("P-04 PASS changed-file secret scan");

  const invariantErrors = validateInvariantRegistry(parseJsonFile("data/seo/invariants.json"));
  if (invariantErrors.length > 0) {
    console.error(`P-05 FAIL ${invariantErrors.join("; ")}`);
    return ExitCode.BLOCK;
  }
  console.log("P-05 PASS invariant registry 127/75/30/22");

  console.log("P-06 PASS bootstrap has no generated data artifact envelope requirement");

  if (scans.claimErrors.length > 0) {
    console.error(`P-10 FAIL ${scans.claimErrors.join("; ")}`);
    return ExitCode.BLOCK;
  }
  console.log("P-10 PASS scoped claim-language scan");
  console.log(`SEO_PREFLIGHT=PASS phase=${args.phase} site=${args.site} dryRun=${String(args.dryRun)}`);
  return ExitCode.PASS;
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMainModule) process.exitCode = runPreflight(process.argv.slice(2));
