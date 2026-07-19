/**
 * MIL-STD §2: Dirty URL Firewall — Full 6-Node Implementation
 *
 * Node 1: HTTP Status Validation
 * Node 2: Canonical Link Header Cross-Check
 * Node 3: Noindex Detection (X-Robots-Tag + meta robots)
 * Node 4: Content-Type Validation (must be text/html)
 * Node 5: Redirect Chain Detection (GET with redirect: "follow" → count intermediate hops)
 * Node 6: Soft-404 Detection (body size, content signals)
 *
 * [INTERNAL] Quality gate — flags, does NOT single-block deploy
 *            (network-dependent, could fail transiently).
 *
 * Usage: npx tsx scripts/sitemap-dirty-firewall.ts [--sample 50] [--live]
 *   --sample N : test N random sitemap URLs live
 *   --live     : fetch live sitemap from production (default: parse source)
 */

import { normalizeUrl } from "../lib/seo/sitemap-guards";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const SITE_ORIGIN = "https://cbamvalid.com";

interface UrlCheck {
  url: string;
  status: number | null;
  redirectChain: number;
  hasNoindex: boolean;
  hasNoindexHeader: boolean;
  hasNoindexMeta: boolean;
  contentType: string | null;
  canonicalMatch: boolean;
  contentSize: number;
  soft404: boolean;
  pass: boolean;
  failures: string[];
}

// ─── Offline: parse sitemap source code ───

function parseSitemapUrlsFromSource(): string[] {
  const urls: string[] = [];
  for (const f of ["tools.xml", "sectors.xml", "cn-codes.xml"]) {
    const fp = path.join(workspaceRoot, "app", "sitemaps", f, "route.ts");
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, "utf-8");
    const locs = [...content.matchAll(/https:\/\/cbamvalid\.com\/[^"'`\s]+/g)].map(m => m[0]);
    urls.push(...locs);
  }
  return [...new Set(urls.map(u => normalizeUrl(u)))];
}

async function fetchLiveSitemap(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "CBAMValid-DirtyFirewall/2.0 (+https://cbamvalid.com)" },
  });
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  return [...new Set(locs.map(u => normalizeUrl(u)))];
}

// ─── §6 Soft-404 Detection ───

