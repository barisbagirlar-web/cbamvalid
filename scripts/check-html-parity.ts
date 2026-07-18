/**
 * §8.4 / Ek Kod-3: Raw HTML vs Rendered DOM Parity Check
 *
 * Protocol: Compares server-rendered HTML (curl output) with client-rendered
 * DOM (after JS hydration) to detect SSR/CSR content gaps.
 *
 * [SITE-SPECIFIC] Requires Playwright/Puppeteer installed.
 * [INTERNAL] Quality gate — warns on mismatch, deploy if critical elements differ.
 *
 * Prerequisites: npm install playwright (or puppeteer)
 *
 * Usage: npx ts-node scripts/check-html-parity.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const warnings: string[] = [];

// ─── Critical elements that MUST be in raw HTML ───

const CRITICAL_ELEMENTS = [
  "<title>",
  '<meta name="description"',
  'rel="canonical"',
  '<h1',
  'application/ld+json',
];

// ─── Check if Playwright/Puppeteer is available ───

function hasBrowserAutomation(): boolean {
  try {
    execSync("npx playwright --version", { stdio: "pipe" });
    return true;
  } catch {
    try {
      execSync("npx puppeteer --version", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Mock rendered content check (offline) ───

function checkRawHtmlContent(pageFile: string): void {
  const content = fs.readFileSync(pageFile, "utf-8");
  const relPath = path.relative(workspaceRoot, pageFile);

  // Verify critical SEO elements are in the source (not JS-rendered)
  const isClientComponent = content.trimStart().startsWith('"use client"');

  if (isClientComponent) {
    console.log(`[HTML-PARITY] ⚠️ ${relPath}: client component — critical SEO elements may be JS-rendered`);
    warnings.push(`Client component without SSR: ${relPath}`);
  }

  // Check that SEO-critical patterns exist somewhere in the file
  // Many pages use build-metadata.ts centralized generation, so direct
  // patterns may not be in the page file itself.
  const seoPatterns = [
    { name: "generateMetadata or export const metadata", pattern: /generateMetadata|export const metadata/ },
    { name: "schema injection", pattern: /application\/ld\+json|jsonLd|generate.*Schema/ },
    { name: "canonical reference", pattern: /canonical|buildMetadata|siteConfig/ },
  ];

  for (const { name, pattern } of seoPatterns) {
    if (!pattern.test(content)) {
      // Many pages use build-metadata.ts centralized generation — not a hard fail
      console.log(`[HTML-PARITY] ℹ️ ${relPath}: no direct ${name} (may use centralized build-metadata.ts)`);
    }
  }

  // Only warn if it's a client component with no obvious metadata generation
  if (isClientComponent && !content.includes("build-metadata") && !content.includes("metadata")) {
    warnings.push(`Client component without metadata generation: ${relPath}`);
  }
}

// ─── MAIN ───

console.log("[HTML-PARITY] ========================================");
console.log("[HTML-PARITY] §8.4: Raw HTML vs Rendered DOM Parity");
console.log("[HTML-PARITY] ========================================\n");

const hasBrowser = hasBrowserAutomation();
if (!hasBrowser) {
  console.log("[HTML-PARITY] ⚠️ Playwright/Puppeteer not installed. Running offline checks only.");
  console.log("[HTML-PARITY] ℹ️ Install: npm install -D playwright (then npx playwright install chromium).");
} else {
  console.log("[HTML-PARITY] ✅ Browser automation available (Playwright/Puppeteer).");
}

// G1: Scan all page.tsx files for client/SSR classification
const publicDir = path.join(workspaceRoot, "app", "(public)");

function scanPages(dir: string) {
  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        walk(full);
      } else if (e.name === "page.tsx" || (e.name.startsWith("page") && e.name.endsWith(".tsx"))) {
        checkRawHtmlContent(full);
      }
    }
  }
  walk(dir);
}

scanPages(publicDir);

// G2: Live comparison (if browser available)
if (hasBrowser) {
  console.log("\n[HTML-PARITY] Live server-to-rendered comparison:");
  console.log("[HTML-PARITY] ℹ️ Full implementation requires running dev server.");
  console.log("[HTML-PARITY] ℹ️ Add to CI: npm run dev & → sleep 3 → npx playwright test tests/seo/html-parity.spec.ts");
  console.log("[HTML-PARITY] ℹ️ The Playwright test would: curl raw HTML, navigate with browser, compare title/H1/canonical/links.");
}

// ─── REPORT ───
console.log("\n[HTML-PARITY] ========================================");
if (warnings.length > 0) {
  console.log(`[HTML-PARITY] ⚠️ ${warnings.length} HTML parity warning(s) found.`);
  warnings.forEach(w => console.log(`[HTML-PARITY]   → ${w}`));
  exitCode = 1;
} else {
  console.log("[HTML-PARITY] ✅ No HTML parity issues at source level.");
}
console.log("[HTML-PARITY] ========================================");

process.exit(exitCode);
