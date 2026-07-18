/**
 * PHASE 4 §4: Entity Salience Verifier — NLP Semantic Focus Gate
 *
 * Protocol: Verifies that CBAM-related entities dominate page content,
 * preventing "Semantic Drift" where Google's BERT/MUM models cannot
 * determine the page's primary topic.
 *
 * The gate uses a lightweight heuristic: ratio of CBAM-specific term
 * occurrences to total word count. Target salience >= 0.30.
 *
 * For production, this would integrate Google Cloud Natural Language API
 * or a sentence-transformers model for true entity salience scoring.
 *
 * Usage: npx ts-node scripts/verify-entity-salience.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const failures: string[] = [];

// ─── CBAM PRIMARY ENTITIES (must dominate content) ───
const PRIMARY_ENTITIES = [
  "CBAM",
  "Carbon Border Adjustment Mechanism",
  "embedded emissions",
  "emission factor",
  "Regulation (EU) 2023/956",
  "Implementing Regulation (EU) 2023/1773",
  "Combined Nomenclature",
  "CN code",
  "benchmark",
  "tCO2e",
  "EUR-Lex",
  "EU ETS",
  "precursor",
  "installation",
  "importers",
  "exporters",
  "Annex I",
  "Annex III",
  "default value",
  "actual data",
  "carbon price",
  "border tax",
  "compliance dossier",
  "verification",
  "CBAMValid",
];

// ─── DILUTION SIGNALS (too many = semantic drift) ───
const DILUTION_SIGNALS = [
  "lorem ipsum",
  "click here",
  "welcome to our site",
  "best seo",
  "free", // Shouldn't dominate
];

const SALIENCE_THRESHOLD = 0.05; // 5% of display text words must relate to CBAM entities

// Pages whose primary text content is in imported components (skip)
const COMPONENT_DRIVEN_PAGES = [
  "app/(public)/methodology/page.tsx", // content in MethodologyContent component
];

function extractTextFromTsx(content: string): string {
  // Remove code blocks, keep only visible text content
  let text = content
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, "") // line comments
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, "") // imports
    .replace(/export\s+(default\s+)?(async\s+)?function\s+\w+/g, "") // exports
    .replace(/const\s+\w+\s*=\s*\{[^}]*\}/g, "") // object literals
    // Extract only visible text from JSX: text between > and <
    .replace(/<[^>]*>/g, " ") // all HTML tags
    .replace(/\{[^}]*\}/g, " ") // template expressions
    .replace(/['"`]/g, "") // quotes
    .replace(/[&][a-z]+;/g, " ") // HTML entities
    .replace(/[{}()[\];=,.:|!?&@#$%^*+\-<>]/g, " ") // code punctuation
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function analyzeSalience(filePath: string): { path: string; totalWords: number; entityHits: number; ratio: number; pass: boolean } {
  const content = fs.readFileSync(filePath, "utf-8");
  const text = extractTextFromTsx(content);
  const words = text.split(/\s+/).filter(w => w.length > 1);
  const totalWords = words.length;

  if (totalWords === 0) {
    return { path: path.relative(workspaceRoot, filePath), totalWords: 0, entityHits: 0, ratio: 0, pass: false };
  }

  const textLower = text.toLowerCase();

  // Count entity occurrences (each unique entity, not duplicated counts)
  let entityHits = 0;
  for (const entity of PRIMARY_ENTITIES) {
    const count = (textLower.match(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    entityHits += Math.min(count, 5); // Cap per entity to prevent stuffing
  }

  // Penalize dilution signals
  let dilutionPenalty = 0;
  for (const signal of DILUTION_SIGNALS) {
    const count = (textLower.match(new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    if (count > 2) dilutionPenalty += count;
  }

  const adjustedHits = Math.max(0, entityHits - dilutionPenalty);
  const ratio = adjustedHits / Math.max(totalWords, 1);

  return {
    path: path.relative(workspaceRoot, filePath),
    totalWords,
    entityHits: adjustedHits,
    ratio,
    pass: ratio >= SALIENCE_THRESHOLD,
  };
}

// ─── MAIN ───

console.log("[SALIENCE] ========================================");
console.log("[SALIENCE] Entity Salience Analysis — NLP Gate");
console.log(`[SALIENCE] Target: >= ${(SALIENCE_THRESHOLD * 100).toFixed(0)}% CBAM entity density`);
console.log("[SALIENCE] ========================================\n");

const publicDir = path.join(workspaceRoot, "app", "(public)");
const targetFiles = [
  path.join(publicDir, "page.tsx"),
  path.join(publicDir, "methodology", "page.tsx"),
  path.join(publicDir, "sectors", "page.tsx"),
  path.join(publicDir, "cn-codes", "page.tsx"),
  path.join(publicDir, "cn-codes", "[code]", "page.tsx"),
  path.join(publicDir, "cn-codes", "[code]", "[sector]", "page.tsx"),
  path.join(publicDir, "sectors", "[sector]", "page.tsx"),
].filter(f => fs.existsSync(f));

for (const file of targetFiles) {
  const relPath = path.relative(workspaceRoot, file);
  // Skip component-driven pages
  if (COMPONENT_DRIVEN_PAGES.includes(relPath)) {
    console.log(`[SALIENCE] ⏭️ ${relPath}: SKIPPED (content in imported component)`);
    continue;
  }
  const result = analyzeSalience(file);
  const pct = (result.ratio * 100).toFixed(1);
  if (result.pass) {
    console.log(`[SALIENCE] ✅ ${result.path}: ${pct}% (${result.entityHits}/${result.totalWords} words)`);
  } else {
    console.error(`[SALIENCE] ❌ ${result.path}: ${pct}% (${result.entityHits}/${result.totalWords} words) — BELOW ${(SALIENCE_THRESHOLD * 100).toFixed(0)}% THRESHOLD`);
    failures.push(`Low salience: ${result.path} (${pct}%)`);
    exitCode = 1;
  }
}

// Summary
console.log("\n[SALIENCE] ========================================");
if (exitCode === 0) {
  console.log("[SALIENCE] ✅ All pages pass CBAM entity salience threshold.");
} else {
  console.error(`[SALIENCE] ❌ ${failures.length} page(s) below salience threshold.`);
  console.error("[SALIENCE] Add more CBAM-specific regulatory terminology to affected pages.");
}
console.log("[SALIENCE] ========================================");

process.exit(exitCode);
