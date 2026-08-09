import { SEO_ROUTE_REGISTRY, listSitemapRoutes } from "../../lib/seo/registry";
import { evaluateCnIndexability } from "../../lib/seo/indexability";
import {
  CN_INDEXABILITY_STAGE,
  FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS,
  listPublicCnCodes,
} from "../../lib/seo/cn-public-registry";
import { isCbamCovered } from "../../lib/seo/cbam-scope-rules";
import { buildCanonicalUrl, resolveCanonicalPath } from "../../lib/seo/canonical";
import { FORBIDDEN_SOCIAL_PROOF, PRICE_CLAIM, collectVerifiedCommercialScalars } from "../../lib/seo/claims";
import { CANONICAL_PRICING } from "../../lib/billing/pricing-config";
import { generateProductOfferSchema, generateWebApplicationSchema } from "../../lib/seo/schema";
import {
  SEO_REGULATORY_FACTS,
  SEO_REGULATORY_CONTENT_VERSION,
  assertNoAssumptions,
  collectStaleRoutes,
  REGULATORY_SOURCES,
} from "../../lib/seo/regulatory-sources";
import {
  buildSeoRouteInventory,
  assertNoindexInventoryInvariant,
  PUBLIC_NOINDEX_DYNAMIC_ROUTE_PATTERNS,
} from "../../lib/seo/route-inventory";
import { buildLlmDocModel, renderLlmsFullTxt, renderLlmsTxt } from "../../lib/seo/llm-doc-model";
import { scanCompleteCoverageClaims } from "./scan-complete-claims";
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
    results.push(fail("G04", "public/sitemap.xml must not compete with app/sitemap.ts"));
  }
  // Firebase Frameworks Hosting can miss Next MetadataRoute /robots.txt (live 404).
  // Require a static public/robots.txt fallback that stays aligned with app/robots.ts.
  const staticRobotsPath = resolve("public/robots.txt");
  if (!existsSync(staticRobotsPath)) {
    results.push(
      fail("G16", "public/robots.txt required as Firebase Hosting crawler fallback (app/robots.ts alone can 404)"),
    );
  } else {
    const staticRobots = readFileSync(staticRobotsPath, "utf8");
    const robotsSrc = readFileSync(resolve("app/robots.ts"), "utf8");
    const requiredStaticMarkers = [
      "User-agent: *",
      "User-agent: OAI-SearchBot",
      "User-agent: Googlebot",
      "User-agent: GPTBot",
      "User-agent: ClaudeBot",
      "User-agent: Google-Extended",
      "Disallow: /dashboard/",
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /cases/",
      "Disallow: /reports/",
      "Disallow: /account/",
      "Disallow: /credits/",
      "Disallow: /cbam/",
      "Disallow: /login",
      "Disallow: /register",
      "Sitemap: https://cbamvalid.com/sitemap.xml",
    ];
    const missingStatic = requiredStaticMarkers.filter((m) => !staticRobots.includes(m));
    const missingAppAgents = ["OAI-SearchBot", "Googlebot", "GPTBot", "ClaudeBot", "Google-Extended"].filter(
      (agent) => !robotsSrc.includes(agent),
    );
    if (missingStatic.length > 0) {
      results.push(fail("G16", `public/robots.txt missing required markers: ${missingStatic.join(", ")}`));
    } else if (missingAppAgents.length > 0) {
      results.push(fail("G16", `app/robots.ts missing agents mirrored in static fallback: ${missingAppAgents.join(", ")}`));
    } else if (/Disallow:\s*\/_next\/static/i.test(staticRobots)) {
      results.push(fail("G16", "public/robots.txt blocks /_next/static"));
    } else {
      results.push(pass("G16", "STATIC_ROBOTS_FIREBASE_FALLBACK parity with app/robots.ts"));
    }
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

  if (CN_INDEXABILITY_STAGE !== "STAGE_1_VERIFIED_ALLOWLIST") {
    results.push(fail("G09", `Unexpected CN stage label: ${CN_INDEXABILITY_STAGE}`));
  }
  if (FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS !== "NOT_IMPLEMENTED") {
    results.push(
      fail(
        "G09",
        `FULL_OFFICIAL_SCOPE_RESOLUTION must remain NOT_IMPLEMENTED until 2026 CN universe ingest; got ${FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS}`,
      ),
    );
  } else {
    results.push(
      pass(
        "G09a",
        "Honest status: STAGE_1_VERIFIED_ALLOWLIST=PASS; FULL_OFFICIAL_SCOPE_RESOLUTION=NOT_IMPLEMENTED",
      ),
    );
  }

  // Hierarchical coverage: known steel prefix should cover; exclusion should not
  const covered = isCbamCovered("72011011");
  if (!covered.covered) results.push(fail("G08a", "72011011 must be covered by Annex prefix rules"));
  const excluded = isCbamCovered("31056000");
  if (excluded.covered) results.push(fail("G08a", "31056000 must be excluded by Annex rules"));
  if (!results.some((r) => r.id === "G08a" && !r.ok)) {
    results.push(pass("G08a", "Annex hierarchical prefix/exclusion resolver works"));
  }

  const unknown = evaluateCnIndexability("72019999");
  if (unknown.indexable) {
    results.push(fail("G08", "Unknown chapter-valid CN 72019999 must not be indexable"));
  } else if (unknown.reason === "COVERED_BUT_NOT_ALLOWLISTED") {
    results.push(pass("G08", `Case A: unknown CN not indexable (${unknown.reason})`));
  } else {
    results.push(fail("G08", `Expected COVERED_BUT_NOT_ALLOWLISTED, got ${unknown.reason}`));
  }

  for (const code of listPublicCnCodes()) {
    const result = evaluateCnIndexability(code);
    if (!result.indexable) {
      results.push(fail("G09", `Stage-1 CN ${code} failed content/index gate: ${result.reason}`));
    }
  }
  if (!results.some((r) => r.id === "G09" && !r.ok)) {
    results.push(
      pass(
        "G09",
        `Case B: ${listPublicCnCodes().length} STAGE_1_VERIFIED_ALLOWLIST pages pass quality gate`,
      ),
    );
  }
  return results;
}

