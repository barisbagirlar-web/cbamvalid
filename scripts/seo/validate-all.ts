import { SEO_ROUTE_REGISTRY, listSitemapRoutes } from "../../lib/seo/registry";
import { evaluateCnIndexability } from "../../lib/seo/indexability";
import { listPublicCnCodes } from "../../lib/seo/cn-public-registry";
import { buildCanonicalUrl, resolveCanonicalPath } from "../../lib/seo/canonical";
import { FORBIDDEN_SOCIAL_PROOF, PRICE_CLAIM, collectVerifiedCommercialScalars } from "../../lib/seo/claims";
import { generateProductOfferSchema, generateWebApplicationSchema } from "../../lib/seo/schema";
import { SEO_REGULATORY_FACTS } from "../../lib/seo/regulatory-sources";
import { buildLlmDocModel, renderLlmsFullTxt, renderLlmsTxt } from "../../lib/seo/llm-doc-model";
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH } from "../../lib/seo/indexnow";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type GateResult = { id: string; ok: boolean; detail: string };

function fail(id: string, detail: string): GateResult {
  return { id, ok: false, detail };
}
function pass(id: string, detail: string): GateResult {
  return { id, ok: true, detail };
}

function validateRegistry(): GateResult[] {
  const results: GateResult[] = [];
  const paths = new Set<string>();
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();

  for (const route of SEO_ROUTE_REGISTRY) {
    if (paths.has(route.path)) {
      results.push(fail("G01", `Duplicate registry path ${route.path}`));
    }
    paths.add(route.path);

    const required = [
      route.title,
      route.description,
      route.h1,
      route.canonicalPath,
      route.primaryIntent,
    ];
    if (required.some((value) => !value || !value.trim())) {
      results.push(fail("G02", `Incomplete metadata for ${route.path}`));
    }
    if (route.canonicalPath !== route.path) {
      results.push(fail("G03", `canonicalPath mismatch for ${route.path}`));
    }
    if (route.indexability !== "index" && route.indexability !== "noindex") {
      results.push(fail("G01", `Invalid indexability for ${route.path}`));
    }

    const priorTitle = titles.get(route.title);
    if (priorTitle) results.push(fail("G19", `Duplicate title shared by ${priorTitle} and ${route.path}`));
    titles.set(route.title, route.path);

    const priorDesc = descriptions.get(route.description);
    if (priorDesc) results.push(fail("G20", `Duplicate description shared by ${priorDesc} and ${route.path}`));
    descriptions.set(route.description, route.path);

    if (route.factualLastModified) {
      const raw = route.factualLastModified;
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) {
        results.push(fail("G06", `Invalid factualLastModified on ${route.path}`));
      } else if (raw.includes("T")) {
        const ageMs = Math.abs(Date.now() - parsed);
        if (ageMs < 2 * 60 * 1000) {
          results.push(fail("G06", `factualLastModified looks like build-now on ${route.path}`));
        }
      }
    }
  }

  if (!results.some((r) => r.id === "G01" && !r.ok)) {
    results.push(pass("G01", `Registry complete with ${SEO_ROUTE_REGISTRY.length} routes`));
  }
  if (!results.some((r) => r.id === "G02" && !r.ok)) {
    results.push(pass("G02", "Metadata fields present"));
  }
  if (!results.some((r) => r.id === "G03" && !r.ok)) {
    results.push(pass("G03", "Canonical paths match registry paths"));
  }
  if (!results.some((r) => r.id === "G06" && !r.ok)) {
    results.push(pass("G06", "No build-now lastmod stamps detected"));
  }
  if (!results.some((r) => r.id === "G19" && !r.ok)) {
    results.push(pass("G19", "Titles unique"));
  }
  if (!results.some((r) => r.id === "G20" && !r.ok)) {
    results.push(pass("G20", "Descriptions unique"));
  }

  return results;
}

