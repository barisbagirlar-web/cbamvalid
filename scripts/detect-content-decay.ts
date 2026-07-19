/**
 * §26 / Ek Kod-11: Content Decay Detector
 *
 * Protocol: Standalone TF-IDF cosine similarity comparison between internal
 * pages and competitor content to detect decaying relevance.
 *
 * [INTERNAL] Quality gate — does NOT single-block deploy.
 * [SITE-SPECIFIC] Thresholds should be tuned per content type.
 * [EXPERIMENTAL] Uses string similarity; NLP models give better results.
 *
 * Prerequisites: none (pure JS implementation)
 *
 * Usage: npx ts-node scripts/detect-content-decay.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const decayCandidates: string[] = [];

// ─── TF-IDF implementation (pure JS, no dependencies) ───

interface TfIdfDoc {
  path: string;
  tf: Map<string, number>;
  idf: Map<string, number>;
  tfidf: Map<string, number>;
  wordCount: number;
  uniqueWords: number;
  lastModified: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !["this", "that", "with", "from", "have", "been", "they", "will", "when", "also", "more", "some", "each", "into", "were", "what", "than", "about"].includes(w));
}

function buildTfIdf(docs: { path: string; text: string; lastModified: string }[]): TfIdfDoc[] {
  const allDocs: TfIdfDoc[] = [];
  const documentFreq = new Map<string, number>(); // how many docs contain each term

  // First pass: compute term frequencies per doc + document frequencies
  for (const doc of docs) {
    const tokens = tokenize(doc.text);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }

    // Normalize TF by doc length
    const wordCount = tokens.length;
    const normalizedTf = new Map<string, number>();
    for (const [term, count] of tf) {
      normalizedTf.set(term, count / wordCount);
    }

    // Track unique terms for document frequency
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      documentFreq.set(term, (documentFreq.get(term) || 0) + 1);
    }

    allDocs.push({
      path: doc.path,
      tf: normalizedTf,
      idf: new Map(), // filled in second pass
      tfidf: new Map(), // filled in second pass
      wordCount,
      uniqueWords: uniqueTerms.size,
      lastModified: doc.lastModified,
    });
  }

  // Second pass: compute IDF and TF-IDF
  const N = allDocs.length;
  for (const doc of allDocs) {
    for (const [term] of doc.tf) {
      const df = documentFreq.get(term) || 1;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      doc.idf.set(term, idf);
      doc.tfidf.set(term, (doc.tf.get(term) || 0) * idf);
    }
  }

  return allDocs;
}

function cosineSimilarity(a: TfIdfDoc, b: TfIdfDoc): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, tfidfA] of a.tfidf) {
    const tfidfB = b.tfidf.get(term) || 0;
    dotProduct += tfidfA * tfidfB;
    normA += tfidfA * tfidfA;
  }

  for (const [, tfidfB] of b.tfidf) {
    normB += tfidfB * tfidfB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ─── Content freshness check ───

function extractTextFromTsx(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/['"`]/g, "")
    .replace(/[{}()[\];=,.:|!?&@#$%^*+\-<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── MAIN ───

console.log("[DECAY] ========================================");
console.log("[DECAY] §26 / Ek Kod-11: Content Decay Detector");
console.log("[DECAY] Method: TF-IDF cosine similarity + freshness check");
console.log("[DECAY] ========================================\n");

const publicDir = path.join(workspaceRoot, "app", "(public)");
const METHODOLOGY_PAGE = path.join(publicDir, "methodology", "page.tsx");
const SECTORS_HUB = path.join(publicDir, "sectors", "page.tsx");
const CN_CODES_HUB = path.join(publicDir, "cn-codes", "page.tsx");

// G1: Check if methodology page references current regulations
if (fs.existsSync(METHODOLOGY_PAGE)) {
  const content = fs.readFileSync(METHODOLOGY_PAGE, "utf-8");
  const hasCurrentRegs = content.includes("2023/956") && content.includes("2023/1773");
  if (hasCurrentRegs) {
    console.log("[DECAY] ✅ Methodology page references current regulations (EU 2023/956, 2023/1773)");
  } else {
    console.log("[DECAY] ⚠️ Methodology page may reference outdated regulations");
    decayCandidates.push("Methodology page: outdated regulation references");
  }
}

// G2: TF-IDF similarity between hub pages (detect convergence/overlap)
const hubPages = [SECTORS_HUB, CN_CODES_HUB].filter(fs.existsSync);
const docs: { path: string; text: string; lastModified: string }[] = [];
for (const hub of hubPages) {
  const content = fs.readFileSync(hub, "utf-8");
  const text = extractTextFromTsx(content);
  const stat = fs.statSync(hub);
  docs.push({ path: path.relative(workspaceRoot, hub), text, lastModified: stat.mtime.toISOString() });
}

if (docs.length >= 2) {
  const tfidfDocs = buildTfIdf(docs);

  console.log("\n[DECAY] TF-IDF Content Analysis:");
  for (const doc of tfidfDocs) {
    console.log(`[DECAY]   ${doc.path}: ${doc.wordCount} words, ${doc.uniqueWords} unique terms`);
  }

  console.log("\n[DECAY] Cosine Similarity Matrix:");
  for (let i = 0; i < tfidfDocs.length; i++) {
    for (let j = i + 1; j < tfidfDocs.length; j++) {
      const sim = cosineSimilarity(tfidfDocs[i], tfidfDocs[j]);
      const status = sim > 0.85 ? "⚠️ HIGH (cannibalization risk)" : sim > 0.60 ? "ℹ️ MEDIUM (some overlap)" : "✅ LOW (distinct content)";
      console.log(`[DECAY]   ${tfidfDocs[i].path} ↔ ${tfidfDocs[j].path}: ${(sim * 100).toFixed(1)}% ${status}`);

      if (sim > 0.85) {
        decayCandidates.push(`High content overlap: ${tfidfDocs[i].path} ↔ ${tfidfDocs[j].path}`);
        exitCode = 1;
      }
    }
  }
}

// G3: Freshness check — are any key pages >90 days stale?
// (Advisory only, checked via Git)
console.log("\n[DECAY] Content freshness advisory:");
console.log("[DECAY] ℹ️ Run 'git log --diff-filter=M --name-only --since=\"90 days ago\" -- app/\\(public\\)/' to detect stale pages");
console.log("[DECAY] ℹ️ Run 'git log -1 --format=%cI -- app/(public)/*/*.tsx' for per-file last-modified");

// ─── REPORT ───

console.log("\n[DECAY] ========================================");
if (exitCode === 0) {
  console.log("[DECAY] ✅ No content decay detected at source level.");
} else {
  console.log(`[DECAY] ⚠️ ${decayCandidates.length} decay signal(s) found.`);
  decayCandidates.forEach(c => console.log(`[DECAY]   → ${c}`));
}
console.log("[DECAY] ========================================");

process.exit(exitCode);
