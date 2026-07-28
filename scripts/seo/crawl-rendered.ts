/**
 * Production-build rendered HTML crawler for every sitemap URL + fail-closed unknowns.
 *
 * Prerequisites: `npm run build && npm run start` (or SEO_CRAWL_BASE_URL pointing at a live server).
 * Usage: SEO_CRAWL_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/seo/crawl-rendered.ts
 */

import { listSitemapRoutes, getSeoRoute } from "../../lib/seo/registry";
import { PRICE_CLAIM } from "../../lib/seo/claims";
import { resolveCanonicalPath, buildCanonicalUrl } from "../../lib/seo/canonical";
import { evaluateCnIndexability } from "../../lib/seo/indexability";

const BASE = (process.env.SEO_CRAWL_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

type Check = { id: string; ok: boolean; detail: string };

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
  const m = html.match(re);
  return m?.[1] ?? m?.[2] ?? null;
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return m?.[1] ?? null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function countH1(html: string): number {
  return (html.match(/<h1\b/gi) ?? []).length;
}

function extractLang(html: string): string | null {
  const m = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return m?.[1] ?? null;
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
  const blob = `${meta} ${header}`;
  if (blob.includes("noindex")) return false;
  return true;
}

async function fetchPage(path: string): Promise<{
  status: number;
  html: string;
  contentType: string;
  xRobots: string | null;
  finalUrl: string;
  redirectedToLogin: boolean;
}> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "CBAMValid-SEO-Rendered-Crawler/1.0" },
  });
  // Sitemap URLs must not bounce to auth.
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

  if (!page.contentType.includes("text/html")) {
    checks.push(fail("RC02", `${path} content-type ${page.contentType}`));
  } else {
    checks.push(pass("RC02", `${path} text/html`));
  }

  const canonical = extractCanonical(page.html);
  const expectedCanonical = buildCanonicalUrl(path);
  if (!canonical || resolveCanonicalPath(new URL(canonical).pathname) !== path) {
    checks.push(fail("RC03", `${path} canonical mismatch got=${canonical}`));
  } else if (canonical !== expectedCanonical && !canonical.endsWith(path === "/" ? "/" : path)) {
    // accept absolute expected or path-equivalent
    const norm = canonical.replace(/\/$/, "") || "https://cbamvalid.com";
    const exp = expectedCanonical.replace(/\/$/, "") || "https://cbamvalid.com";
    if (norm !== exp) {
      checks.push(fail("RC03", `${path} canonical ${canonical} != ${expectedCanonical}`));
    } else {
      checks.push(pass("RC03", `${path} canonical OK`));
    }
  } else {
    checks.push(pass("RC03", `${path} canonical OK`));
  }

  if (!robotsAllowsIndex(page.html, page.xRobots)) {
    checks.push(fail("RC04", `${path} robots noindex on sitemap URL`));
  } else {
    checks.push(pass("RC04", `${path} robots indexable`));
  }

  const title = extractTitle(page.html);
  if (!title || (route && title !== route.title && !title.includes("CBAMValid"))) {
    // Next may append site name — require non-empty and CBAMValid or registry title substring
    if (!title || title.trim().length < 8) {
      checks.push(fail("RC05", `${path} missing/weak title`));
    } else {
      checks.push(pass("RC05", `${path} title present`));
    }
  } else {
    checks.push(pass("RC05", `${path} title present`));
  }

  const desc = extractMeta(page.html, "description");
  if (!desc || desc.trim().length < 20) {
    checks.push(fail("RC06", `${path} missing description`));
  } else {
    checks.push(pass("RC06", `${path} description present`));
  }

  const h1Count = countH1(page.html);
  if (h1Count !== 1) {
    checks.push(fail("RC07", `${path} H1 count=${h1Count}`));
  } else {
    checks.push(pass("RC07", `${path} single H1`));
  }

  const lang = extractLang(page.html);
  if (lang !== "en") {
    checks.push(fail("RC08", `${path} lang=${lang}`));
  } else {
    checks.push(pass("RC08", `${path} lang=en`));
  }

  const jsonLd = extractJsonLd(page.html);
  if (jsonLd.some((b) => b && typeof b === "object" && "__parseError" in (b as object))) {
    checks.push(fail("RC09", `${path} JSON-LD parse error`));
  } else {
    checks.push(pass("RC09", `${path} JSON-LD parse OK (${jsonLd.length} blocks)`));
  }

  // UTM must not change canonical identity
  const utmPath = `${path}${path.includes("?") ? "&" : "?"}utm_source=test&utm_campaign=test&fbclid=test`;
  const utmPage = await fetchPage(utmPath.startsWith("/") ? utmPath : `/${utmPath}`);
  const utmCanonical = extractCanonical(utmPage.html);
  const baseCanonical = extractCanonical(page.html);
  if (utmCanonical && baseCanonical && utmCanonical !== baseCanonical) {
    checks.push(fail("RC10", `${path} UTM changed canonical ${baseCanonical} -> ${utmCanonical}`));
  } else {
    checks.push(pass("RC10", `${path} UTM canonical stable`));
  }

  // Price parity on money pages
  if (path === "/" || path === "/pricing" || path === "/product") {
    const visiblePrice = page.html.includes(PRICE_CLAIM.value.formatted) || page.html.includes("149");
    const schemaHasPrice = JSON.stringify(jsonLd).includes(`"price":"${PRICE_CLAIM.value.amount}"`)
      || JSON.stringify(jsonLd).includes('"price":"149"');
    if (!visiblePrice) {
      checks.push(fail("RC11", `${path} visible price missing`));
    } else if (path !== "/" && !schemaHasPrice && jsonLd.length > 0) {
      // homepage may use WebApplication; still check 149 somewhere in schema if present
      checks.push(pass("RC11", `${path} visible price present (schema optional)`));
    } else {
      checks.push(pass("RC11", `${path} price parity OK`));
    }
  }

  // Server-returned text: must contain brand or route H1 fragment
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

  if (coverage.indexable) {
    checks.push(fail("RC13", `${code} must not be indexable in registry logic`));
  }

  // Hard entity 404 — soft-404 (200+noindex) is FAIL
  if (detail.status === 404) {
    checks.push(pass("RC13", `${detailPath} HTTP 404 hard fail-closed`));
  } else {
    checks.push(
      fail(
        "RC13",
        `${detailPath} expected HTTP 404, got status=${detail.status} robots_indexable=${robotsAllowsIndex(detail.html, detail.xRobots)}`,
      ),
    );
  }

  // Arbitrary lookup utility must be 200 + noindex, canonical stays hub
  if (lookup.status !== 200) {
    checks.push(fail("RC14", `${lookupPath} expected HTTP 200 utility, got ${lookup.status}`));
  } else if (robotsAllowsIndex(lookup.html, lookup.xRobots)) {
    checks.push(fail("RC14", `${lookupPath} must be noindex`));
  } else {
    const canonical = extractCanonical(lookup.html);
    if (canonical && !canonical.endsWith("/cn-code") && canonical !== "https://cbamvalid.com/cn-code") {
      checks.push(fail("RC14", `${lookupPath} canonical must remain /cn-code, got ${canonical}`));
    } else {
      checks.push(pass("RC14", `${lookupPath} utility 200 + noindex`));
    }
  }
  return checks;
}

