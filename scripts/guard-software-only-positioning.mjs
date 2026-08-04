#!/usr/bin/env node
/**
 * Paddle domain-review and software-only positioning guard.
 *
 * Fails closed when public commercial or machine-readable surfaces:
 *   - use obsolete compliance-validation or service-style product names;
 *   - advertise human services or removed service routes;
 *   - expose placeholder or inconsistent legal identity copy;
 *   - omit the canonical software classification, price or digital delivery;
 *   - allow generated answer feeds to drift back to unsafe product naming.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else if (/\.(tsx|ts|mjs|json|txt|md|svg|xml|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORBIDDEN_ROUTES = [
  "/enterprise",
  "/enterprise/sso",
  "/enterprise/holding",
  "/partners",
  "/verifier-review",
];

const FORBIDDEN_ROUTE_DIRECTORIES = [
  "app/(public)/enterprise",
  "app/(public)/partners",
  "app/(public)/verifier-review",
];

const NEGATIVE_MARKERS = [
  "does not include",
  "does not provide",
  "does not sell",
  "does not offer",
  "doesn't include",
  "doesn't provide",
  "not include",
  "not included",
  "not sold",
  "not purchase",
  "not part of",
  "no human",
  "no consulting",
  "no government",
  "excluded",
  "outside the scope",
  "do not include",
  "won't include",
  "not provided",
];

const FORBIDDEN_PHRASES = [
  "Human path",
  "Speak with a human",
  "Enterprise scoping",
  "Request Enterprise scoping",
  "Enterprise SOW",
  "Statement of Work",
  "Custom onboarding",
  "Professional services",
  "Managed compliance",
  "Talk to an expert",
  "Expert access",
  "Dossier assistance",
  "Methodology support",
  "Book a consultation",
  "Structure Review",
  "Enterprise Exclusive",
];

const FORBIDDEN_ADDRESS_PLACEHOLDERS = [
  "123 Validation Way",
  "Validation Way",
  "Tech District",
  "Sample Address",
  "Your Company Address",
  "123 Sample St",
  "123 Test St",
];

const STALE_COMMERCIAL_PHRASES = [
  "Carbon Border Compliance Validation",
  "Exporter Verification Preparation Pack",
  "Prepared for Independent Accredited Verification",
  "CBAM Exporter Final Evidence Report",
  "independent verifier-preparation platform",
];

const COMMERCIAL_SURFACES = [
  "cbam_logo.svg",
  "public/cbam_logo.svg",
  "public/brand/cbamvalid-lockup.svg",
  "app/(public)/page.tsx",
  "app/(public)/product/layout.tsx",
  "app/(public)/pricing/page.tsx",
  "app/(public)/sample-dossier/layout.tsx",
  "app/(public)/answers/page.tsx",
  "app/answers.json/route.ts",
  "components/marketing/SoftwareProductHome.tsx",
  "components/layout/PublicHeader.tsx",
  "components/layout/AppFooter.tsx",
  "lib/site-config.ts",
  "lib/billing/pricing-config.ts",
  "lib/product/customer-language.ts",
  "lib/seo/claims.ts",
  "lib/seo/llm-doc-model.ts",
  "lib/seo/ai-txt.ts",
  "scripts/seo/regenerate-answer-feeds.ts",
  "public/llm.txt",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/answers.json",
  "public/answers.rss",
  "public/answers.feed.json",
  "public/.well-known/ai.txt",
  "public/ai-policy.txt",
];

const REQUIRED_PUBLIC_FILES = [
  "app/(public)/pricing/page.tsx",
  "app/(public)/product-classification/page.tsx",
  "app/(public)/terms/page.tsx",
  "app/(public)/privacy/page.tsx",
  "app/(public)/refund-policy/page.tsx",
  "app/(public)/legal-notice/page.tsx",
  "app/(public)/contact/page.tsx",
  "app/(public)/answers/page.tsx",
  "app/answers.json/route.ts",
  "public/answers.json",
  "public/answers.rss",
  "public/answers.feed.json",
];

const routePattern = new RegExp(
  `(^|[\\s"'\\(\\[])(${FORBIDDEN_ROUTES.map((route) => route.replace(/\//g, "\\/")).join("|")})(?=[/\\s"'\\)\\]]|$)`,
  "g"
);

function isNotIncludedListContext(lines, lineIndex, line) {
  const trimmed = line.trim();
  const isStringLiteral =
    /^["'`].*["'`],?\s*$/.test(trimmed) || /^\s*["'`].*["'`],?$/.test(trimmed);
  if (!isStringLiteral) return false;
  const contextStart = Math.max(0, lineIndex - 40);
  const context = lines.slice(contextStart, lineIndex + 1).join("\n").toLowerCase();
  return (
    context.includes("not_included") ||
    context.includes("not included") ||
    context.includes("excluded") ||
    context.includes("commercial boundary")
  );
}

function scanRoutes(source, relativePath) {
  routePattern.lastIndex = 0;
  let match;
  while ((match = routePattern.exec(source)) !== null) {
    failures.push(`${relativePath}: link to removed route ${match[2]}`);
  }
}

function scanAddressPlaceholders(source, relativePath) {
  const lower = source.toLowerCase();
  for (const placeholder of FORBIDDEN_ADDRESS_PLACEHOLDERS) {
    if (!lower.includes(placeholder.toLowerCase())) continue;
    failures.push(`${relativePath}: placeholder company identity text ${JSON.stringify(placeholder)}`);
  }
}

function scanPhrases(source, relativePath) {
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      if (!lower.includes(phrase.toLowerCase())) continue;
      const windowStart = Math.max(0, index - 2);
      const windowEnd = Math.min(lines.length, index + 3);
      const window = lines.slice(windowStart, windowEnd).join("\n").toLowerCase();
      const hasNegativeBoundary = NEGATIVE_MARKERS.some((marker) => window.includes(marker));
      if (hasNegativeBoundary || isNotIncludedListContext(lines, index, line)) continue;
      failures.push(`${relativePath}:${index + 1}: positive human-service phrase ${JSON.stringify(phrase)}`);
    }
  });
}

function scanStaleCommercialPhrases(source, relativePath) {
  const lower = source.toLowerCase();
  for (const phrase of STALE_COMMERCIAL_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      failures.push(`${relativePath}: obsolete public commercial classification ${JSON.stringify(phrase)}`);
    }
  }
}

function requireContains(relativePath, tokens) {
  const source = read(relativePath);
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${relativePath}: missing required Paddle-domain token ${JSON.stringify(token)}`);
    }
  }
}

for (const routeDir of FORBIDDEN_ROUTE_DIRECTORIES) {
  if (fs.existsSync(absolute(routeDir))) {
    failures.push(`${routeDir}: removed service route directory must not exist`);
  }
}

for (const requiredFile of REQUIRED_PUBLIC_FILES) {
  if (!fs.existsSync(absolute(requiredFile))) failures.push(`Missing required public policy/feed page: ${requiredFile}`);
}

const TARGET_DIRS = [
  "app/(public)",
  "components/layout",
  "components/marketing",
  "lib/marketing",
  "lib/seo/aeo",
];

const TARGET_FILES = [
  "lib/navigation.ts",
  "lib/seo/registry.ts",
  "lib/seo/hub-content.ts",
  "lib/billing/pricing-config.ts",
  "lib/product/customer-language.ts",
  "lib/legal-identity.ts",
  "lib/legal-config.ts",
  "lib/site-config.ts",
  "app/sitemap.ts",
  "app/.well-known/ai.txt/route.ts",
  "public/llm.txt",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/answers.json",
  "public/answers.rss",
  "public/answers.feed.json",
  "public/.well-known/ai.txt",
  "public/ai-policy.txt",
];

const scanned = new Set();
for (const dir of TARGET_DIRS) {
  for (const file of walkDir(absolute(dir))) {
    const relative = path.relative(root, file);
    scanned.add(relative);
    const source = fs.readFileSync(file, "utf8");
    scanRoutes(source, relative);
    scanPhrases(source, relative);
    scanAddressPlaceholders(source, relative);
  }
}

for (const relativePath of TARGET_FILES) {
  if (scanned.has(relativePath)) continue;
  const source = read(relativePath);
  if (!source) continue;
  scanRoutes(source, relativePath);
  scanPhrases(source, relativePath);
  scanAddressPlaceholders(source, relativePath);
}

for (const relativePath of COMMERCIAL_SURFACES) {
  scanStaleCommercialPhrases(read(relativePath), relativePath);
}

requireContains("app/(public)/page.tsx", [
  "Self-Service Emissions Data Software",
  "automated PDF, JSON and XLSX delivery",
]);
requireContains("components/marketing/SoftwareProductHome.tsx", [
  "B2B SaaS · Automated digital delivery",
  "privately operated self-service B2B software",
  "Customer-entered data",
]);
requireContains("app/(public)/pricing/page.tsx", [
  "CANONICAL_PRICING.priceFormatted",
  "Automated digital PDF generation",
  "Automated digital JSON generation",
  "Automated digital XLSX generation",
]);
requireContains("app/(public)/product-classification/page.tsx", [
  "Self-Service B2B Software",
  "Automated PDF, JSON and XLSX generation",
  "Human services",
]);
requireContains("app/(public)/terms/page.tsx", [
  "software access and automated digital delivery",
  "No Human or Government Services Included",
]);
requireContains("app/(public)/privacy/page.tsx", [
  "providing access to the self-service software",
  "Account settings page",
]);
requireContains("app/(public)/refund-policy/page.tsx", [
  "Paddle.com is the Merchant of Record",
  "Digital goods after successful seal",
]);
requireContains("lib/legal-config.ts", ['governingLaw: "Ireland"']);
requireContains("lib/billing/pricing-config.ts", [
  'priceFormatted: "$449"',
  "amountMinor: 44900",
  'packName: "CBAMValid Working File Software Unlock"',
]);
requireContains("public/answers.json", [
  "CBAMValid Self-Service Software Answer Feed",
  "CBAMValid Working File Software Unlock",
  "Automated PDF, JSON and XLSX files",
  '"humanServicesBundled": false',
]);
requireContains("public/answers.feed.json", [
  "CBAMValid Self-Service Software Answer Feed",
  "self-service B2B software",
]);
requireContains("public/answers.rss", [
  "CBAMValid Self-Service Software Answer Feed",
  "self-service B2B software",
]);
requireContains("app/answers.json/route.ts", [
  "toPublicAnswerRecord",
  "toPublicAuthorityChain",
  "assertPublicCommercialClassification",
  'productType: "Self-service B2B software"',
]);
requireContains("app/(public)/answers/page.tsx", [
  "toPublicAnswerRecord",
  "CBAMValid is privately operated self-service B2B software",
]);
requireContains("scripts/seo/regenerate-answer-feeds.ts", [
  "toPublicAnswerRecord",
  "toPublicAuthorityChain",
  "assertPublicCommercialClassification",
]);

const legalConfig = read("lib/legal-config.ts");
if (legalConfig.includes('governingLaw: "the laws of Ireland"')) {
  failures.push('lib/legal-config.ts: governingLaw must be "Ireland" to prevent "laws of the laws" rendering');
}

const privacy = read("app/(public)/privacy/page.tsx");
for (const stale of ["calculation and documentation service", "Enterprise Account settings"]) {
  if (privacy.includes(stale)) failures.push(`app/(public)/privacy/page.tsx: stale service copy ${JSON.stringify(stale)}`);
}

if (failures.length > 0) {
  console.error("SOFTWARE_ONLY_POSITIONING_GUARD=FAIL");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PADDLE_PUBLIC_MACHINE_FEEDS=PASS");
console.log("PADDLE_DOMAIN_REQUIREMENTS=PASS");
console.log("SOFTWARE_ONLY_POSITIONING_GUARD=PASS");