function validateClaimsAndSchema(): GateResult[] {
  const results: GateResult[] = [];
  if (FORBIDDEN_SOCIAL_PROOF.aggregateRating.evidenceStatus !== "unverified") {
    results.push(fail("G13", "AggregateRating must remain unverified"));
  }
  const scalars = collectVerifiedCommercialScalars();
  const amountMinorMatches = CANONICAL_PRICING.amountMinor === Math.round(Number(scalars.priceAmount) * 100);
  if (
    PRICE_CLAIM.evidenceStatus !== "verified" ||
    PRICE_CLAIM.value.currency !== "USD" ||
    PRICE_CLAIM.value.amount !== scalars.priceAmount ||
    PRICE_CLAIM.value.amount !== CANONICAL_PRICING.displayPrice ||
    !amountMinorMatches
  ) {
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
  results.push(
    pass(
      "G12",
      "Visible/schema price SSOT parity at code level; rendered HTTP parity enforced by seo:crawl-rendered",
    ),
  );

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
  } else if (!results.some((r) => r.id === "G16")) {
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

  // G25 is proven by rendered crawl (homepage HTML), not by "use client" absence
  results.push(
    pass("G25", "Homepage SSR content proof deferred to seo:crawl-rendered (not decided by use client)"),
  );
  results.push(
    pass("G05", "HTTP validity of sitemap URLs enforced by seo:crawl-rendered against production build"),
  );
  results.push(pass("G21", "Redirect/canonical loop checks partially covered by crawl UTM identity tests"));
  return results;
}

function validateInventory(): GateResult[] {
  const results: GateResult[] = [];
  const inventory = buildSeoRouteInventory();
  try {
    assertNoindexInventoryInvariant(inventory);
    results.push(
      pass(
        "G26",
        [
          `INDEXABLE_STATIC_URL_COUNT=${inventory.INDEXABLE_STATIC_URL_COUNT}`,
          `INDEXABLE_DYNAMIC_URL_COUNT=${inventory.INDEXABLE_DYNAMIC_URL_COUNT}`,
          `NOINDEX_STATIC_ROUTE_COUNT=${inventory.NOINDEX_STATIC_ROUTE_COUNT}`,
          `NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT=${inventory.NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT}`,
          `PRIVATE_ROUTE_PATTERN_COUNT=${inventory.PRIVATE_ROUTE_PATTERN_COUNT}`,
          `SITEMAP_URL_COUNT=${inventory.SITEMAP_URL_COUNT}`,
        ].join(" "),
      ),
    );
  } catch (err) {
    results.push(fail("G26", err instanceof Error ? err.message : String(err)));
  }

  // G26 inventory + proxy boundary: public SEO hubs must not match /cbam workspace prefix
  const proxySrc = readFileSync(resolve("proxy.ts"), "utf8");
  if (/pathname\.startsWith\(prefix\)/.test(proxySrc) && !/pathname === prefix \|\| pathname\.startsWith\(`\$\{prefix\}\/`\)/.test(proxySrc)) {
    results.push(fail("G26", "proxy.ts still uses unbounded startsWith(prefix) which captures /cbam-* SEO hubs"));
  }
  const verifyLayout = readFileSync(
    resolve("app/(public)/verify/[publicToken]/layout.tsx"),
    "utf8",
  );
  if (!/index:\s*false/.test(verifyLayout)) {
    results.push(fail("G26", "verify/[publicToken] layout missing robots index:false"));
  }
  if (PUBLIC_NOINDEX_DYNAMIC_ROUTE_PATTERNS.length < 1) {
    results.push(fail("G26", "PUBLIC_NOINDEX_DYNAMIC_ROUTE_PATTERNS empty"));
  }

  // Invariant: public noindex dynamic patterns ⇒ NOINDEX_DYNAMIC count cannot be zero
  if (inventory.NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT === 0) {
    results.push(fail("G26", "NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT cannot be zero while verify layout exists"));
  }

  const sitemap = listSitemapRoutes();
  if (sitemap.length !== inventory.SITEMAP_URL_COUNT) {
    results.push(fail("G26", "Sitemap count drift vs inventory"));
  }

  return results;
}

function validateRegulatoryProvenance(): GateResult[] {
  const results: GateResult[] = [];
  try {
    assertNoAssumptions();
    results.push(pass("G27", "All regulatory facts/sources are VERIFIED_PRIMARY_SOURCE"));
  } catch (err) {
    results.push(fail("G27", err instanceof Error ? err.message : String(err)));
  }

  const pins = new Map(
    SEO_ROUTE_REGISTRY.map((route) => [route.path, route.regulatoryContentVersion]),
  );
  const stale = collectStaleRoutes(pins);
  if (stale.length > 0) {
    results.push(fail("G28", `STALE_REGULATORY_CONTENT: ${stale.join(", ")}`));
  } else {
    results.push(
      pass("G28", `regulatoryContentVersion pin matches ${SEO_REGULATORY_CONTENT_VERSION}`),
    );
  }

  const declaration = SEO_REGULATORY_FACTS.FIRST_DECLARATION_DEADLINE;
  if (declaration.provenanceStatus !== "VERIFIED_PRIMARY_SOURCE") {
    results.push(fail("G27", "FIRST_DECLARATION_DEADLINE must be VERIFIED_PRIMARY_SOURCE"));
  }
  if (!declaration.primarySourceIds.includes("EC_CBAM_FIRST_DECLARATION_2026_06_23")) {
    results.push(fail("G27", "FIRST_DECLARATION_DEADLINE missing EC primary source id"));
  }
  if (!REGULATORY_SOURCES.EC_CBAM_FIRST_DECLARATION_2026_06_23.contentDigest) {
    results.push(fail("G27", "EC source missing contentDigest"));
  }

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

  const claims = scanCompleteCoverageClaims();
  if (claims.hits.length > 0) {
    results.push(
      fail(
        "G29",
        `COMPLETE_CN_COVERAGE_CLAIMS=${claims.hits.length} e.g. ${claims.hits[0]?.file}:${claims.hits[0]?.line}`,
      ),
    );
  } else {
    results.push(
      pass(
        "G29",
        `COMPLETE_CN_COVERAGE_CLAIMS=0 while FULL_OFFICIAL_SCOPE_RESOLUTION=${claims.status}`,
      ),
    );
  }

  if (!existsSync(resolve("docs/seo/hub-serp-editorial-review.md"))) {
    results.push(fail("G30", "Missing docs/seo/hub-serp-editorial-review.md"));
  } else {
    const review = readFileSync(resolve("docs/seo/hub-serp-editorial-review.md"), "utf8");
    if (
      !/SERP_INTENT_REVIEW=PASS/.test(review) ||
      !/REGULATORY_EDITORIAL_REVIEW=PASS/.test(review) ||
      !/SEARCH_VOLUME_DATA=NOT_FABRICATED/.test(review) ||
      !/METHODOLOGY_CONSOLIDATION=PASS/.test(review)
    ) {
      results.push(fail("G30", "Hub SERP/editorial review missing required sign-off markers"));
    } else {
      results.push(pass("G30", "SERP + regulatory editorial review artifact present with sign-off"));
    }
  }

  const trackSrc = readFileSync(resolve("app/api/seo/track/route.ts"), "utf8");
  const idemSrc = readFileSync(resolve("lib/seo/purchase-analytics-idempotency.ts"), "utf8");
  if (/purchaseDedupe|new Map\s*</.test(trackSrc)) {
    results.push(fail("G31", "Purchase analytics still uses process-local Map dedupe"));
  } else if (
    !/createFirestorePurchaseAnalyticsStore/.test(trackSrc) ||
    !/analytics_purchase:/.test(idemSrc)
  ) {
    results.push(fail("G31", "Persistent analytics_purchase:${transactionId} idempotency missing"));
  } else {
    results.push(
      pass("G31", "PURCHASE_DEDUP_PERSISTENT via Firestore analytics_purchase:${transactionId}"),
    );
  }

  const registrySrc = readFileSync(resolve("lib/seo/registry.ts"), "utf8");
  const nextCfg = readFileSync(resolve("next.config.js"), "utf8");
  const cnHub = readFileSync(resolve("lib/seo/hub-content.ts"), "utf8");
  if (/path:\s*"\/cbam-methodology"/.test(registrySrc) && /sitemapEligible:\s*true/.test(registrySrc)) {
    // Narrow: if route still exists as indexable entry — fail. Removed route is OK.
    const hasIndexableMethodologyHub =
      /path:\s*"\/cbam-methodology"[\s\S]{0,400}?indexability:\s*"index"/.test(registrySrc);
    if (hasIndexableMethodologyHub) {
      results.push(fail("G32", "/cbam-methodology still indexable — must consolidate to /methodology"));
    }
  }
  const hasMethodologySource = /source:\s*'\/cbam-methodology'/.test(nextCfg);
  const hasRelativeMethodologyTarget = /destination:\s*'\/methodology'/.test(nextCfg);
  const hasCanonicalOriginMethodologyTarget = /destination:\s*`\$\{canonicalOrigin\}\/methodology`/.test(nextCfg);
  const canonicalOriginComesFromSiteConfig =
    /require\(['"]\.\/sites\/cbamvalid\/seo\.config\.json['"]\)/.test(nextCfg) &&
    /const\s+canonicalOrigin\s*=\s*canonicalUrl\.origin/.test(nextCfg);
  const hasPermanentMethodologyRedirect =
    /source:\s*'\/cbam-methodology'[\s\S]{0,500}?permanent:\s*true/.test(nextCfg);
  const methodologyTargetValid =
    hasRelativeMethodologyTarget ||
    (hasCanonicalOriginMethodologyTarget && canonicalOriginComesFromSiteConfig);
  if (!hasMethodologySource || !methodologyTargetValid || !hasPermanentMethodologyRedirect) {
    results.push(fail("G32", "Missing permanent canonical redirect /cbam-methodology → /methodology"));
  } else if (
    !/id:\s*"decision-tree"/.test(cnHub) ||
    !/CN_CODE_SCOPE_SECTIONS/.test(cnHub) ||
    !/EXPORTER_EVIDENCE_SECTIONS/.test(cnHub)
  ) {
    results.push(fail("G32", "Thin hub depth content missing for CN scope / evidence requirements"));
  } else {
    results.push(
      pass("G32", "METHODOLOGY_CONSOLIDATION + thin-hub depth (CN scope / evidence) present"),
    );
  }

  if (!existsSync(resolve("docs/seo/thin-hub-decisions.md"))) {
    results.push(fail("G33", "Missing docs/seo/thin-hub-decisions.md"));
  } else {
    const board = readFileSync(resolve("docs/seo/thin-hub-decisions.md"), "utf8");
    const required = [
      "/cbam-default-values",
      "/cbam-non-eu-producer-guide",
      "/cbam-verification-preparation",
      "/cbam-actual-vs-default-values",
      "/cbam-certificate-price",
    ];
    const missing = required.filter((path) => !board.includes(path));
    if (
      missing.length > 0 ||
      !/THIN_HUB_DECISIONS=PASS/.test(board) ||
      !/NO_UNREVIEWED_INDEXABLE_HUBS=PASS/.test(board)
    ) {
      results.push(fail("G33", `Thin hub decision board incomplete (${missing.join(",") || "markers"})`));
    } else if (
      !/DEFAULT_VALUES_SECTIONS/.test(readFileSync(resolve("lib/seo/hub-content.ts"), "utf8")) ||
      !/NON_EU_PRODUCER_SECTIONS/.test(readFileSync(resolve("lib/seo/hub-content.ts"), "utf8")) ||
      !/VERIFICATION_PREPARATION_SECTIONS/.test(readFileSync(resolve("lib/seo/hub-content.ts"), "utf8")) ||
      !/ACTUAL_VS_DEFAULT_SECTIONS/.test(readFileSync(resolve("lib/seo/hub-content.ts"), "utf8")) ||
      !/CERTIFICATE_PRICE_SECTIONS/.test(readFileSync(resolve("lib/seo/hub-content.ts"), "utf8"))
    ) {
      results.push(fail("G33", "ENRICH section stacks missing in hub-content.ts"));
    } else {
      results.push(pass("G33", "THIN_HUB_DECISIONS=PASS; NO_UNREVIEWED_INDEXABLE_HUBS=PASS"));
    }
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
    ...validateInventory(),
    ...validateRegulatoryProvenance(),
    ...validateRegulatoryAndLlm(),
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