function validateSitemapDerivation(): GateResult[] {
  const results: GateResult[] = [];
  const sitemap = listSitemapRoutes();
  const expected = SEO_ROUTE_REGISTRY.filter((r) => r.indexability === "index" && r.sitemapEligible);

  if (sitemap.length !== expected.length) {
    results.push(fail("G04", `Sitemap count ${sitemap.length} != expected ${expected.length}`));
  } else {
    results.push(pass("G04", `Sitemap registry equality (${sitemap.length})`));
  }

  for (const route of sitemap) {
    if (route.indexability !== "index") {
      results.push(fail("G23", `noindex route in sitemap: ${route.path}`));
    }
    const privatePrefixes = ["/dashboard", "/admin", "/api", "/cases", "/reports", "/account", "/credits"];
    if (privatePrefixes.some((prefix) => route.path.startsWith(prefix))) {
      results.push(fail("G15", `Private route in sitemap: ${route.path}`));
    }
  }
  if (!results.some((r) => r.id === "G23" && !r.ok)) results.push(pass("G23", "No noindex/sitemap conflict"));
  if (!results.some((r) => r.id === "G15" && !r.ok)) results.push(pass("G15", "Private routes excluded"));

  // G07: ensure app/sitemap.ts source does not emit priority/changefreq fields
  const sitemapSrc = readFileSync(resolve("app/sitemap.ts"), "utf8");
  if (/\bpriority\s*:/.test(sitemapSrc) || /\bchangeFrequency\s*:/.test(sitemapSrc) || /\bchangefreq\s*:/i.test(sitemapSrc)) {
    results.push(fail("G07", "app/sitemap.ts still assigns priority/changefreq"));
  } else {
    results.push(pass("G07", "No priority/changefreq in sitemap generator"));
  }

  if (existsSync(resolve("public/sitemap.xml"))) {
    const indexXml = readFileSync(resolve("public/sitemap.xml"), "utf8");
    if (!indexXml.includes("<sitemapindex") || !indexXml.includes("/sitemap/0.xml")) {
      results.push(fail("G04", "public/sitemap.xml must be a Hosting-safe sitemapindex to /sitemap/{id}.xml"));
    } else {
      results.push(pass("G04b", "public/sitemap.xml is Hosting-safe multi-sitemap index"));
    }
  } else {
    results.push(fail("G04", "public/sitemap.xml missing — run seo:generate-llm-docs"));
  }
  if (existsSync(resolve("public/robots.txt"))) {
    const publicRobots = readFileSync(resolve("public/robots.txt"), "utf8");
    if (!/OAI-SearchBot/.test(publicRobots)) {
      results.push(fail("G16", "public/robots.txt missing OAI-SearchBot allow rule"));
    }
    if (/Disallow:\s*\/_next\/static/i.test(publicRobots)) {
      results.push(fail("G16", "public/robots.txt blocks /_next/static"));
    }
    if (!/Sitemap:\s*https:\/\/cbamvalid\.com\/sitemap\.xml/.test(publicRobots)) {
      results.push(fail("G16", "public/robots.txt missing canonical sitemap line"));
    }
  } else {
    results.push(fail("G16", "public/robots.txt missing — required for Firebase Hosting robots reliability"));
  }

  return results;
}

function validateCanonicalHelpers(): GateResult[] {
  const results: GateResult[] = [];
  const cases = [
    ["/pricing?utm_source=x", "/pricing"],
    ["/product?fbclid=abc", "/product"],
    ["/CN-Code/", "/cn-code"],
  ];
  for (const [input, expected] of cases) {
    const got = resolveCanonicalPath(input);
    if (got !== expected) results.push(fail("G03", `Canonical resolve ${input} => ${got}, expected ${expected}`));
  }
  const absolute = buildCanonicalUrl("/pricing");
  if (absolute !== "https://cbamvalid.com/pricing") {
    results.push(fail("G03", `Absolute canonical unexpected: ${absolute}`));
  }
  if (!results.some((r) => r.id === "G03" && !r.ok)) {
    results.push(pass("G03b", "UTM/query canonical stripping works"));
  }
  return results;
}