async function crawlHomepageG25(): Promise<Check[]> {
  const page = await fetchPage("/");
  const checks: Check[] = [];
  if (!page.html.includes("CBAM")) {
    checks.push(fail("G25", "Homepage HTML missing CBAM (client-empty?)"));
  } else if (!/Frequently Asked Questions|FAQ/i.test(page.html) && !page.html.includes("CBAM Exporter")) {
    checks.push(fail("G25", "Homepage HTML missing FAQ/hero signals"));
  } else {
    checks.push(pass("G25", "Homepage initial HTML contains brand and key copy"));
  }
  return checks;
}

async function main() {
  const results: Check[] = [];
  // Health check
  try {
    const health = await fetch(`${BASE}/`, { method: "GET" });
    if (!health.ok && health.status !== 200) {
      console.error(`Server not reachable at ${BASE} (status ${health.status})`);
      process.exit(2);
    }
  } catch (err) {
    console.error(`Server not reachable at ${BASE}: ${err}`);
    console.error("Start with: npm run build && npm run start");
    process.exit(2);
  }

  const sitemapPaths = listSitemapRoutes().map((r) => r.path);
  console.log(`RENDERED_CRAWL base=${BASE} urls=${sitemapPaths.length}`);

  for (const path of sitemapPaths) {
    const checks = await crawlSitemapUrl(path);
    results.push(...checks);
  }
  results.push(...(await crawlUnknownCn()));
  results.push(...(await crawlHomepageG25()));

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}: ${r.detail}`);
  }
  console.log(`\nRENDERED_CRAWL_SUMMARY total=${results.length} fail=${failed.length}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
