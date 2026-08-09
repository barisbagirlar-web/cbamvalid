/**
 * Production-build rendered HTML crawler for every sitemap URL + fail-closed unknowns.
 * Phase 04 can additionally launch Chromium and compare raw server HTML with the
 * hydrated DOM for critical commercial/authority routes.
 *
 * Prerequisites: `npm run build && npm run start` (or SEO_CRAWL_BASE_URL pointing at a live server).
 * Usage: SEO_CRAWL_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/seo/crawl-rendered.ts
 */

import { readdirSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "@playwright/test";
import { listSitemapRoutes, getSeoRoute, SEO_ROUTE_REGISTRY } from "../../lib/seo/registry";
import { PRICE_CLAIM } from "../../lib/seo/claims";
import { resolveCanonicalPath, buildCanonicalUrl } from "../../lib/seo/canonical";
import { evaluateCnIndexability } from "../../lib/seo/indexability";

const BASE = (process.env.SEO_CRAWL_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PUBLIC_APP_ROOT = resolve(ROOT, "app/(public)");
const BROWSER_ENABLED = process.env.SEO_RENDER_BROWSER === "1";

export const PHASE4_CRITICAL_PATHS = [
  "/",
  "/pricing",
  "/product",
  "/product-classification",
  "/methodology",
  "/cn-code",
] as const;

const MONEY_PATHS = new Set<string>(["/", "/pricing", "/product", "/product-classification"]);

type Check = { id: string; ok: boolean; detail: string };

export type CriticalSnapshot = {
  title: string | null;
  description: string | null;
  h1Texts: string[];
  canonical: string | null;
  hreflangs: string[];
};

type PageFetch = {
  status: number;
  html: string;
  contentType: string;
  xRobots: string | null;
  finalUrl: string;
  redirectedToLogin: boolean;
};

function pass(id: string, detail: string): Check {
  return { id, ok: true, detail };
}
function fail(id: string, detail: string): Check {
  return { id, ok: false, detail };
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] ?? match?.[2] ?? null;
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function extractCanonical(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attribute(tag, "rel");
    if (!rel?.split(/\s+/).some((token) => token.toLowerCase() === "canonical")) continue;
    return attribute(tag, "href");
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractH1Texts(html: string): string[] {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decodeHtmlText(match[1] ?? ""));
}

function countH1(html: string): number {
  return extractH1Texts(html).length;
}

function extractLang(html: string): string | null {
  const match = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function extractHreflangs(html: string): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attribute(tag, "rel");
    const hreflang = attribute(tag, "hreflang");
    const href = attribute(tag, "href");
    if (!rel?.split(/\s+/).some((token) => token.toLowerCase() === "alternate") || !hreflang || !href) continue;
    values.push(`${hreflang.toLowerCase()}=${href}`);
  }
  return [...new Set(values)].sort();
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]!));
    } catch {
      blocks.push({ __parseError: true, raw: match[1] });
    }
  }
  return blocks;
}

function robotsAllowsIndex(html: string, xRobots: string | null): boolean {
  const meta = (extractMeta(html, "robots") ?? "").toLowerCase();
  const header = (xRobots ?? "").toLowerCase();
  return !`${meta} ${header}`.includes("noindex");
}

export function extractCriticalSnapshot(html: string): CriticalSnapshot {
  return {
    title: extractTitle(html),
    description: extractMeta(html, "description"),
    h1Texts: extractH1Texts(html),
    canonical: extractCanonical(html),
    hreflangs: extractHreflangs(html),
  };
}

export function validateCriticalContentParity(
  raw: CriticalSnapshot,
  rendered: CriticalSnapshot,
  path: string,
): string[] {
  const blocks: string[] = [];
  if (raw.title !== rendered.title) blocks.push(`INV-4.1 ${path} title changed after hydration`);
  if (raw.description !== rendered.description) blocks.push(`INV-4.1 ${path} description changed after hydration`);
  if (JSON.stringify(raw.h1Texts) !== JSON.stringify(rendered.h1Texts)) blocks.push(`INV-4.1 ${path} H1 content changed after hydration`);
  return blocks;
}

