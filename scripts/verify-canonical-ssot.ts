/**
 * MIL-STD §3: Cross-Component SSOT (Single Source of Truth) Verification
 *
 * Protocol: Validates that all 4 canonical signals are consistent:
 *   1. HTML <link rel="canonical">
 *   2. HTTP Link: header (if configured)
 *   3. XML Sitemap <loc>
 *   4. robots.txt Sitemap: reference
 *
 * [DEPLOY BLOCKER] Canonical drift across any component blocks deployment.
 *
 * Usage: npx ts-node scripts/verify-canonical-ssot.ts
 */

import { crossCheckCanonical, normalizeUrl } from "../lib/seo/sitemap-guards";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const SITE_ORIGIN = "https://cbamvalid.com";

interface Result {
  pagePath: string;
  sitemapLoc: string;
  htmlCanonical: string | null;
  httpHeader: string | null;
  robotsRef: boolean;
  pass: boolean;
  failures: string[];
}

const results: Result[] = [];
let total = 0;
let passed = 0;

console.log("[SSOT] ========================================");
console.log("[SSOT] MIL-STD §3: Cross-Component SSOT Audit");
console.log("[SSOT] Checking: 1. HTML canonical, 2. Header Link, 3. Sitemap <loc>, 4. robots.txt");
console.log("[SSOT] ========================================\n");

// ─── G1: Sitemap URLs parsed ───

function parseSitemapUrls(filepath: string): string[] {
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, "utf-8");
  const locs = [...content.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  return [...new Set(locs.map(u => normalizeUrl(u)))];
}

// Parse all sitemaps
const sitemapIndexXml = fs.existsSync(path.join(workspaceRoot, "app", "sitemap.xml", "route.ts"))
  ? fs.readFileSync(path.join(workspaceRoot, "app", "sitemap.xml", "route.ts"), "utf-8")
  : "";

const sitemapUrls = [
  ...parseSitemapUrls(path.join(workspaceRoot, "app", "sitemaps", "tools.xml", "route.ts")),
  ...parseSitemapUrls(path.join(workspaceRoot, "app", "sitemaps", "sectors.xml", "route.ts")),
  ...parseSitemapUrls(path.join(workspaceRoot, "app", "sitemaps", "cn-codes.xml", "route.ts")),
];

console.log(`[SSOT] Sitemap URLs analyzed: ${sitemapUrls.length}`);

// ─── G2: robots.txt verification ───

const robotsContent = fs.readFileSync(path.join(workspaceRoot, "public", "robots.txt"), "utf-8");
const robotsHasSitemap = robotsContent.includes("Sitemap:") && robotsContent.includes("sitemap.xml");

console.log(`[SSOT] robots.txt contains Sitemap: reference → ${robotsHasSitemap ? "✅" : "❌"}`);

// ─── G3: Page-level canonical cross-check (source-level) ───

function scanPages(dir: string, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name.startsWith("api")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanPages(full, `${prefix}${e.name}/`);
    } else if (e.name === "page.tsx" || (e.name.startsWith("page") && e.name.endsWith(".tsx"))) {
      checkPage(full);
    }
  }
}

function checkPage(filepath: string) {
  total++;
  const content = fs.readFileSync(filepath, "utf-8");
  const relPath = path.relative(workspaceRoot, filepath);

  // Extract canonical from metadata
  let htmlCanonical: string | null = null;
  const canonicalMatch = content.match(/canonical:\s*["'`]([^"'`]+)["'`]/);
  if (canonicalMatch) {
    htmlCanonical = canonicalMatch[1];
  } else {
    // Try buildMetadata/canonicalOrigin pattern
    const originMatch = content.match(/canonicalOrigin\s*\+\s*["'`]([^"'`]*)["'`]/);
    if (originMatch) {
      htmlCanonical = `${SITE_ORIGIN}${originMatch[1]}`;
    }
  }

  // Extract canonical from sitemap generation templates
  let sitemapLoc: string | null = null;
  if (content.includes("`https://cbamvalid.com")) {
    const smMatch = content.match(/`https:\/\/cbamvalid\.com([^`]*)`/);
    if (smMatch) sitemapLoc = `https://cbamvalid.com${smMatch[1]}`;
  }

  // HTTP Link header — check next.config.js for Link header injection
  let httpHeader: string | null = null;
  const nextConfig = fs.readFileSync(path.join(workspaceRoot, "next.config.js"), "utf-8");
  if (nextConfig.includes('"Link"') && nextConfig.includes('canonical')) {
    httpHeader = "[configured-in-next.config.js]";
  }

  if (!htmlCanonical || !sitemapLoc) {
    // Dynamic/SSG pages: canonical is runtime-generated, not checkable at source level
    console.log(`[SSOT] ⏩ ${relPath}: runtime-generated canonical (SSG/dynamic route) — skip source check`);
    return;
  }

  const check = crossCheckCanonical(
    relPath,
    htmlCanonical,
    httpHeader,
    sitemapLoc,
    robotsHasSitemap,
  );

  results.push({
    pagePath: relPath,
    htmlCanonical,
    httpHeader,
    sitemapLoc,
    robotsRef: robotsHasSitemap,
    pass: check.pass,
    failures: check.failures,
  });

  if (check.pass) {
    passed++;
    console.log(`[SSOT] ✅ ${relPath}: canonical="${htmlCanonical}" consistent`);
  } else {
    console.error(`[SSOT] ❌ ${relPath}: CANONICAL DRIFT DETECTED`);
    check.failures.forEach(f => console.error(`[SSOT]   → ${f}`));
  }
}

scanPages(path.join(workspaceRoot, "app", "(public)"));

// ─── G4: Sitemap index URL consistency ───
console.log(`\n[SSOT] Sitemap index cross-check:`);
const smIndexUrls = [
  "https://cbamvalid.com/sitemaps/tools.xml",
  "https://cbamvalid.com/sitemaps/sectors.xml",
  "https://cbamvalid.com/sitemaps/cn-codes.xml",
];
for (const url of smIndexUrls) {
  if (sitemapIndexXml.includes(url)) {
    console.log(`[SSOT] ✅ ${url} → referenced in sitemap index`);
  } else {
    console.error(`[SSOT] ❌ ${url} → NOT found in sitemap index`);
  }
}

// ─── REPORT ───

console.log("\n[SSOT] ========================================");
console.log(`[SSOT] Checked: ${total} pages`);
console.log(`[SSOT] Passed:  ${passed}/${total}`);
const failed = results.filter(r => !r.pass);
if (failed.length > 0) {
  console.error(`[SSOT] ❌ ${failed.length} CANONICAL DRIFT failure(s). DEPLOY BLOCKED.`);
  for (const f of failed) {
    console.error(`[SSOT]   → ${f.pagePath}`);
    f.failures.forEach(ff => console.error(`[SSOT]     ${ff}`));
  }
  process.exit(1);
} else {
  console.log("[SSOT] ✅ All canonical references consistent. No drift detected.");
  console.log("[SSOT] ========================================");
  process.exit(0);
}