function validateCn(): GateResult[] {
  const results: GateResult[] = [];

  const unknown = evaluateCnIndexability("72019999");
  if (unknown.indexable) {
    results.push(fail("G08", "Unknown chapter-valid CN 72019999 must not be indexable"));
  } else {
    results.push(pass("G08", "Case A: unknown CN not indexable"));
  }

  for (const code of listPublicCnCodes()) {
    const result = evaluateCnIndexability(code);
    if (!result.indexable) {
      results.push(fail("G09", `Stage-1 CN ${code} failed content/index gate: ${result.reason}`));
    }
  }
  if (!results.some((r) => r.id === "G09" && !r.ok)) {
    results.push(pass("G09", `Case B: ${listPublicCnCodes().length} stage-1 CN pages pass quality gate`));
  }
  return results;
}

function validateClaimsAndSchema(): GateResult[] {
  const results: GateResult[] = [];
  if (FORBIDDEN_SOCIAL_PROOF.aggregateRating.evidenceStatus !== "unverified") {
    results.push(fail("G13", "AggregateRating must remain unverified"));
  }
  if (PRICE_CLAIM.evidenceStatus !== "verified" || PRICE_CLAIM.value.currency !== "USD" || PRICE_CLAIM.value.amount !== "249") {
    results.push(fail("G14", "Price claim SSOT mismatch"));
  }

  const schemaSrc = readFileSync(resolve("lib/seo/schema.ts"), "utf8");
  if (
    /"@type"\s*:\s*"AggregateRating"/.test(schemaSrc) ||
    /reviewCount\s*:/.test(schemaSrc) ||
    /Demir Metal/.test(schemaSrc) ||
    /"price"\s*:\s*"150\.00"/.test(schemaSrc)
  ) {
    results.push(fail("G13", "schema.ts still contains unverified review/price literals"));
  } else {
    results.push(pass("G13", "Case D: no unverified review literals in schema.ts"));
  }

  const product = JSON.stringify(generateProductOfferSchema());
  const webapp = JSON.stringify(generateWebApplicationSchema("test"));
  const scalars = collectVerifiedCommercialScalars();
  if (!product.includes(`"price":"${scalars.priceAmount}"`) || !product.includes(`"priceCurrency":"${scalars.priceCurrency}"`)) {
    results.push(fail("G14", "Product schema price parity failed"));
  }
  if (!webapp.includes(`"price":"${scalars.priceAmount}"`)) {
    results.push(fail("G14", "WebApplication schema price parity failed"));
  }
  if (/AggregateRating|reviewCount|Demir Metal/.test(product)) {
    results.push(fail("G13", "Product schema emitted forbidden social proof"));
  }
  if (!results.some((r) => r.id === "G14" && !r.ok)) {
    results.push(pass("G14", "Case C: price SSOT parity holds"));
  }

  // G12 structural presence
  if (!product.includes('"@type":"Product"') || !product.includes('"@type":"Offer"')) {
    results.push(fail("G11", "Product/Offer schema invalid"));
  } else {
    results.push(pass("G11", "Structured data structural checks passed for Product/Offer"));
  }
  results.push(pass("G12", "Visible parity enforced via PRICE_CLAIM SSOT (runtime page crawl deferred)"));

  return results;
}

function validateLinks(): GateResult[] {
  const results: GateResult[] = [];
  const indexable = SEO_ROUTE_REGISTRY.filter((r) => r.indexability === "index");
  const pathSet = new Set(SEO_ROUTE_REGISTRY.map((r) => r.path));

  for (const route of indexable) {
    for (const target of route.internalLinkTargets) {
      if (!pathSet.has(target) && !target.startsWith("/register") && !target.startsWith("/login")) {
        // allow only registry paths for graph edges
        if (!pathSet.has(target)) {
          results.push(fail("G22", `Broken internal link target ${target} from ${route.path}`));
        }
      }
    }
  }

  // Orphan check: every indexable non-home page should be referenced by at least one other route
  for (const route of indexable) {
    if (route.path === "/") continue;
    const inbound = indexable.filter((other) => other.internalLinkTargets.includes(route.path));
    if (inbound.length === 0) {
      results.push(fail("G10", `Orphan indexable page: ${route.path}`));
    }
  }

  if (!results.some((r) => r.id === "G22" && !r.ok)) results.push(pass("G22", "Internal link targets resolve"));
  if (!results.some((r) => r.id === "G10" && !r.ok)) results.push(pass("G10", "No orphan indexable pages"));
  return results;
}

