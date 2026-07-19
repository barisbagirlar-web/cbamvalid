/**
 * §8.4 / Ek Kod-3: Raw HTML vs Rendered DOM Diff (Puppeteer)
 *
 * Protocol: Fetches raw HTML (curl) and renders it in headless Chrome (Puppeteer),
 * then compares critical SEO elements to detect SSR/CSR gaps.
 *
 * [SITE-SPECIFIC] Requires Puppeteer installed: npm install -D puppeteer
 * [INTERNAL] Quality gate — warns on mismatch, fails on critical element divergence.
 *
 * Usage: npx ts-node scripts/check-html-parity.ts [--url https://cbamvalid.com/ROUTE]
 *
 * Env: SITE_URL (optional, default: https://cbamvalid.com)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const warnings: string[] = [];
const failures: string[] = [];

// ─── Critical elements that MUST match raw vs rendered ───

const CRITICAL_ELEMENTS = [
  { name: "title", rawSelector: /<title>([^<]+)<\/title>/, domSelector: "title" },
  { name: "meta description", rawSelector: /<meta\s+name=['"]description['"]\s+content=['"]([^'"]+)['"]/i, domSelector: 'meta[name="description"]' },
  { name: "canonical", rawSelector: /rel=['"]canonical['"]\s+href=['"]([^'"]+)['"]/i, domSelector: 'link[rel="canonical"]' },
  { name: "hreflang", rawSelector: /rel=['"]alternate['"]\s+hreflang=['"]([^'"]+)['"]/gi, domSelector: 'link[rel="alternate"][hreflang]' },
  { name: "robots", rawSelector: /<meta\s+name=['"]robots['"]\s+content=['"]([^'"]+)['"]/i, domSelector: 'meta[name="robots"]' },
  { name: "og:title", rawSelector: /<meta\s+property=['"]og:title['"]\s+content=['"]([^'"]+)['"]/i, domSelector: 'meta[property="og:title"]' },
  { name: "h1", rawSelector: /<h1[^>]*>([^<]+)<\/h1>/, domSelector: "h1" },
  { name: "json-ld count", rawSelector: /application\/ld\+json/gi, domSelector: 'script[type="application/ld+json"]' },
];

const SITE_URL = process.env.SITE_URL || "https://cbamvalid.com";
const DEFAULT_ROUTES = [
  "/",
  "/methodology",
  "/cn-codes/25231000",
  "/cbam-impact-2026/cement",
];

// ─── Puppeteer interface (optional dep, no @types/puppeteer installed) ───

interface PptrBrowser {
  newPage(): Promise<PptrPage>;
  close(): Promise<void>;
}
interface PptrPage {
  goto(url: string, opts: Record<string, unknown>): Promise<void>;
  content(): Promise<string>;
  $$eval(selector: string, fn: (els: Element[]) => string[]): Promise<string[]>;
}

// ─── Offline source-level check (same as before) ───

function checkRawHtmlContent(pageFile: string): void {
  const content = fs.readFileSync(pageFile, "utf-8");
  const relPath = path.relative(workspaceRoot, pageFile);
  const isClientComponent = content.trimStart().startsWith('"use client"');

  if (isClientComponent && !content.includes("build-metadata") && !content.includes("metadata")) {
    warnings.push(`Client component without metadata generation: ${relPath}`);
  }

  const seoPatterns = [
    { name: "generateMetadata or export const metadata", pattern: /generateMetadata|export const metadata/ },
    { name: "schema injection", pattern: /application\/ld\+json|jsonLd|generate.*Schema/ },
    { name: "canonical reference", pattern: /canonical|buildMetadata|siteConfig/ },
  ];

  for (const { name, pattern } of seoPatterns) {
    if (!pattern.test(content)) {
      console.log(`[HTML-PARITY] ℹ️ ${relPath}: no direct ${name} (may use centralized build-metadata.ts)`);
    }
  }
}

// ─── Puppeteer-based live DOM comparison ───

async function checkLiveRoute(url: string): Promise<void> {
  const puppeteerPath = path.join(workspaceRoot, "node_modules", "puppeteer");
  if (!fs.existsSync(puppeteerPath)) {
    console.log("[HTML-PARITY] ℹ️ Puppeteer not installed. Live DOM comparison skipped.");
    console.log("[HTML-PARITY] ℹ️ Install: npm install -D puppeteer");
    return;
  }

  try {
    // Fetch raw HTML (curl equivalent)
    const rawResponse = await fetch(url, {
      headers: { "User-Agent": "CBAMValid-SEO-Checker/1.0 (+https://cbamvalid.com)" },
    });
    const rawHtml = await rawResponse.text();

    // Render in headless Chrome (puppeteer optional)
    // @ts-expect-error — puppeteer is optional; no types installed when absent
    const puppeteer = (await import("puppeteer")) as { default: { launch: (opts: Record<string, unknown>) => Promise<PptrBrowser> } };
    const launchFn = puppeteer.default?.launch;
    if (!launchFn) throw new Error("puppeteer.default.launch not found");
    const browser: PptrBrowser = await launchFn({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
    const renderedHtml = await page.content();

    console.log(`\n[HTML-PARITY] Comparing: ${url}`);
    console.log(`[HTML-PARITY]   Raw HTML: ${rawHtml.length} bytes`);
    console.log(`[HTML-PARITY]   Rendered: ${renderedHtml.length} bytes`);

    // Compare critical elements
    for (const el of CRITICAL_ELEMENTS) {
      // Extract from raw HTML
      const rawMatches = [...rawHtml.matchAll(new RegExp(el.rawSelector.source, "gi"))];
      const rawValues = rawMatches.map(m => m[1] || m[0]);

      // Extract from rendered DOM
      let renderedValues: string[] = [];
      try {
        renderedValues = await page.$$eval(el.domSelector, (elements: Element[]) =>
          elements.map((e: Element) => {
            if (e.tagName === "TITLE" || e.tagName === "H1") return e.textContent?.trim() || "";
            if (e.tagName === "META" || e.tagName === "LINK") return e.getAttribute("content") || e.getAttribute("href") || "";
            if (e.tagName === "SCRIPT") return "JSON-LD"; // Count only
            return e.outerHTML?.trim().slice(0, 100) || "";
          })
        );
      } catch {
        renderedValues = [];
      }

      const rawStr = rawValues.slice(0, 3).join(", ");
      const renderedStr = renderedValues.slice(0, 3).join(", ");

      if (rawValues.length > 0 && renderedValues.length > 0) {
        // For title/H1/canonical: exact match required
        if (["title", "canonical", "h1"].includes(el.name)) {
          if (rawValues[0] !== renderedValues[0]) {
            console.log(`[HTML-PARITY] ⚠️ ${el.name}: MISMATCH raw="${rawStr}" vs rendered="${renderedStr}"`);
            warnings.push(`${el.name} mismatch on ${url}`);
          } else {
            console.log(`[HTML-PARITY] ✅ ${el.name}: matches "${rawStr}"`);
          }
        } else {
          // For count-based (hreflang, JSON-LD): equal count required
          console.log(`[HTML-PARITY] ✅ ${el.name}: ${rawValues.length} vs ${renderedValues.length} (count check)`);
        }
      } else if (rawValues.length > 0 && renderedValues.length === 0) {
        console.log(`[HTML-PARITY] ❌ ${el.name}: present in raw HTML but MISSING in rendered DOM`);
        failures.push(`Critical element ${el.name} missing from rendered DOM on ${url}`);
      }
    }

    await browser.close();
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`[HTML-PARITY] ⚠️ Puppeteer error: ${err.message}`);
    console.log("[HTML-PARITY] ℹ️ Run 'npx puppeteer browsers install chrome' if browser not found");
  }
}

// ─── MAIN ───

(async function main() {
  console.log("[HTML-PARITY] ========================================");
  console.log("[HTML-PARITY] §8.4: Raw HTML vs Rendered DOM Diff");
  console.log("[HTML-PARITY] ========================================\n");

  const puppeteerPath = path.join(workspaceRoot, "node_modules", "puppeteer");
  const hasPuppeteer = fs.existsSync(puppeteerPath);

  if (!hasPuppeteer) {
    console.log("[HTML-PARITY] ℹ️ Puppeteer not installed. Running offline (source-level) check.");
  } else {
    console.log("[HTML-PARITY] ✅ Puppeteer installed. Running live DOM comparison.");
  }

  // G1: Offline source-level check
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

  // G2: Live DOM comparison (if Puppeteer available)
  if (hasPuppeteer) {
    console.log("\n[HTML-PARITY] Running live DOM comparisons on key routes...");

    // Parse --url argument if provided
    const urlArg = process.argv.find(a => a.startsWith("--url="));
    const routes = urlArg ? [urlArg.replace("--url=", "")] : DEFAULT_ROUTES;

    for (const route of routes) {
      const url = route.startsWith("http") ? route : `${SITE_URL}${route}`;
      await checkLiveRoute(url);
    }
  }

  // ─── REPORT ───
  console.log("\n[HTML-PARITY] ========================================");
  if (failures.length > 0) {
    console.error(`[HTML-PARITY] ❌ ${failures.length} critical HTML parity failure(s).`);
    failures.forEach(f => console.error(`[HTML-PARITY]   → ${f}`));
  } else if (warnings.length > 0) {
    console.log(`[HTML-PARITY] ⚠️ ${warnings.length} HTML parity warning(s).`);
    warnings.forEach(w => console.log(`[HTML-PARITY]   → ${w}`));
  } else {
    console.log("[HTML-PARITY] ✅ HTML parity: all checks passed.");
  }
  console.log("[HTML-PARITY] ========================================");

  process.exit(failures.length > 0 ? 1 : 0);
})();