export function validateCanonicalHreflangParity(
  raw: CriticalSnapshot,
  rendered: CriticalSnapshot,
  path: string,
): string[] {
  const blocks: string[] = [];
  if (raw.canonical !== rendered.canonical) blocks.push(`INV-4.2 ${path} canonical changed after hydration`);
  if (JSON.stringify(raw.hreflangs) !== JSON.stringify(rendered.hreflangs)) blocks.push(`INV-4.2 ${path} hreflang set changed after hydration`);
  return blocks;
}

export function validateCurrentPriceHtml(html: string, path: string): string[] {
  if (!MONEY_PATHS.has(path)) return [];
  const amount = PRICE_CLAIM.value.amount;
  const tokens = [PRICE_CLAIM.value.formatted, `${PRICE_CLAIM.value.currency} ${amount}`];
  return tokens.some((token) => html.includes(token))
    ? []
    : [`INV-4.1 ${path} current pricing SSOT not visible (${PRICE_CLAIM.value.currency} ${amount})`];
}

function publicRouteFromPageFile(file: string): string | null {
  const rel = relative(PUBLIC_APP_ROOT, file).split(sep).join("/");
  if (!rel.endsWith("/page.tsx") && rel !== "page.tsx") return null;
  const routePart = rel === "page.tsx" ? "" : rel.slice(0, -"/page.tsx".length);
  const segments = routePart.split("/").filter(Boolean);
  if (segments.some((segment) => segment.includes("[") || segment.includes("]"))) return null;
  const publicSegments = segments.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return publicSegments.length === 0 ? "/" : `/${publicSegments.join("/")}`;
}

function walkPages(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkPages(path));
    else if (entry.isFile() && entry.name === "page.tsx") files.push(path);
  }
  return files;
}

export function discoverStaticPublicRoutes(): string[] {
  return walkPages(PUBLIC_APP_ROOT)
    .map(publicRouteFromPageFile)
    .filter((route): route is string => route !== null)
    .sort();
}

export function validatePublicStaticRegistryCoverage(
  publicRoutes: readonly string[],
  registryPaths: readonly string[],
): string[] {
  const registry = new Set(registryPaths);
  return publicRoutes.filter((route) => !registry.has(route)).map((route) => `INV-4.1 static public route missing from SEO registry ${route}`);
}

async function fetchPage(path: string): Promise<PageFetch> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "CBAMValid-SEO-Rendered-Crawler/2.0" },
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "";
    return {
      status: res.status,
      html: "",
      contentType: res.headers.get("content-type") ?? "",
      xRobots: res.headers.get("x-robots-tag"),
      finalUrl: loc,
      redirectedToLogin: /\/login(?:\?|$)/.test(loc),
    };
  }
  return {
    status: res.status,
    html: await res.text(),
    contentType: res.headers.get("content-type") ?? "",
    xRobots: res.headers.get("x-robots-tag"),
    finalUrl: res.url,
    redirectedToLogin: false,
  };
}