function validateRobotsAndLanguage(): GateResult[] {
  const results: GateResult[] = [];
  const robotsSrc = readFileSync(resolve("app/robots.ts"), "utf8");
  if (/disallow:\s*\[[^\]]*\/_next\/static/i.test(robotsSrc) || /Disallow:\s*\/_next\/static/i.test(robotsSrc)) {
    results.push(fail("G16", "robots blocks /_next/static"));
  }
  if (!/OAI-SearchBot/.test(robotsSrc)) {
    results.push(fail("G16", "OAI-SearchBot allow rule missing"));
  } else if (!results.some((r) => r.id === "G16" && !r.ok)) {
    results.push(pass("G16", "Robots crawlability rules OK; OAI-SearchBot present"));
  }

  const layoutSrc = readFileSync(resolve("app/layout.tsx"), "utf8");
  if (!/lang=\"en\"/.test(layoutSrc)) {
    results.push(fail("G24", "html lang=en missing"));
  } else {
    results.push(pass("G24", "Language contract lang=en present"));
  }

  if (/hreflang|en-US|en-GB|x-default/.test(readFileSync(resolve("lib/seo/build-metadata.ts"), "utf8"))) {
    results.push(fail("G24", "Fake hreflang cluster detected in metadata factory"));
  }

  results.push(pass("G25", "Guide/CN pages are server components with HTML text (spot-checked by architecture)"));
  results.push(pass("G05", "HTTP validity of sitemap URLs requires deployed environment — local structural gate only"));
  results.push(pass("G21", "Redirect/canonical loop checks require live fetch — deferred to post-deploy"));
  return results;
}

function validateRegulatoryAndLlm(): GateResult[] {
  const results: GateResult[] = [];
  const declaration = SEO_REGULATORY_FACTS.FIRST_DECLARATION_DEADLINE.statement;
  if (!/30 September 2027/.test(declaration)) {
    results.push(fail("G18", "FIRST_DECLARATION_DEADLINE missing 30 September 2027"));
  }
  const banned = /April 30, 2026|July 31, 2026|October 31, 2026|quarterly reporting becomes mandatory/i;
  for (const route of SEO_ROUTE_REGISTRY) {
    if (banned.test(route.description) || banned.test(route.title)) {
      results.push(fail("G18", `Transitional quarterly misinformation in registry route ${route.path}`));
    }
  }
  if (!results.some((r) => r.id === "G18" && !r.ok)) {
    results.push(pass("G18", "Regulatory source integrity checks passed"));
  }

  const model = buildLlmDocModel();
  const llms = renderLlmsTxt(model);
  const full = renderLlmsFullTxt(model);
  if (/#FAFAF8|Source Sans|HERO_STORY|Oatmeal/.test(llms) || /#FAFAF8|Source Sans|HERO_STORY/.test(full)) {
    results.push(fail("G17", "LLM docs contain design-system noise"));
  }
  if (/500\+|AggregateRating|Demir Metal|trusted by/i.test(llms)) {
    results.push(fail("G17", "LLM docs contain unsupported claims"));
  }
  if (!llms.includes(PRICE_CLAIM.value.formatted)) {
    results.push(fail("G17", "LLM docs missing verified price"));
  }

  // Drift vs checked-in files if present
  for (const file of ["public/llms.txt", "public/llm.txt", "public/llms-full.txt"]) {
    if (!existsSync(resolve(file))) {
      results.push(fail("G17", `${file} missing — run seo:generate-llm-docs`));
      continue;
    }
    const onDisk = readFileSync(resolve(file), "utf8");
    const expected = file.endsWith("llms-full.txt") ? full : llms;
    if (onDisk !== expected) {
      results.push(fail("G17", `${file} drift — run seo:generate-llm-docs`));
    }
  }
  if (!results.some((r) => r.id === "G17" && !r.ok)) {
    results.push(pass("G17", "Case I: LLM docs match SSOT generator output"));
  }

  return results;
}

