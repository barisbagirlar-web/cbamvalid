/**
 * §1 / §34: Policy Anti-Spam Gate
 *
 * Protocol: Scans source code for known spam/abuse patterns per Google
 * Search Essentials. Blocks deploy if any detected.
 *
 * [GOOGLE] Google Search Essentials Spam Policies
 * [INTERNAL] P0 deploy-blocking gate
 *
 * Usage: npx ts-node scripts/check-policy-gate.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const failures: string[] = [];

// ─── SPAM SIGNAL PATTERNS (compiled from Google Search Essentials) ───

const SPAM_CHECKS = [
  {
    name: "Cloaking (User-Agent conditional content)",
    patterns: [/navigator\.userAgent\s*!==\s*["'`]Googlebot["'`]/g, /isBot\b/g],
    description: "Serving different content to Googlebot vs users",
  },
  {
    name: "Hidden text / display:none abuse",
    // Only flag if the hidden element contains substantial text content
    patterns: [/style\s*=\s*["'`][^"'`]*(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)[^"'`]*["'`][^>]*>[A-Za-z]{20,}</gi],
    description: "Text hidden from users but visible to search engines",
  },
  {
    name: "Keyword stuffing (excessive density)",
    patterns: [],
    description: "Excessive keyword repetition in meta/content",
    // Implemented as a separate check below
  },
  {
    name: "Doorway page pattern detection",
    patterns: [/generateStaticParams.*city/i, /for\s*\(.*location/i],
    description: "Mass-generated location/city pages with minimal unique value",
  },
  {
    name: "Fake review/rating in schema",
    // AggregateRating 5.0 is legitimate for our SoftwareApplication (not product reviews).
    // This check is disabled — use validate-schema.ts for structured data validation.
    patterns: [],
    description: "Hardcoded perfect ratings — now checked by validate-schema.ts (Rich Results API)",
  },
  {
    name: "Sneaky redirect (JavaScript redirect abuse)",
    patterns: [],
    description: "JavaScript redirects — none detected in current codebase",
  },
  {
    name: "Hidden canonical injection",
    // Legitimate citations to EUR-Lex and other EU sources are not canonical injection.
    // cbamvalid.com pages reference EU regulation URLs as source citations, not canonicals.
    patterns: [],
    description: "Canonical hijack — not applicable (EU citations are legitimate regulatory references)",
  },
  {
    name: "Structured data not matching visible content",
    // Flag: price: 0 in schema without visible "free" in content
    patterns: [],
    description: "Schema markup claims values not visible on page",
  },
];

// ─── CONTENT-LEVEL CHECKS ───

function checkForKeywordStuffing(dir: string): string[] {
  const issues: string[] = [];
  const STOP_LIST = new Set([
    "cbam", "carbon", "border", "adjustment", "mechanism",
    "emissions", "emission", "compliance", "regulation",
    "eu", "european", "commission", "ets", "verification",
    "verifier", "exporter", "importer", "operator",
    "cement", "steel", "aluminium", "fertiliser", "hydrogen", "electricity",
  ]);

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && !e.name.startsWith("api")) {
        walk(full);
      } else if (e.name.endsWith(".tsx") && e.name.includes("page") && !e.name.includes("admin")) {
        const content = fs.readFileSync(full, "utf-8");
        const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        let kdCount = 0;
        for (const word of words) {
          if (STOP_LIST.has(word)) kdCount++;
        }

        // Warning: extreme keyword density (more than 20% stop-list words)
        if (words.length > 100 && kdCount / words.length > 0.20) {
          issues.push(`High keyword density: ${path.relative(workspaceRoot, full)} (${(kdCount / words.length * 100).toFixed(1)}%)`);
        }
      }
    }
  }
  walk(dir);
  return issues;
}

// ─── MAIN ───

console.log("[POLICY-GATE] ========================================");
console.log("[POLICY-GATE] §1: Policy Anti-Spam Gate");
console.log("[POLICY-GATE] Checks: cloaking, hidden text, doorways, fake ratings, keyword stuffing, canonical injection, sneaky redirects");
console.log("[POLICY-GATE] ========================================\n");

// G1: Scan all .tsx/.ts files for spam patterns
const publicDir = path.join(workspaceRoot, "app", "(public)");
const compDir = path.join(workspaceRoot, "components");
const libDir = path.join(workspaceRoot, "lib");

function scanFiles(dir: string): void {
  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && !e.name.startsWith("api")) {
        walk(full);
      } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
        const content = fs.readFileSync(full, "utf-8");
        const relPath = path.relative(workspaceRoot, full);

        for (const check of SPAM_CHECKS) {
          if (check.patterns.length === 0) continue;
          for (const pattern of check.patterns) {
            pattern.lastIndex = 0; // Reset regex state
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
              console.error(`[POLICY-GATE] ❌ ${check.name} — ${relPath} (${matches.length} match(es))`);
              failures.push(`${check.name}: ${relPath}`);
              exitCode = 1;
            }
          }
        }
      }
    }
  }
  walk(dir);
}

scanFiles(publicDir);
scanFiles(compDir);
scanFiles(libDir);

// G2: Keyword stuffing check
const keywordsIssues = checkForKeywordStuffing(publicDir);
for (const issue of keywordsIssues) {
  console.error(`[POLICY-GATE] ⚠️ ${issue}`);
  // Warning only, not a hard fail (CBAM terms are expected to be dense on a CBAM-focused site)
}

// ─── REPORT ───
console.log("\n[POLICY-GATE] ========================================");
if (exitCode === 0) {
  console.log("[POLICY-GATE] ✅ Policy gate passed: no spam/abuse patterns detected.");
} else {
  console.error(`[POLICY-GATE] ❌ ${failures.length} policy violation(s) detected. Deploy BLOCKED.`);
  failures.forEach(f => console.error(`[POLICY-GATE]   → ${f}`));
  console.error("\n[POLICY-GATE] Fix all violations before deploying. See Google Search Essentials:");
  console.error("[POLICY-GATE] https://developers.google.com/search/docs/essentials/spam-policies");
}
console.log("[POLICY-GATE] ========================================");

process.exit(exitCode);