async function crawlSitemapUrl(path: string): Promise<Check[]> {
  const checks: Check[] = [];
  const route = getSeoRoute(path);
  const page = await fetchPage(path);

  if (page.redirectedToLogin) {
    checks.push(fail("RC01", `${path} redirected to login (${page.finalUrl}) — public route misclassified as workspace`));
    return checks;
  }
  if (page.status !== 200) {
    checks.push(fail("RC01", `${path} HTTP ${page.status}`));
    return checks;
  }
  checks.push(pass("RC01", `${path} HTTP 200`));

  checks.push(page.contentType.includes("text/html") ? pass("RC02", `${path} text/html`) : fail("RC02", `${path} content-type ${page.contentType}`));

  const canonical = extractCanonical(page.html);
  const expectedCanonical = buildCanonicalUrl(path);
  if (!canonical || resolveCanonicalPath(new URL(canonical).pathname) !== path) {
    checks.push(fail("RC03", `${path} canonical mismatch got=${canonical}`));
  } else {
    const norm = canonical.replace(/\/$/, "") || "https://cbamvalid.com";
    const exp = expectedCanonical.replace(/\/$/, "") || "https://cbamvalid.com";
    checks.push(norm === exp ? pass("RC03", `${path} canonical OK`) : fail("RC03", `${path} canonical ${canonical} != ${expectedCanonical}`));
  }

  checks.push(robotsAllowsIndex(page.html, page.xRobots) ? pass("RC04", `${path} robots indexable`) : fail("RC04", `${path} robots noindex on sitemap URL`));

  const title = extractTitle(page.html);
  checks.push(title && title.trim().length >= 8 ? pass("RC05", `${path} title present`) : fail("RC05", `${path} missing/weak title`));

  const desc = extractMeta(page.html, "description");
  checks.push(desc && desc.trim().length >= 20 ? pass("RC06", `${path} description present`) : fail("RC06", `${path} missing description`));

  const h1Count = countH1(page.html);
  checks.push(h1Count === 1 ? pass("RC07", `${path} single H1`) : fail("RC07", `${path} H1 count=${h1Count}`));

  const lang = extractLang(page.html);
  checks.push(lang === "en" ? pass("RC08", `${path} lang=en`) : fail("RC08", `${path} lang=${lang}`));

  const jsonLd = extractJsonLd(page.html);
  checks.push(
    jsonLd.some((block) => block && typeof block === "object" && "__parseError" in block)
      ? fail("RC09", `${path} JSON-LD parse error`)
      : pass("RC09", `${path} JSON-LD parse OK (${jsonLd.length} blocks)`),
  );

  const utmPath = `${path}${path.includes("?") ? "&" : "?"}utm_source=test&utm_campaign=test&fbclid=test`;
  const utmPage = await fetchPage(utmPath.startsWith("/") ? utmPath : `/${utmPath}`);
  const utmCanonical = extractCanonical(utmPage.html);
  const baseCanonical = extractCanonical(page.html);
  checks.push(
    utmCanonical && baseCanonical && utmCanonical !== baseCanonical
      ? fail("RC10", `${path} UTM changed canonical ${baseCanonical} -> ${utmCanonical}`)
      : pass("RC10", `${path} UTM canonical stable`),
  );

  const priceBlocks = validateCurrentPriceHtml(page.html, path);
  if (MONEY_PATHS.has(path)) {
    checks.push(priceBlocks.length === 0 ? pass("RC11", `${path} current pricing SSOT visible`) : fail("RC11", priceBlocks.join("; ")));
  }

  if (route && !page.html.includes("CBAM") && !page.html.includes(route.h1.slice(0, 12))) {
    checks.push(fail("RC12", `${path} body missing brand/H1 text (JS-empty?)`));
  } else {
    checks.push(pass("RC12", `${path} server HTML has content`));
  }

  return checks;
}

async function crawlUnknownCn(): Promise<Check[]> {
  const code = "72019999";
  const detailPath = `/cn-code/${code}`;
  const lookupPath = `/cn-code?code=${code}`;
  const coverage = evaluateCnIndexability(code);
  const detail = await fetchPage(detailPath);
  const lookup = await fetchPage(lookupPath);
  const checks: Check[] = [];

  if (coverage.indexable) checks.push(fail("RC13", `${code} must not be indexable in registry logic`));
  checks.push(
    detail.status === 404
      ? pass("RC13", `${detailPath} HTTP 404 hard fail-closed`)
      : fail("RC13", `${detailPath} expected HTTP 404, got status=${detail.status} robots_indexable=${robotsAllowsIndex(detail.html, detail.xRobots)}`),
  );

  if (lookup.status !== 200) {
    checks.push(fail("RC14", `${lookupPath} expected HTTP 200 utility, got ${lookup.status}`));
  } else if (robotsAllowsIndex(lookup.html, lookup.xRobots)) {
    checks.push(fail("RC14", `${lookupPath} must be noindex`));
  } else {
    const canonical = extractCanonical(lookup.html);
    checks.push(
      canonical && !canonical.endsWith("/cn-code") && canonical !== "https://cbamvalid.com/cn-code"
        ? fail("RC14", `${lookupPath} canonical must remain /cn-code, got ${canonical}`)
        : pass("RC14", `${lookupPath} utility 200 + noindex`),
    );
  }
  return checks;
}