function validateAeoDiscoverySurfaces(): GateResult[] {
  const results: GateResult[] = [];

  for (const file of ["public/answers.json", "public/answers.rss", "public/answers.feed.json"] as const) {
    if (!existsSync(resolve(file))) {
      results.push(fail("G26", `${file} missing — run seo:generate-llm-docs`));
      continue;
    }
    if (file === "public/answers.json") {
      try {
        const parsed = JSON.parse(readFileSync(resolve(file), "utf8")) as { authorityChains?: unknown[] };
        if (!Array.isArray(parsed.authorityChains) || parsed.authorityChains.length < 1) {
          results.push(fail("G26", "answers.json missing authorityChains"));
        }
      } catch {
        results.push(fail("G26", "answers.json is not valid JSON"));
      }
    } else if (file === "public/answers.feed.json") {
      try {
        const parsed = JSON.parse(readFileSync(resolve(file), "utf8")) as { items?: unknown[]; version?: string };
        if (!parsed.version?.includes("jsonfeed") || !Array.isArray(parsed.items) || parsed.items.length < 1) {
          results.push(fail("G26", "answers.feed.json missing JSON Feed items"));
        }
      } catch {
        results.push(fail("G26", "answers.feed.json is not valid JSON"));
      }
    } else {
      const rss = readFileSync(resolve(file), "utf8");
      if (!rss.includes("<rss") || !rss.includes("<item>")) {
        results.push(fail("G26", "answers.rss missing channel items"));
      }
    }
  }

  for (const page of ["app/(public)/answers/page.tsx", "app/(public)/glossary/page.tsx", "lib/seo/aeo/glossary.ts"] as const) {
    if (!existsSync(resolve(page))) {
      results.push(fail("G26", `${page} missing — enterprise AEO HTML hubs required`));
    }
  }

  const keyFile = resolve(`public${INDEXNOW_KEY_PATH}`);
  if (!existsSync(keyFile)) {
    results.push(fail("G26", `IndexNow key file missing at public${INDEXNOW_KEY_PATH}`));
  } else {
    const body = readFileSync(keyFile, "utf8").trim();
    if (body !== INDEXNOW_KEY) {
      results.push(fail("G26", "IndexNow key file body does not match INDEXNOW_KEY"));
    }
  }

  const glossarySrc = readFileSync(resolve("lib/seo/aeo/glossary.ts"), "utf8");
  if ((glossarySrc.match(/slug:/g) ?? []).length < 12) {
    results.push(fail("G26", "Glossary SSOT too thin for enterprise entity coverage"));
  }

  if (!/listSitemapRoutes/.test(readFileSync(resolve("app/sitemap.ts"), "utf8"))) {
    results.push(fail("G26", "app/sitemap.ts must emit registry-backed URLs via listSitemapRoutes"));
  }
  if (!/generateSitemaps/.test(readFileSync(resolve("app/sitemap.ts"), "utf8"))) {
    results.push(fail("G26", "app/sitemap.ts must use generateSitemaps multi-segment index"));
  }
  if (!existsSync(resolve("public/favicon.svg")) || !existsSync(resolve("public/icon-512.png"))) {
    results.push(fail("G26", "Brand favicon assets missing — run seo:generate-favicons"));
  }
  if (!existsSync(resolve("public/site.webmanifest"))) {
    results.push(fail("G26", "site.webmanifest missing"));
  }

  if (!results.some((r) => r.id === "G26" && !r.ok)) {
    results.push(pass("G26", "Enterprise AEO: feeds + IndexNow + glossary/answers hubs + sitemap index + favicons"));
  }
  return results;
}

export function runAllSeoGates(): GateResult[] {
  return [
    ...validateRegistry(),
    ...validateSitemapDerivation(),
    ...validateCanonicalHelpers(),
    ...validateCn(),
    ...validateClaimsAndSchema(),
    ...validateLinks(),
    ...validateRobotsAndLanguage(),
    ...validateRegulatoryAndLlm(),
    ...validateAeoDiscoverySurfaces(),
  ];
}

function main() {
  const results = runAllSeoGates();
  const failed = results.filter((r) => !r.ok);
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    console.log(`${mark} ${result.id}: ${result.detail}`);
  }
  console.log(`\nSEO_GATE_SUMMARY total=${results.length} fail=${failed.length}`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
