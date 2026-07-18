/**
 * §19.2 / §26 / Ek Kod-11: Content Near-Duplicate Detector
 *
 * Protocol: Detects near-duplicate content across programmatic pages
 * using Jaccard similarity on token sets. Pages above threshold are
 * flagged for merge/noindex review.
 *
 * [INTERNAL] Content quality gate — does NOT single-block deploy.
 * [SITE-SPECIFIC] Threshold should be tuned per content type.
 *
 * Usage: npx ts-node scripts/detect-near-duplicates.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const warnings: string[] = [];

// ─── Config ───

const SIMILARITY_THRESHOLD = 0.70; // 70% similarity = near-duplicate
const MIN_CONTENT_LENGTH = 100; // Ignore pages with < 100 words

// ─── Text extraction from TSX ───

function extractText(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, "") // line comments
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, "") // imports
    .replace(/export\s+(default\s+)?(async\s+)?function\s+\w+/g, "") // exports
    .replace(/const\s+\w+\s*=\s*\{[^}]*\}/g, "") // object literals
    .replace(/<[^>]*>/g, " ") // HTML tags
    .replace(/\{[^}]*\}/g, " ") // template expressions
    .replace(/['"`]/g, "") // quotes
    .replace(/[{}()[\];=,.:|!?&@#$%^*+\-<>]/g, " ") // punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Jaccard similarity ───

function tokenize(text: string): Set<string> {
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "has", "have", "from", "with", "that", "this", "will", "your", "which", "their", "been", "were", "they", "does", "each", "them", "when", "into", "more", "also", "said", "what", "than", "some"].includes(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ─── MAIN ───

console.log("[DEDUP] ========================================");
console.log("[DEDUP] §19.2: Content Near-Duplicate Detector");
console.log("[DEDUP] Threshold: >= " + (SIMILARITY_THRESHOLD * 100) + "% Jaccard similarity");
console.log("[DEDUP] ========================================\n");

// Analyze programmatic pages: cn-codes/[code]/page.tsx and sectors/[sector]/page.tsx
const publicDir = path.join(workspaceRoot, "app", "(public)");
const targetPatterns = [
  "cn-codes/[code]/page.tsx",
  "cn-codes/[code]/[sector]/page.tsx",
  "sectors/[sector]/page.tsx",
];

const pages: { path: string; text: string; tokens: Set<string>; wordCount: number }[] = [];

for (const pattern of targetPatterns) {
  const fullPath = path.join(publicDir, pattern);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf-8");
    const text = extractText(content);
    const tokens = tokenize(text);
    const wordCount = text.split(/\s+/).length;

    if (wordCount >= MIN_CONTENT_LENGTH) {
      pages.push({ path: pattern, text, tokens, wordCount });
      console.log(`[DEDUP] Loaded: ${pattern} (${wordCount} words, ${tokens.size} unique tokens)`);
    } else {
      console.log(`[DEDUP] Skipped: ${pattern} (${wordCount} words < ${MIN_CONTENT_LENGTH} minimum)`);
    }
  }
}

// Compare all pairs
if (pages.length < 2) {
  console.log("\n[DEDUP] Not enough pages for comparison.");
} else {
  console.log(`\n[DEDUP] Comparing ${pages.length} pages (${pages.length * (pages.length - 1) / 2} pairs)...\n`);

  let pairCount = 0;
  const nearDuplicates: { page1: string; page2: string; similarity: number }[] = [];

  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const sim = jaccardSimilarity(pages[i].tokens, pages[j].tokens);
      pairCount++;

      // Template pages with same structure expected to share some boilerplate
      const adjustedThreshold = pages[i].path.includes("[code]") && pages[j].path.includes("[code]")
        ? SIMILARITY_THRESHOLD + 0.15 // More lenient for template siblings
        : SIMILARITY_THRESHOLD;

      if (sim >= adjustedThreshold) {
        nearDuplicates.push({ page1: pages[i].path, page2: pages[j].path, similarity: sim });
        console.log(
          `[DEDUP] ⚠️ ${(sim * 100).toFixed(1)}% similar: ${pages[i].path} ↔ ${pages[j].path} (threshold: ${(adjustedThreshold * 100).toFixed(0)}%)`
        );
      }
    }
  }

  // ─── REPORT ───
  console.log(`\n[DEDUP] ${pairCount} pair comparisons completed.`);

  if (nearDuplicates.length > 0) {
    console.log(`[DEDUP] ⚠️ ${nearDuplicates.length} near-duplicate pair(s) detected.`);
    console.log("[DEDUP] Consider merging or adding unique data to differentiate pages.");
    console.log("[DEDUP] Template pages with dynamic data MAY be false positives — verify with rendered output.");
    nearDuplicates.forEach(d => {
      warnings.push(`Near-duplicate: ${d.page1} ≈ ${d.page2} (${(d.similarity * 100).toFixed(1)}%)`);
    });
    exitCode = 1;
  } else {
    console.log("[DEDUP] ✅ No near-duplicate content detected at template level.");
  }
}

console.log("[DEDUP] ========================================");
process.exit(exitCode);