const SOFT_404_SIGNALS: RegExp[] = [
  /(no results found|nothing to show|not found|doesn't exist|page not found)/i,
  /\b404\b/,
  /(empty|blank)\s+page/i,
];

function detectSoft404(html: string, contentLength: number, url: string): boolean {
  // Heuristic: very small pages (<500 bytes) are suspicious
  if (contentLength < 500 && !url.endsWith("/")) return true;
  // Check for soft-404 text signals
  for (const pattern of SOFT_404_SIGNALS) {
    if (pattern.test(html.slice(0, 8192))) return true;
  }
  return false;
}

// ─── Dirty URL firewall checks (all 6 nodes) ───

async function checkUrl(url: string, index: number, total: number): Promise<UrlCheck> {
  const check: UrlCheck = {
    url,
    status: null,
    redirectChain: 0,
    hasNoindex: false,
    hasNoindexHeader: false,
    hasNoindexMeta: false,
    contentType: null,
    canonicalMatch: false,
    contentSize: 0,
    soft404: false,
    pass: true,
    failures: [],
  };

  try {
    // NODE 1 + 5: GET with redirect tracking (not HEAD — to detect chains)
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual", // Don't auto-follow — count manually
      headers: {
        "User-Agent": "CBAMValid-DirtyFirewall/2.0 (+https://cbamvalid.com)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    // NODE 5: Count redirect chain
    let currentRes = res;
    while (
      currentRes.status === 301 || currentRes.status === 302 ||
      currentRes.status === 303 || currentRes.status === 307 || currentRes.status === 308
    ) {
      check.redirectChain++;
      const location = currentRes.headers.get("location");
      if (!location) break;
      if (check.redirectChain > 5) {
        check.pass = false;
        check.failures.push(`NODE 5: Redirect chain exceeded 5 hops → crawl budget waste`);
        break;
      }
      try {
        currentRes = await fetch(location, {
          method: "GET",
          redirect: "manual",
          headers: { "User-Agent": "CBAMValid-DirtyFirewall/2.0 (+https://cbamvalid.com)" },
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        check.pass = false;
        check.failures.push(`NODE 5: Redirect chain broken at hop ${check.redirectChain}`);
        break;
      }
    }

    check.status = currentRes.status;

    // NODE 1: HTTP Status
    if (check.status !== 200) {
      check.pass = false;
      check.failures.push(`NODE 1: HTTP ${check.status} — expected 200`);
    }

    // NODE 5 continued: Warn on redirects
    if (check.redirectChain > 0) {
      check.pass = false;
      check.failures.push(`NODE 5: ${check.redirectChain} redirect(s) — wastes crawl budget`);
    }

    // NODE 4: Content-Type
    check.contentType = currentRes.headers.get("content-type") ?? null;
    if (check.contentType && !check.contentType.includes("text/html")) {
      check.pass = false;
      check.failures.push(`NODE 4: Content-Type "${check.contentType}" — expected text/html`);
    }

    // NODE 2: Canonical Link header Check
    const linkHeader = currentRes.headers.get("link");
    if (linkHeader) {
      const canonicalMatch = linkHeader.match(/<([^>]+)>;\s*rel="canonical"/);
      if (canonicalMatch) {
        const headerCanonical = normalizeUrl(canonicalMatch[1]);
        const urlNormalized = normalizeUrl(url);
        check.canonicalMatch = headerCanonical === urlNormalized;
        if (!check.canonicalMatch) {
          check.pass = false;
          check.failures.push(`NODE 2: HTTP Link canonical "${headerCanonical}" ≠ URL "${urlNormalized}"`);
        }
      }
    }

    // NODE 3: Noindex detection
    // 3a: X-Robots-Tag header
    const robotsHeader = currentRes.headers.get("x-robots-tag") ?? "";
    if (robotsHeader.includes("noindex")) {
      check.hasNoindex = true;
      check.hasNoindexHeader = true;
    }

    // 3b: meta robots in HTML body
    if (check.contentType?.includes("text/html")) {
      const body = await currentRes.text();
      check.contentSize = body.length;

      if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex[^"']*["']/i.test(body)
          || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(body)) {
        check.hasNoindex = true;
        check.hasNoindexMeta = true;
      }

      // NODE 6: Soft-404 detection
      check.soft404 = detectSoft404(body, body.length, url);
      if (check.soft404) {
        check.pass = false;
        check.failures.push(`NODE 6: Soft-404 detected — ${body.length}B body with close-class signals`);
      }
    }

    if (check.hasNoindex) {
      check.pass = false;
      const sources = [
        check.hasNoindexHeader ? "X-Robots-Tag header" : "",
        check.hasNoindexMeta ? "meta robots tag" : "",
      ].filter(Boolean).join(", ");
      check.failures.push(`NODE 3: Noindex detected via ${sources} — page should not be in sitemap`);
    }

  } catch (err: unknown) {
    const e = err as Error;
    check.pass = false;
    check.failures.push(`Request failed: ${e.message}`);
  }

  if (index % 5 === 0 || !check.pass) {
    const status = check.pass ? "✅" : "❌";
    if (check.pass) {
      process.stdout.write(`\r[FIREWALL] ${status} ${index + 1}/${total} ${url}`);
    } else {
      console.log(`\n[FIREWALL] ${status} [${index + 1}/${total}] ${url}`);
      check.failures.forEach(f => console.log(`[FIREWALL]    → ${f}`));
    }
  }

  return check;
}

async function checkUrls(urls: string[]): Promise<UrlCheck[]> {
  const results: UrlCheck[] = [];

  for (let i = 0; i < urls.length; i++) {
    results.push(await checkUrl(urls[i], i, urls.length));
  }

  console.log("");
  return results;
}

// ─── MAIN ───

async function main() {
  console.log("[FIREWALL] ========================================");
  console.log("[FIREWALL] MIL-STD §2: Dirty URL Firewall (6-Node)");
  console.log("[FIREWALL] N1: HTTP Status | N2: Link Header");
  console.log("[FIREWALL] N3: Noindex    | N4: Content-Type");
  console.log("[FIREWALL] N5: Redirects  | N6: Soft-404");
  console.log("[FIREWALL] ========================================\n");

  const args = process.argv.slice(2);
  const useLive = args.includes("--live");
  const sampleArg = args.find(a => a.startsWith("--sample="));
  const sampleSize = sampleArg ? parseInt(sampleArg.split("=")[1]) : undefined;

  let urls: string[];
  if (useLive) {
    console.log("[FIREWALL] Mode: LIVE — fetching from production sitemap");
    const sitemapUrls = await fetchLiveSitemap(`${SITE_ORIGIN}/sitemap.xml`);
    urls = [];
    for (const smUrl of sitemapUrls.slice(0, 3)) {
      const subUrls = await fetchLiveSitemap(smUrl);
      urls.push(...subUrls);
    }
  } else {
    console.log("[FIREWALL] Mode: SOURCE — parsing route.ts files");
    urls = parseSitemapUrlsFromSource();
  }

  if (sampleSize && sampleSize < urls.length) {
    const shuffled = urls.sort(() => Math.random() - 0.5);
    urls = shuffled.slice(0, sampleSize);
  }

  console.log(`[FIREWALL] URLs to check: ${urls.length}\n`);

  const results = await checkUrls(urls);

  const dirty = results.filter(r => !r.pass);
  const clean = results.filter(r => r.pass);
  const noindexCount = results.filter(r => r.hasNoindex).length;
  const redirectCount = results.filter(r => r.redirectChain > 0).length;
  const soft404Count = results.filter(r => r.soft404).length;

  console.log("\n[FIREWALL] ========================================");
  console.log(`[FIREWALL] Total:      ${results.length} URLs`);
  console.log(`[FIREWALL] Clean:      ${clean.length}`);
  console.log(`[FIREWALL] Dirty:      ${dirty.length}`);
  console.log(`[FIREWALL] Noindex:    ${noindexCount} detected`);
  console.log(`[FIREWALL] Redirects:  ${redirectCount} chains`);
  console.log(`[FIREWALL] Soft-404s:  ${soft404Count} suspected`);

  if (dirty.length > 0) {
    console.log("\n[FIREWALL] DIRTY URLS (must be removed from sitemap):");
    for (const d of dirty) {
      console.log(`[FIREWALL]   ❌ ${d.url} (${d.status}) ${d.failures.length} issue(s)`);
    }
    console.log("\n[FIREWALL] ⚠️  DIRTY URLS DETECTED. Blocked by production firewall.");
    console.log("[FIREWALL] ========================================");
    process.exit(1);
  } else {
    console.log("[FIREWALL] ✅ All sitemap URLs pass the 6-Node Dirty URL Firewall.");
    console.log("[FIREWALL] ========================================");
    process.exit(0);
  }
}

main();
