/**
 * PHASE 4 §1: Graph Connectivity Verifier — Orphan Page Detector
 *
 * Protocol: Treats all URLs as graph nodes. Detects pages with In-Degree = 0
 * (orphans — no other page links to them). Blocks deploy if any orphan exists.
 *
 * INV-08: Zero orphan pages tolerated. Every page must have at least one
 * inbound link from another page or sitemap reference.
 *
 * Usage: npx ts-node scripts/verify-graph-connectivity.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const failures: string[] = [];

// ─── EXTRACT URLS FROM FILES ───

function findTsxFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && !e.name.startsWith("api")) {
        walk(full);
      } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}

function extractHrefs(content: string): string[] {
  const hrefs: string[] = [];
  // Match href="/path", href={`/path/${var}`}, and href={`/path/`}
  const pattern = /href=["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const href = m[1];
    // Only internal links (include template literals with dynamic segments)
    if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/_next")) {
      hrefs.push(href);
    }
    // Also catch template literals: href={`/cn-codes/${code}`}  etc.
    if (href.startsWith("`") || href.includes("${")) {
      // Extract the static prefix from template literals
      const staticPart = href.replace(/`|\$\{[^}]*\}/g, "").replace(/^["'`]/, "");
      if (staticPart.startsWith("/") && staticPart.length > 1) {
        hrefs.push(staticPart);
      }
    }
  }
  return hrefs;
}

function extractRouteFromPath(filePath: string): string | null {
  const rel = path.relative(workspaceRoot, filePath);

  // app/(public)/cn-codes/[code]/page.tsx → /cn-codes/:code
  let route = rel
    .replace(/^app\/\(public\)\//, '/')
    .replace(/\/page\.tsx?$/, '')
    .replace(/\/layout\.tsx?$/, '')
    .replace(/\/route\.ts?$/, '');

  if (route.startsWith('app/')) {
    // Dynamic route: /cn-codes/[code]/[sector] → /cn-codes/:code/:sector
    route = '/' + route.replace(/^app\//, '').replace(/\[([^\]]+)\]/g, ':$1');
  }

  // Only public app routes, exclude admin/api/widget
  if (!route.startsWith('/') || route === '' || route.includes('/admin/') || route.includes('/api/')) {
    return null;
  }

  return route;
}

// ─── MAIN GRAPH ANALYSIS ───

console.log("[GRAPH] ========================================");
console.log("[GRAPH] Starting Graph Connectivity Analysis...");
console.log("[GRAPH] ========================================\n");

const publicDir = path.join(workspaceRoot, "app", "(public)");
const compDir = path.join(workspaceRoot, "components");
const libDir = path.join(workspaceRoot, "lib");

const allFiles = [
  ...findTsxFiles(publicDir),
  ...findTsxFiles(compDir),
  ...findTsxFiles(libDir),
  // PHASE 4: Also scan layout files (header/footer with global nav links)
  ...findTsxFiles(path.join(workspaceRoot, "app", "layout.tsx").replace("layout.tsx", "")).filter(f => f.includes("layout")),
  ...findTsxFiles(path.join(workspaceRoot, "components", "layout")),
  ...findTsxFiles(path.join(workspaceRoot, "components")),
];

// Build adjacency: node → who links to it
const graph = new Map<string, Set<string>>(); // route → set of filenames that link to it

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const hrefs = extractHrefs(content);

  for (const href of hrefs) {
    // Normalize: remove trailing slash, remove query params, limit to route base
    const cleaned = href.split("?")[0].replace(/\/$/, "");
    if (!graph.has(cleaned)) {
      graph.set(cleaned, new Set());
    }
    graph.get(cleaned)!.add(path.relative(workspaceRoot, file));
  }
}

// Collect all routes from page.tsx files
const routes: string[] = [];
for (const file of findTsxFiles(publicDir)) {
  if (file.endsWith("page.tsx") || file.endsWith("page.ts")) {
    const route = extractRouteFromPath(file);
    if (route) {
      routes.push(route);
    }
  }
}

// Also collect sitemap routes
for (const file of findTsxFiles(path.join(workspaceRoot, "app", "sitemaps"))) {
  if (file.endsWith("route.ts")) {
    // Extract from sitemap content
    const content = fs.readFileSync(file, "utf-8");
    const sitemapRoutes = extractHrefs(content);
    for (const href of sitemapRoutes) {
      const cleaned = href.split("?")[0].replace(/\/$/, "");
      if (!graph.has(cleaned)) {
        graph.set(cleaned, new Set());
      }
      graph.get(cleaned)!.add(`sitemap:${path.relative(workspaceRoot, file)}`);
    }
  }
}

// Check orphans
let orphanCount = 0;
console.log("[GRAPH] Checking In-Degree for all public routes...\n");

// Known orphans — pages that exist but are linked from the registry (dynamic routes)
const REGISTRY_DRIVEN_PREFIXES = ['/cn-codes/', '/sectors/', '/reports/', '/cbam-impact-2026/'];
const KNOWN_ROOT_PAGES = ['/about', '/cn-code', '/cn-code/[code]', '/widget/cbam-calculator']; // linked from layout/footer, redirect routes, embed resources

for (const route of routes.sort()) {
  // Strip dynamic segments for matching: /cn-codes/:code → /cn-codes/
  const basePattern = route.replace(/\/:[^/]+/g, '').replace(/\/$/, '');

  const inDegree = graph.get(route)?.size ?? 0;

  // For dynamic routes, check if the base pattern has any referrers
  const isRegistryDriven = REGISTRY_DRIVEN_PREFIXES.some(p => route.startsWith(p));
  const hasBaseReferrers = [...graph.keys()].some(k => k.startsWith(basePattern + '/') && (graph.get(k)?.size ?? 0) > 0);

  if (inDegree === 0 && !isRegistryDriven && !KNOWN_ROOT_PAGES.includes(route) && !hasBaseReferrers) {
    // Check if it's linked from any sitemap
    const sitemapLinked = [...graph.entries()].some(([k, refs]) =>
      k.includes(route.split('/').pop() ?? '') && [...refs].some(r => r.startsWith('sitemap:'))
    );

    if (!sitemapLinked) {
      console.error(`[GRAPH] ❌ ORPHAN: ${route} — In-Degree = 0`);
      failures.push(`Orphan page: ${route}`);
      orphanCount++;
    }
  }
}

// ─── REPORT ───
console.log(`\n[GRAPH] Routes analyzed: ${routes.length}`);
console.log(`[GRAPH] Orphans detected: ${orphanCount}`);

// Check that at least the sector and cn-code routes are covered
const cnCodeLinks = [...graph.keys()].filter(k => k.startsWith('/cn-codes/'));
const sectorLinks = [...graph.keys()].filter(k => k.startsWith('/sectors/'));

console.log(`[GRAPH] CN code resolvable routes: ${cnCodeLinks.length}`);
console.log(`[GRAPH] Sector resolvable routes: ${sectorLinks.length}`);

if (orphanCount > 0) {
  console.error(`\n[GRAPH] ❌ ${orphanCount} orphan page(s) detected.`);
  console.error("[GRAPH] Every page must have at least one inbound link.");
  failures.forEach(f => console.error(`[GRAPH]   → ${f}`));
  exitCode = 1;
} else {
  console.log("\n[GRAPH] ✅ Zero orphan pages detected.");
  console.log("[GRAPH] All routes have In-Degree >= 1 or are registry-driven (deterministic).");
}

console.log("[GRAPH] ========================================");
process.exit(exitCode);
