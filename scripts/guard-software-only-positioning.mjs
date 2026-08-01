/**
 * FAZ 17 guard — Software-only positioning.
 *
 * Fails when public renderable surfaces contain positive human-service sales
 * language or links to removed human-service routes.
 *
 * Explicit negative legal boundaries are permitted:
 *   "does not include consulting", "no human services included",
 *   "NOT_INCLUDED" lists, "does not provide advisory services".
 *
 * Design constraints (mandate #15):
 *   - No broad regex rules that create uncontrolled false positives.
 *   - Phrase matches are evaluated per line with a negative-boundary check.
 *   - Route matches are exact slash-prefixed paths, not bare words
 *     (e.g. "partners" as an audience keyword is allowed).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function walkDir(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else if (/\.(tsx|ts|mjs|json|txt|md)$/.test(entry.name)) out.push(full);
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

// Explicit negative-boundary markers. A line carrying one of these may hold a
// forbidden phrase as a legal disclaimer (mandate #15, #14 boundary clause).
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
];

// A forbidden route must be a slash-prefixed path token, not a bare word.
const routePattern = new RegExp(
  `(^|[\\s"'\\(\\[])(${FORBIDDEN_ROUTES.map((route) =>
    route.replace(/\//g, "\\/")
  ).join("|")})(?=[/\\s"'\\)\\]]|$)`,
  "g"
);

/**
 * A forbidden phrase is allowed when the surrounding context is an explicit
 * "not included" list. We accept a phrase inside a string-literal array that
 * belongs to a variable/heading whose name contains "NOT_INCLUDED" or
 * "not included". This keeps the pricing NOT_INCLUDED block permitted while
 * rejecting positive sales copy.
 */
function isNotIncludedListContext(lines, lineIndex, line) {
  const trimmed = line.trim();
  const isStringLiteral =
    /^["'`].*["'`],?\s*$/.test(trimmed) || /^\s*["'`].*["'`],?$/.test(trimmed);
  if (!isStringLiteral) return false;
  const contextStart = Math.max(0, lineIndex - 40);
  const context = lines.slice(contextStart, lineIndex + 1).join("\n").toLowerCase();
  return context.includes("not_included") || context.includes("not included");
}

function scanRoutes(source, relativePath) {
  routePattern.lastIndex = 0;
  let match;
  while ((match = routePattern.exec(source)) !== null) {
    const route = match[2];
    failures.push(`${relativePath}: link to removed route ${route}`);
  }
}

function scanPhrases(source, relativePath) {
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      const phraseLower = phrase.toLowerCase();
      if (!lower.includes(phraseLower)) continue;
      // Negative boundary may be on this line or on an adjacent line (e.g.
      // "CBAMValid does not sell … managed compliance" split across lines).
      const windowStart = Math.max(0, index - 2);
      const windowEnd = Math.min(lines.length, index + 2);
      const window = lines.slice(windowStart, windowEnd).join("\n").toLowerCase();
      const hasNegativeBoundary = NEGATIVE_MARKERS.some((marker) =>
        window.includes(marker.toLowerCase())
      );
      if (hasNegativeBoundary) continue;
      if (isNotIncludedListContext(lines, index, line)) continue;
      failures.push(
        `${relativePath}:${index + 1}: positive human-service phrase ${JSON.stringify(phrase)}`
      );
    }
  });
}

const TARGET_DIRS = [
  "app/(public)",
  "components/layout",
  "lib/marketing",
  "lib/seo/aeo",
];

const TARGET_FILES = [
  "lib/navigation.ts",
  "lib/seo/registry.ts",
  "lib/seo/hub-content.ts",
  "lib/billing/pricing-config.ts",
  "lib/product/customer-language.ts",
  "app/sitemap.ts",
  "app/.well-known/ai.txt/route.ts",
  "public/llm.txt",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/answers.json",
  "public/answers.rss",
  "public/answers.feed.json",
];

const scanned = new Set();

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(path.join(root, dir))) continue;
  for (const file of walkDir(path.join(root, dir))) {
    const relative = path.relative(root, file);
    scanned.add(relative);
    const source = fs.readFileSync(file, "utf8");
    scanRoutes(source, relative);
    scanPhrases(source, relative);
  }
}

for (const relativePath of TARGET_FILES) {
  if (scanned.has(relativePath)) continue;
  const source = read(relativePath);
  if (!source) continue;
  scanRoutes(source, relativePath);
  scanPhrases(source, relativePath);
}

if (failures.length > 0) {
  console.error("SOFTWARE_ONLY_POSITIONING_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("SOFTWARE_ONLY_POSITIONING_GUARD=PASS");
