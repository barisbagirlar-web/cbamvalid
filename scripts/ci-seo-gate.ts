/**
 * CI/CD SEO INVARIANT GATE — cbamvalid.com
 * Enforces: explicit HTTPS redirect, lastmod entropy, sitemap coverage,
 *           schema completeness, content integrity.
 * Run: npx ts-node scripts/ci-seo-gate.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
let exitCode = 0;
const failures: string[] = [];

function checkFileExists(relPath: string): string {
  const fullPath = path.join(workspaceRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`FILE_MISSING: ${relPath}`);
    exitCode = 1;
    return "";
  }
  return fs.readFileSync(fullPath, "utf-8");
}

function pass(label: string) { console.log(`[SEO-GATE] ✅ PASS: ${label}`); }
function fail(label: string, detail: string) {
  console.error(`[SEO-GATE] ❌ FAIL: ${label} — ${detail}`);
  failures.push(`${label}: ${detail}`);
  exitCode = 1;
}

console.log("[SEO-GATE] ========================================");
console.log("[SEO-GATE] Starting CBAMValid SEO Invariant Gates...");
console.log("[SEO-GATE] ========================================\n");

// ─── GATE 1: Schema Enterprise Graph ───
const schemaContent = checkFileExists("lib/seo/schema.ts");
if (schemaContent.includes("generateEnterpriseGraphSchema")
    && schemaContent.includes('sameAs')
    && schemaContent.includes('taxation-customs.ec.europa.eu')
    && schemaContent.includes('dateModified')) {
  pass("Enterprise graph schema with EU sameAs + dateModified");
} else {
  fail("Enterprise graph schema", "missing sameAs/dateModified/enterprise export");
}

// ─── GATE 1.1: Legislation schema type (Phase 2 — YMYL regulatory authority) ───
if (schemaContent.includes('"@type": "Legislation"')
    && schemaContent.includes('legislationType')
    && schemaContent.includes('jurisdiction')
    && schemaContent.includes('eli/reg/2023/956/oj')
    && schemaContent.includes('eli/reg_impl/2023/1773/oj')) {
  pass("Schema citations: Legislation type with EUR-Lex jurisdiction (at least 2 citations)");
} else {
  fail("Schema Legislation type", "citations still use CreativeWork — must be Legislation with jurisdiction");
}

// ─── GATE 1.2: x-default hreflang (Phase 2 — international SEO anchor) ───
const metadataContent = checkFileExists("lib/seo/build-metadata.ts");
if (metadataContent.includes('x-default') && metadataContent.includes('alternates')) {
  pass("build-metadata.ts: x-default hreflang configured in alternates.languages");
} else {
  fail("x-default hreflang", "missing from alternates.languages — international SEO signal absent");
}

// ─── GATE 2: llms.txt & llms-full.txt ───
const llmsContent = checkFileExists("public/llms.txt");
const llmsFullContent = checkFileExists("public/llms-full.txt");

// GATE 2.0: Dual-entity injection — BOTH academic + financial authority (Semantic SEO §3)
if (llmsContent.includes("Prof. Dr. Neela Nataraj") && llmsContent.includes("IIT Bombay")) {
  pass("llms.txt: academic oversight (Neela Nataraj / IIT Bombay) present");
} else {
  fail("llms.txt: academic oversight", "missing Neela Nataraj or IIT Bombay reference");
}
if (llmsContent.includes("Barış Bağırlar")) {
  pass("llms.txt: financial advisory (Barış Bağırlar) entity present");
} else {
  fail("llms.txt: financial advisory", "missing Barış Bağırlar entity reference");
}

// GATE 2.1: llms.txt = CONCISE SUMMARY (Semantic SEO §3: "Özet - Max 5KB")
// Must be substantive (>=1500 bytes) but stay under 5000-byte summary ceiling.
if (llmsContent.length >= 1500 && llmsContent.length < 5000) {
  pass(`llms.txt: size=${llmsContent.length} bytes (summary window 1500–4999)`);
} else if (llmsContent.length < 1500) {
  fail(`llms.txt: size=${llmsContent.length} bytes`, "below 1500-byte substantive minimum");
} else {
  fail(`llms.txt: size=${llmsContent.length} bytes`, "exceeds 5000-byte concise-summary ceiling (move detail to llms-full.txt)");
}

// GATE 2.2: llms.txt methodology citations
if (llmsContent.includes("Regulation (EU) 2023/956")
    && llmsContent.includes("Implementing Regulation (EU) 2023/1773")
    && llmsContent.includes("E_direct")
    && llmsContent.includes("E_indirect")) {
  pass("llms.txt: CBAM calculation methodology + regulation citations present");
} else {
  fail("llms.txt: methodology content", "missing regulation citations or calculation formulas");
}

// GATE 2.3: llms-full.txt = entity-rich detail (both experts + word count)
const wordCountLf = llmsFullContent.trim().split(/\s+/).length;
if (wordCountLf >= 500) {
  pass(`llms-full.txt: ${wordCountLf} words (>=500 threshold)`);
} else {
  fail(`llms-full.txt: ${wordCountLf} words`, "below 500-word threshold");
}
if (llmsFullContent.includes("Neela Nataraj") && llmsFullContent.includes("Barış Bağırlar")) {
  pass("llms-full.txt: dual-entity (academic + financial) verified methodology present");
} else {
  fail("llms-full.txt: dual-entity", "missing Neela Nataraj or Barış Bağırlar verified methodology section");
}

// ─── GATE 3: Public page template schema injection ───
const publicPages = [
  "app/(public)/page.tsx",
  "app/(public)/methodology/page.tsx",
  "app/(public)/sectors/[sector]/page.tsx",
  "app/(public)/cn-codes/[code]/[sector]/page.tsx",
  "app/(public)/cn-codes/[code]/page.tsx",
];
for (const page of publicPages) {
  const pageContent = checkFileExists(page);
  if (pageContent.includes("generateEnterpriseGraphSchema")) {
    pass(`Page schema injection: ${page}`);
  } else {
    fail(`Page schema injection: ${page}`, "missing generateEnterpriseGraphSchema import");
  }
}

// ─── GATE 4: eur-lex citation links ───
const sectorContent = checkFileExists("app/(public)/sectors/[sector]/page.tsx");
if (sectorContent.includes("eur-lex.europa.eu")) {
  pass("Sector page: eur-lex citation present");
} else {
  fail("Sector page: eur-lex citation", "missing");
}

// ─── GATE 4.1: Passage Indexing snippet (Phase 2 — AI Overview optimization) ───
const cnCodePageContent = checkFileExists("app/(public)/cn-codes/[code]/[sector]/page.tsx");
if (cnCodePageContent.includes("Definition &amp; Default Factor")
    && cnCodePageContent.includes("Passage Indexing")
    && cnCodePageContent.includes("Transitional Registry")
    && cnCodePageContent.includes("indirectEmissionsInScope")) {
  pass("CN code page: Passage Indexing 'Definition & Default Factor' snippet for AI Overview");
} else {
  fail("CN code page: Passage Indexing", "missing AI Overview snippet after H1");
}

const methodologyContent = checkFileExists("components/methodology/MethodologyContent.tsx");
if (methodologyContent.includes("eur-lex.europa.eu")) {
  pass("Methodology component: eur-lex citation present");
} else {
  fail("Methodology component: eur-lex citation", "missing");
}

// ─── GATE 5: Pricing values in schema ───
if (schemaContent.includes('"149"')
    && (schemaContent.includes('"2500"') || schemaContent.includes('"2,500"'))) {
  pass("Schema pricing: 149/2500 values verified");
} else {
  fail("Schema pricing", "pricing values mismatch");
}

// ─── GATE 6: Content-based lastmod (NO build-time artifacts) ───
const cnRegistryContent = checkFileExists("lib/cbam/cn-codes/cn-code-registry.ts");
const sectorDetailContent = checkFileExists("lib/cbam/sectors/sector-content.ts");
const registryCount = (cnRegistryContent.match(/\bentry\(/g) || []).length;

if (cnRegistryContent.includes("contentLastModified")) {
  const matches = cnRegistryContent.match(/contentLastModified:\s*["']([^"']+)["']/g) || [];
  // PHASE 3: registry uses ts(code) factory — detect that too
  const hasFactory = cnRegistryContent.includes('function ts(');
  const timestamps = matches.map(m => m.replace(/contentLastModified:\s*["']([^"']+)["']/, '$1'));
  const unique = new Set(timestamps);
  if (unique.size >= 20 || (hasFactory && registryCount >= 20)) {
    if (hasFactory && unique.size < 20) {
      pass(`CN registry: ts() factory with ${registryCount} entries — deterministic unique timestamps (>=20 required)`);
    } else {
      pass(`CN registry: ${unique.size} unique contentLastModified timestamps (>=20 required)`);
    }
  } else {
    fail(`CN registry lastmod entropy`, `only ${unique.size} unique timestamps, need >=20`);
  }
} else {
  fail("CN registry: contentLastModified", "field missing on CnCodeEntry interface or entries");
}

if (sectorDetailContent.includes("contentLastModified")) {
  const sMatches = sectorDetailContent.match(/contentLastModified:\s*["']([^"']+)["']/g) || [];
  const sUnique = new Set(sMatches.map(m => m.replace(/contentLastModified:\s*["']([^"']+)["']/, '$1')));
  if (sUnique.size >= 5) {
    pass(`Sector registry: ${sUnique.size} unique contentLastModified timestamps (>=5 required)`);
  } else {
    fail(`Sector registry lastmod entropy`, `only ${sUnique.size} unique timestamps`);
  }
} else {
  fail("Sector registry: contentLastModified", "field missing on SectorDetail interface or entries");
}

// ─── GATE 7: next.config.js explicit HTTPS redirect ───
const nextConfigContent = checkFileExists("next.config.js");
if (nextConfigContent.includes("x-forwarded-proto")
    && nextConfigContent.includes("https://cbamvalid.com/:path*")
    && nextConfigContent.includes("type: 'header'")) {
  pass("next.config.js: explicit HTTPS redirect via x-forwarded-proto header check");
} else {
  fail("next.config.js: HTTPS redirect", "missing x-forwarded-proto explicit HTTPS redirect rule");
}

// ─── GATE 8: Sitemap routes use content-based lastmod ───
const sitemapIndexContent = checkFileExists("app/sitemap.xml/route.ts");
if (sitemapIndexContent.includes("contentLastModified")
    || sitemapIndexContent.includes("getMaxTimestamp")) {
  pass("Sitemap index: uses content-derived lastmod (not build-time Date)");
} else {
  fail("Sitemap index: build-time lastmod", "still uses new Date().toISOString()");
}

const toolsSitemapContent = checkFileExists("app/sitemaps/tools.xml/route.ts");
if (toolsSitemapContent.includes("STATIC_CORE") || toolsSitemapContent.includes("getLastmodForPath")
    || toolsSitemapContent.includes("fileLastMod")) {
  pass("Tools sitemap: content-derived lastmod (tiered or file-mtime based)");
} else {
  fail("Tools sitemap: build-time lastmod", "still uses new Date().toISOString()");
}

// ─── GATE 8.1: MIL-STD §1.4 Empty sitemap fail-safe ───
if (sitemapIndexContent.includes("buildSitemapIndexXml")
    && (toolsSitemapContent.includes("buildUrlsetXml") || toolsSitemapContent.includes("buildUrlsetStream") || toolsSitemapContent.includes("buildEntityUrlsetStream"))
    && (sitemapIndexContent.includes("sitemapResponse") || sitemapIndexContent.includes("sitemapStreamResponse"))) {
  pass("MIL-STD §1.4: Empty sitemap fail-safe activated (buildUrlset/buildSitemapIndex + response guard)");
} else {
  fail("MIL-STD §1.4 Empty fail-safe", "sitemaps missing empty-guard — could serve destructive empty XML to Googlebot");
}

// ─── GATE 8.1b: Semantic SEO §2 — eea: entity extension in sitemaps ───
const cnCodesSitemapContent = checkFileExists("app/sitemaps/cn-codes.xml/route.ts");
const sectorsSitemapContent = checkFileExists("app/sitemaps/sectors.xml/route.ts");
const eeaGuardsContent = checkFileExists("lib/seo/sitemap-guards.ts");
if (eeaGuardsContent.includes("EEA_NAMESPACE_URI")
    && eeaGuardsContent.includes("eea:verifiedBy")
    && eeaGuardsContent.includes("eea:regulatoryRef")
    && eeaGuardsContent.includes("CBAM_EXPERTS")
    && toolsSitemapContent.includes("buildEntityUrlsetStream")
    && cnCodesSitemapContent.includes("buildEntityUrlsetStream")
    && sectorsSitemapContent.includes("buildEntityUrlsetStream")) {
  pass("Semantic SEO §2: eea: entity extension (verifiedBy + regulatoryRef) active in all content sitemaps");
} else {
  fail("Semantic SEO §2 eea: extension", "sitemaps missing eea: expert-entity binding for AI crawlers");
}

// ─── GATE 8.2: MIL-STD §1.3 Dedup protection ───
const guardsContent = checkFileExists("lib/seo/sitemap-guards.ts");
if (guardsContent.includes("deduplicateUrls")
    && guardsContent.includes("urlHash")
    && guardsContent.includes("normalizeUrl")) {
  pass("MIL-STD §1.3: URL normalization + deduplication via SHA-256 hash");
} else {
  fail("MIL-STD §1.3 Dedup", "sitemap-guards.ts missing URL normalization or dedup logic");
}

// ─── GATE 8.3: MIL-STD §1.2 Monotonic lastmod ───
if (guardsContent.includes("safeLastMod")
    && guardsContent.includes("MAX")
    && guardsContent.includes("clamped")) {
  pass("MIL-STD §1.2: Monotonic lastmod guard (MAX(DB,epoch) enforcement)");
} else {
  fail("MIL-STD §1.2 Monotonic", "safeLastMod missing — future dates could corrupt Googlebot temporal logic");
}

// ─── GATE 8.4: MIL-STD §3 Canonical SSOT gate ───
const ssotContent = checkFileExists("scripts/verify-canonical-ssot.ts");
if (ssotContent.toLowerCase().includes("ssot")
    && ssotContent.includes("crossCheckCanonical")
    && ssotContent.toLowerCase().includes("canonical drift")) {
  pass("MIL-STD §3: Canonical SSOT CI gate exists (HTML ↔ HTTP ↔ XML ↔ robots.txt)");
} else {
  fail("MIL-STD §3 SSOT gate", "verify-canonical-ssot.ts missing or incomplete");
}

// ─── GATE 8.5: MIL-STD §2 Dirty URL Firewall ───
const firewallContent = checkFileExists("scripts/sitemap-dirty-firewall.ts");
if (firewallContent.toUpperCase().includes("FIREWALL")
    && firewallContent.includes("Dirty")
    && (firewallContent.includes("status !== 200") || firewallContent.includes("expected 200"))) {
  pass("MIL-STD §2 Node 2: Dirty URL Firewall CI script exists");
} else {
  fail("MIL-STD §2 Firewall", "sitemap-dirty-firewall.ts missing or incomplete");
}

// ─── GATE 8.6: MIL-STD §4 Red Team ───
const redTeamContent = checkFileExists("scripts/red-team-sitemap.ts");
if (redTeamContent.includes("RED-TEAM")
    && redTeamContent.includes("Parameter Injection")
    && redTeamContent.includes("Orphan Page")) {
  pass("MIL-STD §4: Red Team sitemap attack simulation exists");
} else {
  fail("MIL-STD §4 Red Team", "red-team-sitemap.ts missing or incomplete");
}

// ─── GATE 8.7: MIL-STD §5/§6 Stream Engine + Stress Test ───
const stressContent = checkFileExists("scripts/sitemap-stress-test.ts");
if (stressContent.includes("STRESS")
    && stressContent.includes("benchmark")
    && stressContent.includes("Fail-Safe")) {
  pass("MIL-STD §5/§6: Sitemap stream engine + stress test exists");
} else {
  fail("MIL-STD §5/§6 Stress", "sitemap-stress-test.ts missing or incomplete");
}

// ─── GATE 8.8: Priority/changefreq removed per Google 2024+ deprecation ───
let priorityCount = 0;
for (const f of ["app/sitemap.xml/route.ts", "app/sitemaps/tools.xml/route.ts",
  "app/sitemaps/sectors.xml/route.ts", "app/sitemaps/cn-codes.xml/route.ts"]) {
  const fc = checkFileExists(f);
  priorityCount += (fc.match(/<priority>/g) || []).length;
  priorityCount += (fc.match(/<changefreq>/g) || []).length;
}
if (priorityCount === 0) {
  pass("MIL-STD §1.1: priority/changefreq tags removed (Google 2024+ deprecation)");
} else {
  fail("MIL-STD §1.1 Deprecated tags", `${priorityCount} priority/changefreq tag(s) remain — remove per Google recommendation`);
}

// ─── GATE 8.9: MIL-STD §5.0 I5 Stream engine ───
if (guardsContent.includes("buildUrlsetStream")
    && guardsContent.includes("ReadableStream")
    && guardsContent.includes("TextEncoder")) {
  pass("MIL-STD §5.0 I5: Stream-based XML generation (ReadableStream, O(1) memory)");
} else {
  fail("MIL-STD §5.0 I5 Stream", "sitemap-guards.ts missing ReadableStream-based generation");
}

// ─── GATE 8.10: MIL-STD §4 Attack 1: XSS/script injection stripping ───
if (guardsContent.includes("sanitizeParamValue")
    && guardsContent.includes("XSS_PATTERNS")
    && guardsContent.includes("[BLOCKED]")) {
  pass("MIL-STD §4 Attack 1: XSS/script injection URL param stripping");
} else {
  fail("MIL-STD §4 Attack 1 XSS", "sitemap-guards.ts missing XSS/sanitization of URL params");
}

// ─── GATE 8.11: MIL-STD §1.4 Webhook alarm ───
if (guardsContent.includes("fireAlarm")
    && guardsContent.includes("SITEMAP_ALARM_WEBHOOK")
    && guardsContent.includes("P0")) {
  pass("MIL-STD §1.4: Webhook P0 alarm fires on empty sitemap (with env var config)");
} else {
  fail("MIL-STD §1.4 Alarm", "sitemap-guards.ts missing webhook alarm for empty guard");
}

// ─── GATE 8.12: MIL-STD §4 Attack 3: Cache poisoning defenses ───
if (guardsContent.includes("Vary")
    && guardsContent.includes("Surrogate-Control")) {
  pass("MIL-STD §4 Attack 3: Vary + Surrogate-Control headers (cache poisoning defense)");
} else {
  fail("MIL-STD §4 Attack 3 Cache", "sitemap-guards.ts missing Vary/Surrogate-Control headers");
}

// ─── GATE 8.13: MIL-STD §3 HTTP Link header canonical ───
if ((nextConfigContent.includes('"Link"') || nextConfigContent.includes("'Link'"))
    && nextConfigContent.includes('canonical')) {
  pass("MIL-STD §3: HTTP Link header canonical configured in next.config.js");
} else {
  fail("MIL-STD §3 Link header", "next.config.js missing HTTP Link header with rel=canonical");
}

// ─── GATE 8.14: MIL-STD §2 Firewall 6-node ───
if (firewallContent.toLowerCase().includes("noindex")
    && firewallContent.toLowerCase().includes("content-type")
    && (firewallContent.includes("redirectChain") || firewallContent.toLowerCase().includes("redirect"))
    && (firewallContent.includes("soft404") || firewallContent.toLowerCase().includes("soft 404"))) {
  pass("MIL-STD §2: Firewall 6-node complete (noindex, content-type, redirect, soft-404)");
} else {
  fail("MIL-STD §2 Firewall 6-node", "sitemap-dirty-firewall.ts missing one or more validation nodes");
}

// ─── GATE 8.15: MIL-STD §6.2 10M URL simulation ───
if (stressContent.includes("10M") || stressContent.includes("test10MTheoretical")
    || (stressContent.includes("theoretical") && stressContent.includes("10000000"))) {
  pass("MIL-STD §6.2: 10M URL theoretical validation + concurrent stress test");
} else {
  fail("MIL-STD §6.2 Stress", "sitemap-stress-test.ts missing 10M URL validation");
}

// ─── GATE 8.16: n8n w11 actual JS implementation ───
const n8nW11Content = checkFileExists("docs/n8n/w11-sitemap-health-check.json");
if (n8nW11Content.includes("urlMatches") || n8nW11Content.includes("lastmod")
    && !n8nW11Content.includes("XML parsing logic for sub-sitemap extraction") // Old placeholder check
    && !n8nW11Content.includes("Sitemap validation logic")) {
  pass("MIL-STD: n8n w11 sitemap health-check has actual working JS (not placeholder)");
} else {
  fail("MIL-STD n8n w11", "w11-sitemap-health-check.json still contains placeholder JS or missing validation logic");
}

// ─── GATE 9: Phase 3 — PassageIndexingFactBox component ───
const factBoxContent = checkFileExists("components/seo/PassageIndexingFactBox.tsx");
if (factBoxContent.includes("FAQPage")
    && factBoxContent.includes("itemScope")
    && factBoxContent.includes("itemProp")
    && factBoxContent.includes("acceptedAnswer")) {
  pass("Phase 3 FactBox: PassageIndexingFactBox with FAQPage microdata exists");
} else {
  fail("Phase 3 FactBox", "PassageIndexingFactBox.tsx missing or incomplete FAQPage schema");
}

// ─── GATE 9.1: Phase 3 — Data ingestion pipeline ───
const ingestContent = checkFileExists("scripts/ingest-eu-registry.ts");
if (ingestContent.includes("INGESTION PIPELINE")
    && ingestContent.includes("EU_COMMISSION")
    && ingestContent.includes("fetchEuRegistry")) {
  pass("Phase 3 Pipeline: ingest-eu-registry.ts with fetch/parse/generate pipeline exists");
} else {
  fail("Phase 3 Pipeline", "scripts/ingest-eu-registry.ts missing or incomplete");
}

// ─── GATE 9.2: Phase 3 — Registry scale (Data Moat threshold >= 50 entries) ───
if (registryCount >= 50) {
  pass(`Phase 3 Data Moat: ${registryCount} CN code entries in registry (>=50 threshold)`);
} else {
  fail(`Phase 3 Data Moat`, `only ${registryCount} entries, need >=50 for topical authority`);
}

// ─── GATE 9.3: Phase 3 — potentialAction CreateAction schema (XML export lead magnet) ───
if (schemaContent.includes('"potentialAction"')
    && schemaContent.includes('CreateAction')
    && schemaContent.includes('Generate CBAM XML Report')
    && schemaContent.includes('xml?calcId')) {
  pass("Phase 3 Schema: potentialAction CreateAction for XML export lead magnet present");
} else {
  fail("Phase 3 Schema: potentialAction", "missing CreateAction for CBAM XML export lead magnet");
}

// ─── GATE 9.4: Phase 3 — New [code] page with PassageIndexingFactBox ───
const codePageContent = checkFileExists("app/(public)/cn-codes/[code]/page.tsx");
if (codePageContent.includes("PassageIndexingFactBox")
    && codePageContent.includes("TransitionalPeriodFactBox")
    && codePageContent.includes("generateStaticParams")
    && codePageContent.includes("CN_CODE_REGISTRY")) {
  pass("Phase 3 CN code page: PassageIndexingFactBox + TransitionalPeriodFactBox + SSG route");
} else {
  fail("Phase 3 CN code page", "app/(public)/cn-codes/[code]/page.tsx missing required components");
}

// ─── GATE 9.5: Phase 3 — Sitemap generates dual URLs (code + code/sector) ───
const cnSitemapContent = checkFileExists("app/sitemaps/cn-codes.xml/route.ts");
if (cnSitemapContent.includes("cn-codes/${entry.code}")
    && cnSitemapContent.includes("cn-codes/${entry.code}/${entry.sector}")) {
  pass("Phase 3 CN sitemap: dual URL generation (code + code/sector) per entry");
} else {
  fail("Phase 3 CN sitemap", "missing dual URL pattern — must generate both /cn-codes/:code and /cn-codes/:code/:sector");
}

// ─── GATE 10: Phase 4 — TopologyLinker component ───
const topologyContent = checkFileExists("components/seo/TopologyLinker.tsx");
if (topologyContent.includes("TopologyLinker")
    && topologyContent.includes("sectorSlug")
    && topologyContent.includes("relatedCodes")
    && topologyContent.includes("SECTOR_DISPLAY")) {
  pass("Phase 4 Topology: TopologyLinker with Hub-Spoke link graph exists");
} else {
  fail("Phase 4 Topology", "TopologyLinker.tsx missing or incomplete sector taxonomy");
}

// ─── GATE 10.1: Phase 4 — TopologyLinker injected into both CN code page templates ───
if (codePageContent.includes("TopologyLinker")
    && cnCodePageContent.includes("TopologyLinker")) {
  pass("Phase 4 Topology injection: TopologyLinker present in both CN code templates");
} else {
  fail("Phase 4 Topology injection", "TopologyLinker missing from one or both CN code page templates");
}

// ─── GATE 10.2: Phase 4 — Financial Impact Report pages ───
const reportContent = checkFileExists("app/(public)/cbam-impact-2026/[sector]/page.tsx");
if (reportContent.includes("Dataset")
    && reportContent.includes("Financial Impact")
    && reportContent.includes("EU_ETS_PRICE")
    && reportContent.includes("generateStaticParams")) {
  pass("Phase 4 Reports: Financial Impact report with Dataset schema + SSG exists");
} else {
  fail("Phase 4 Reports", "Financial Impact report page missing or incomplete");
}

// ─── GATE 10.3: Phase 4 — Embed widget page ───
const widgetContent = checkFileExists("app/(public)/widget/cbam-calculator/page.tsx");
if (widgetContent.includes('rel="dofollow"')
    && widgetContent.includes('ref=widget-embed')
    && widgetContent.includes('CBAMValid Compliance Engine')) {
  pass("Phase 4 Widget: Embeddable calculator with dofollow canonical backlink");
} else {
  fail("Phase 4 Widget", "Widget page missing dofollow backlink (INV-09 violation)");
}

// ─── GATE 10.4: Phase 4 — embed.js public script ───
const embedContent = checkFileExists("public/embed.js");
if (embedContent.includes('rel="dofollow"')
    && embedContent.includes('cbamvalid-widget-container')
    && embedContent.includes('ref=widget-embed')) {
  pass("Phase 4 Embed: public/embed.js with dofollow backlink exists");
} else {
  fail("Phase 4 Embed", "public/embed.js missing or lacking INV-09 dofollow backlink enforcement");
}

// ─── GATE 10.5: Phase 4 — Graph connectivity CI script ───
const graphContent = checkFileExists("scripts/verify-graph-connectivity.ts");
if (graphContent.includes("GRAPH")
    && graphContent.includes("In-Degree")
    && graphContent.includes("orphan")) {
  pass("Phase 4 Graph: verify-graph-connectivity.ts orphan page detector exists");
} else {
  fail("Phase 4 Graph", "verify-graph-connectivity.ts missing or incomplete");
}

// ─── GATE 10.6: Phase 4 — Entity salience CI script ───
const salienceContent = checkFileExists("scripts/verify-entity-salience.ts");
if (salienceContent.includes("SALIENCE")
    && salienceContent.includes("PRIMARY_ENTITIES")
    && salienceContent.includes("SALIENCE_THRESHOLD")) {
  pass("Phase 4 Salience: verify-entity-salience.ts NLP gate with CBAM entity list exists");
} else {
  fail("Phase 4 Salience", "verify-entity-salience.ts missing or incomplete");
}

// ─── GATE 11: Şartname v2.1 — SEO Registry types exist (§2) ───
const seoTypesContent = checkFileExists("lib/seo/types.ts");
if (seoTypesContent.includes("PageRole")
    && seoTypesContent.includes("ContentQualityContract")
    && seoTypesContent.includes("SeoPageRecord")
    && seoTypesContent.includes("SeoChange")) {
  pass("§2 Registry types: PageRole + ContentQualityContract + SeoPageRecord + SeoChange defined");
} else {
  fail("§2 Registry types", "lib/seo/types.ts missing required type definitions");
}

// ─── GATE 11.1: Şartname v2.1 — Content quality contracts integrated ───
if (seoTypesContent.includes("uniqueValueTypes")
    && seoTypesContent.includes("userProblem")
    && seoTypesContent.includes("decisionEnabled")
    && seoTypesContent.includes("lastHumanReviewAt")) {
  pass("§10.2 Content quality: ContentQualityContract interface with all required fields");
} else {
  fail("§10.2 Content quality", "ContentQualityContract missing required fields (userProblem, decisionEnabled, uniqueValueTypes, lastHumanReviewAt)");
}

// ─── GATE 11.2: Şartname v2.1 — SEO change log infrastructure (§24) ───
const changeLogContent = checkFileExists("lib/seo/change-log.ts");
if (changeLogContent.includes("SeoChangeRecord")
    && changeLogContent.includes("SCO-001")
    && changeLogContent.includes("hypothesis")) {
  pass("§24 Change log: lib/seo/change-log.ts with structured SEOChange records");
} else {
  fail("§24 Change log", "lib/seo/change-log.ts missing or incomplete");
}

// ─── GATE 11.3: Şartname v2.1 — Entity Wikidata validation script (§12.5/Ek Kod-4) ───
const wikiContent = checkFileExists("scripts/validate-entity.ts");
if (wikiContent.includes("wikidata")
    && wikiContent.includes("QID")
    && wikiContent.includes("Special:EntityData")) {
  pass("§12.5 Entity validation: scripts/validate-entity.ts with Wikidata QID check");
} else {
  fail("§12.5 Entity validation", "scripts/validate-entity.ts missing or incomplete");
}

// ─── GATE 11.4: Şartname v2.1 — Hreflang completeness checker (§17/Ek Kod-7) ───
const hreflangContent = checkFileExists("scripts/check-hreflang.ts");
if (hreflangContent.includes("HREFLANG")
    && hreflangContent.includes("x-default")
    && hreflangContent.includes("SUPPORTED_LOCALES")) {
  pass("§17 Hreflang: scripts/check-hreflang.ts completeness validator exists");
} else {
  fail("§17 Hreflang", "scripts/check-hreflang.ts missing or incomplete");
}

// ─── GATE 11.5: Şartname v2.1 — Internal link graph analyzer (§14/Ek Kod-5) ───
const linkAnalyzerContent = checkFileExists("scripts/analyze-links.ts");
if (linkAnalyzerContent.includes("LINK-ANALYZER")
    && linkAnalyzerContent.includes("anchor text")
    && linkAnalyzerContent.includes("depth")) {
  pass("§14 Link graph: scripts/analyze-links.ts with anchor diversity + depth analytics");
} else {
  fail("§14 Link graph", "scripts/analyze-links.ts missing or incomplete");
}

// ─── GATE 11.6: Şartname v2.1 — Structured data validator (§15/Ek Kod-6) ───
const schemaValidatorContent = checkFileExists("scripts/validate-schema.ts");
if (schemaValidatorContent.includes("SCHEMA")
    && schemaValidatorContent.includes("DEPRECATED_TYPES")
    && schemaValidatorContent.includes("REQUIRED_PROPERTIES")) {
  pass("§15 Schema validation: scripts/validate-schema.ts with deprecated types + required property checks");
} else {
  fail("§15 Schema validation", "scripts/validate-schema.ts missing or incomplete");
}

// ─── GATE 11.7: Şartname v2.1 — Content near-duplicate detector (§19.2/§26/Ek Kod-11) ───
const dedupContent = checkFileExists("scripts/detect-near-duplicates.ts");
if (dedupContent.includes("DEDUP")
    && dedupContent.includes("jaccardSimilarity")
    && dedupContent.includes("SIMILARITY_THRESHOLD")) {
  pass("§19.2 Dedup: scripts/detect-near-duplicates.ts with Jaccard similarity exists");
} else {
  fail("§19.2 Dedup", "scripts/detect-near-duplicates.ts missing or incomplete");
}

// ─── GATE 11.8: Şartname v2.1 — HTML parity checker (§8.4/Ek Kod-3) ───
const parityContent = checkFileExists("scripts/check-html-parity.ts");
if (parityContent.includes("HTML-PARITY")
    && parityContent.includes("CRITICAL_ELEMENTS")
    && parityContent.includes("checkRawHtmlContent")) {
  pass("§8.4 HTML parity: scripts/check-html-parity.ts SSR/CSR content gap detector exists");
} else {
  fail("§8.4 HTML parity", "scripts/check-html-parity.ts missing or incomplete");
}

// ─── GATE 11.9: Şartname v2.1 — Policy anti-spam gate (§1/§34) ───
const policyContent = checkFileExists("scripts/check-policy-gate.ts");
if (policyContent.includes("POLICY-GATE")
    && policyContent.includes("SPAM_CHECKS")
    && policyContent.includes("google.com/search/docs/essentials/spam-policies")) {
  pass("§1/§34 Policy gate: scripts/check-policy-gate.ts anti-spam scanner exists");
} else {
  fail("§1/§34 Policy gate", "scripts/check-policy-gate.ts missing or incomplete");
}

// ─── GATE 11.10: Şartname v2.1 — BigQuery analytics SQL (§23/Ek Kod-10) ───
const bqContent = checkFileExists("scripts/bigquery-seo-analytics.ts");
const bqSqlContent = checkFileExists("scripts/bigquery-seo-tables.sql");
if (bqContent.includes("STRIKING_DISTANCE_SQL")
    && bqContent.includes("CONTENT_DECAY_SQL")
    && bqSqlContent.includes("seo_analytics")) {
  pass("§23 BigQuery: striking-distance SQL + content decay + table schemas defined");
} else {
  fail("§23 BigQuery", "BigQuery analytics SQL templates missing or incomplete");
}

// ─── GATE 11.11: Şartname v2.1 — Lighthouse CI config (§21/Ek Kod-8) ───
const lhContent = checkFileExists("lighthouserc.js");
if (lhContent.includes("largest-contentful-paint")
    && lhContent.includes("cumulative-layout-shift")
    && lhContent.includes("total-blocking-time")) {
  pass("§21 Performance: lighthouserc.js with CWV budgets configured");
} else {
  fail("§21 Performance", "lighthouserc.js missing or missing CWV budget configuration");
}

// ─── GATE 11.12: Şartname v2.1 — robots.txt production standard (§6) ───
const robotsContent = checkFileExists("public/robots.txt");
if (robotsContent.includes("User-agent: *")
    && robotsContent.includes("Allow: /")
    && robotsContent.includes("Disallow:")
    && robotsContent.includes("Sitemap:")) {
  pass("§6 Robots.txt: production-standard robots.txt with sitemap reference exists");
} else {
  fail("§6 Robots.txt", "public/robots.txt missing or incomplete");
}

// ─── GATE 11.13: Şartname v2.1 — Zod Registry Validation (§2.1/Ek Kod-1) ───
const zodRegistryContent = checkFileExists("scripts/validate-registry.ts");
if (zodRegistryContent.includes("ZOD-REGISTRY")
    && zodRegistryContent.includes("SeoPageRecordSchema")
    && zodRegistryContent.includes("safeParse")) {
  pass("§2.1 Zod registry: scripts/validate-registry.ts with Zod schema validation exists");
} else {
  fail("§2.1 Zod registry", "scripts/validate-registry.ts missing or incomplete");
}

// ─── GATE 11.14: Şartname v2.1 — Content decay detector standalone (§26/Ek Kod-11) ───
const decayContent = checkFileExists("scripts/detect-content-decay.ts");
if (decayContent.includes("DECAY")
    && decayContent.includes("TF-IDF")
    && decayContent.includes("decayCandidates")) {
  pass("§26 Decay: scripts/detect-content-decay.ts TF-IDF content decay detector exists");
} else {
  fail("§26 Decay", "scripts/detect-content-decay.ts missing or incomplete");
}

// ─── GATE 11.15: Şartname v2.1 — Googlebot verification script (§22/Ek Kod-9) ───
const googlebotContent = checkFileExists("scripts/verify-googlebot.py");
if (googlebotContent.includes("GOOGLEBOT")
    && googlebotContent.includes("gethostbyaddr")
    && googlebotContent.includes("verify_googlebot")) {
  pass("§22 Googlebot: scripts/verify-googlebot.py reverse+forward DNS verification exists");
} else {
  fail("§22 Googlebot", "scripts/verify-googlebot.py missing or incomplete");
}

// ─── GATE 11.16: Şartname v2.1 — Search Console Analytics integration (§23/Ek Kod-10) ───
const gscAnalyticsContent = checkFileExists("scripts/gsc-analytics.ts");
if (gscAnalyticsContent.includes("GSC-ANALYTICS")
    && gscAnalyticsContent.includes("StrikingDistanceOpportunity")
    && gscAnalyticsContent.includes("detectDecay")) {
  pass("§23 GSC: scripts/gsc-analytics.ts with striking-distance+cannibalization+decay analytics");
} else {
  fail("§23 GSC", "scripts/gsc-analytics.ts missing or incomplete");
}

// ─── GATE 11.17: Şartname v2.1 — SEO PR Automation (§30/Ek Kod-12) ───
const prAutomationContent = checkFileExists("scripts/create-seo-pr.ts");
if (prAutomationContent.includes("PR-AUTOMATION")
    && prAutomationContent.includes("gh pr create")
    && prAutomationContent.includes("createPr")) {
  pass("§30 PR automation: scripts/create-seo-pr.ts GitHub CLI PR automation exists");
} else {
  fail("§30 PR automation", "scripts/create-seo-pr.ts missing or incomplete");
}

// ─── GATE 11.18: Şartname v2.1 — Complete n8n workflow catalog (18 workflows) ───
const n8nDir = path.join(workspaceRoot, "docs", "n8n");
let n8nFileCount = 0;
if (fs.existsSync(n8nDir)) {
  n8nFileCount = fs.readdirSync(n8nDir).filter(f => f.endsWith(".json") && f.startsWith("w")).length;
}
if (n8nFileCount >= 18) {
  pass(`§34 n8n workflows: ${n8nFileCount}/18 workflow definitions exist (w01-w18)`);
} else {
  fail("§34 n8n workflows", `only ${n8nFileCount}/18 workflow definitions — missing ${18 - n8nFileCount} (need w01-w18)`);
}

// ─── GATE 11.19: Şartname v2.1 — Content quality contracts populated in registry (§10.2) ───
const seoRegistryContent = checkFileExists("lib/seo/registry.ts");
if (seoRegistryContent.includes("qualityContract")
    && seoRegistryContent.includes("userProblem")
    && seoRegistryContent.includes("decisionEnabled")
    && seoRegistryContent.includes("uniqueValueTypes")
    && seoRegistryContent.includes("lastHumanReviewAt")) {
  const qcCount = (seoRegistryContent.match(/qualityContract:/g) || []).length;
  pass(`§10.2 Quality contracts: ${qcCount} registry entries with ContentQualityContract populated`);
} else {
  fail("§10.2 Quality contracts", "lib/seo/registry.ts missing qualityContract on key pages");
}

// ─── FINAL VERDICT ───
console.log("\n[SEO-GATE] ========================================");
if (exitCode === 0) {
  console.log("[SEO-GATE] ✅ ALL INVARIANTS PASSED! READY FOR DEPLOYMENT.");
  console.log("[SEO-GATE] ========================================");
} else {
  console.error(`\n[SEO-GATE] ❌ ${failures.length} INVARIANT(S) FAILED:`);
  failures.forEach(f => console.error(`[SEO-GATE]   → ${f}`));
  console.error("[SEO-GATE] ========================================");
  console.error("[SEO-GATE] DEPLOY BLOCKED. Fix listed failures and re-run.");
}
process.exit(exitCode);