async function crawlHomepageG25(): Promise<Check[]> {
  const page = await fetchPage("/");
  if (!page.html.includes("CBAM")) return [fail("G25", "Homepage HTML missing CBAM (client-empty?)")];
  if (!/Frequently Asked Questions|FAQ/i.test(page.html) && !page.html.includes("CBAM Exporter") && !page.html.includes("Emissions Data Workspace")) {
    return [fail("G25", "Homepage HTML missing hero/authority signals")];
  }
  return [pass("G25", "Homepage initial HTML contains brand and key copy")];
}

async function browserParity(browser: Browser): Promise<Check[]> {
  const checks: Check[] = [];
  const page = await browser.newPage();
  try {
    for (const path of PHASE4_CRITICAL_PATHS) {
      const raw = await fetchPage(path);
      if (raw.status !== 200) {
        checks.push(fail("INV-4.1", `${path} raw HTTP ${raw.status}; browser comparison impossible`));
        continue;
      }
      const pageErrors: string[] = [];
      const onPageError = (error: Error) => pageErrors.push(error.message);
      page.on("pageerror", onPageError);
      const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(100);
      const renderedHtml = await page.content();
      page.off("pageerror", onPageError);

      if (!response || response.status() !== 200) {
        checks.push(fail("INV-4.1", `${path} browser HTTP ${response?.status() ?? "none"}`));
        continue;
      }
      const rawSnapshot = extractCriticalSnapshot(raw.html);
      const renderedSnapshot = extractCriticalSnapshot(renderedHtml);
      const contentBlocks = validateCriticalContentParity(rawSnapshot, renderedSnapshot, path);
      const canonicalBlocks = validateCanonicalHreflangParity(rawSnapshot, renderedSnapshot, path);
      const priceBlocks = validateCurrentPriceHtml(renderedHtml, path);

      checks.push(contentBlocks.length === 0 ? pass("INV-4.1", `${path} raw/render critical content parity`) : fail("INV-4.1", contentBlocks.join("; ")));
      checks.push(canonicalBlocks.length === 0 ? pass("INV-4.2", `${path} canonical/hreflang parity`) : fail("INV-4.2", canonicalBlocks.join("; ")));
      if (MONEY_PATHS.has(path)) checks.push(priceBlocks.length === 0 ? pass("INV-4.1", `${path} hydrated current price SSOT`) : fail("INV-4.1", priceBlocks.join("; ")));
      if (pageErrors.length > 0) checks.push(fail("INV-4.1", `${path} browser pageerror: ${pageErrors.join(" | ")}`));
    }
  } finally {
    await page.close();
  }
  return checks;
}

export async function runRenderedCrawl(): Promise<Check[]> {
  const results: Check[] = [];
  const publicRoutes = discoverStaticPublicRoutes();
  const registryPaths = SEO_ROUTE_REGISTRY.map((route) => route.path);
  const coverageBlocks = validatePublicStaticRegistryCoverage(publicRoutes, registryPaths);
  results.push(
    coverageBlocks.length === 0
      ? pass("INV-4.1", `Static public registry coverage ${publicRoutes.length}/${publicRoutes.length}`)
      : fail("INV-4.1", coverageBlocks.join("; ")),
  );

  try {
    const health = await fetch(`${BASE}/`, { method: "GET" });
    if (!health.ok && health.status !== 200) throw new Error(`status ${health.status}`);
  } catch (error) {
    throw new Error(`Server not reachable at ${BASE}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const sitemapPaths = listSitemapRoutes().map((route) => route.path);
  console.log(`RENDERED_CRAWL base=${BASE} urls=${sitemapPaths.length} staticPublic=${publicRoutes.length} browser=${BROWSER_ENABLED}`);
  for (const path of sitemapPaths) results.push(...(await crawlSitemapUrl(path)));
  results.push(...(await crawlUnknownCn()));
  results.push(...(await crawlHomepageG25()));

  if (BROWSER_ENABLED) {
    const browser = await chromium.launch({ headless: true });
    try {
      results.push(...(await browserParity(browser)));
    } finally {
      await browser.close();
    }
  }
  return results;
}

async function main(): Promise<void> {
  const results = await runRenderedCrawl();
  const failed = results.filter((result) => !result.ok);
  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.id}: ${result.detail}`);
  console.log(`\nRENDERED_CRAWL_SUMMARY total=${results.length} fail=${failed.length}`);
  if (failed.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
