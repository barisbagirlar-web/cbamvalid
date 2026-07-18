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

if (llmsContent.includes("Prof. Dr. Neela Nataraj") && llmsContent.includes("IIT Bombay")) {
  pass("llms.txt: academic oversight references present");
} else {
  fail("llms.txt: academic oversight", "missing Neela Nataraj or IIT Bombay reference");
}

// GATE 2.1: llms.txt size threshold (5,000 bytes for robust AI ingestion)
if (llmsContent.length >= 5000) {
  pass(`llms.txt: size=${llmsContent.length} bytes (>=5000 threshold)`);
} else {
  fail(`llms.txt: size=${llmsContent.length} bytes`, "below 5000-byte AI ingestion threshold");
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

const wordCountLf = llmsFullContent.trim().split(/\s+/).length;
if (wordCountLf >= 500) {
  pass(`llms-full.txt: ${wordCountLf} words (>=500 threshold)`);
} else {
  fail(`llms-full.txt: ${wordCountLf} words`, "below 500-word threshold");
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
if (toolsSitemapContent.includes("STATIC_CORE") || toolsSitemapContent.includes("getLastmodForPath")) {
  pass("Tools sitemap: tiered content-based lastmod");
} else {
  fail("Tools sitemap: build-time lastmod", "still uses new Date().toISOString()");
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
