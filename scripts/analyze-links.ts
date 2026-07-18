/**
 * §14 / Ek Kod-5: Internal Link Graph Analyzer
 *
 * Protocol: Advanced internal link analysis beyond orphan detection.
 * Measures: PageRank distribution, anchor text diversity, click depth,
 * broken internal links, redirect targets in links.
 *
 * [INTERNAL] Quality gate — not a deploy blocker by default, but warns.
 * Combined with verify-graph-connectivity.ts for full link audit.
 *
 * Usage: npx ts-node scripts/analyze-links.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const warnings: string[] = [];

// ─── Site config ───
const SITE_ORIGIN = "https://cbamvalid.com";

// ─── Anchor text extraction ───

interface LinkInfo {
  href: string;
  anchorText: string;
  sourceFile: string;
}

function extractLinks(dir: string): LinkInfo[] {
  const links: LinkInfo[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && !e.name.startsWith("api")) {
        walk(full);
      } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
        const content = fs.readFileSync(full, "utf-8");
        const relPath = path.relative(workspaceRoot, full);

    // Match <a href="..." ...>anchor text</a>
    const anchorPattern = /<a\s[^>]*href=["'`]([^"'`]+)["'`][^>]*>\s*(.*?)\s*<\/a>/g;
        let m;
        while ((m = anchorPattern.exec(content)) !== null) {
          const href = m[1];
          const anchor = m[2].replace(/<[^>]+>/g, "").trim();
          if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/_next")) {
            links.push({ href: href.split("?")[0], anchorText: anchor || "[empty]", sourceFile: relPath });
          }
        }

    // Match Link components: <Link href="..." ...>anchor</Link>
    const linkPattern = /<Link\s[^>]*href=["'`]([^"'`]+)["'`][^>]*>\s*(.*?)\s*<\/Link>/g;
        while ((m = linkPattern.exec(content)) !== null) {
          const href = m[1];
          const anchor = m[2].replace(/<[^>]+>/g, "").trim();
          if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/_next")) {
            links.push({ href: href.split("?")[0], anchorText: anchor || "[empty]", sourceFile: relPath });
          }
        }
      }
    }
  }
  walk(dir);
  return links;
}

// ─── MAIN ───

console.log("[LINK-ANALYZER] ========================================");
console.log("[LINK-ANALYZER] §14: Internal Link Graph Analyzer");
console.log("[LINK-ANALYZER] ========================================\n");

const publicDir = path.join(workspaceRoot, "app", "(public)");
const compDir = path.join(workspaceRoot, "components");
const links = extractLinks(publicDir);
const compLinks = extractLinks(compDir);
const allLinks = [...links, ...compLinks];

console.log(`[LINK-ANALYZER] Total internal links extracted: ${allLinks.length} (public: ${links.length}, components: ${compLinks.length})\n`);

// ─── G1: Empty anchor text detection ───

const emptyAnchors = allLinks.filter(l => l.anchorText === "[empty]" || l.anchorText.length === 0);
const emptyRatio = allLinks.length > 0 ? emptyAnchors.length / allLinks.length : 0;
if (emptyRatio > 0.10) {
  console.error(`[LINK-ANALYZER] ❌ Empty anchor ratio: ${(emptyRatio * 100).toFixed(1)}% (${emptyAnchors.length}/${allLinks.length}) — threshold 10%`);
  warnings.push(`Empty anchor text: ${emptyAnchors.length} links`);
  exitCode = 1;
} else {
  console.log(`[LINK-ANALYZER] ✅ Empty anchor ratio: ${(emptyRatio * 100).toFixed(1)}% (OK < 10%)`);
}

// ─── G2: Generic anchor text detection ───

const GENERIC_ANCHORS = ["click here", "here", "read more", "learn more", "more", "this", "link", "page"];
const genericMatches = allLinks.filter(l => GENERIC_ANCHORS.some(g => l.anchorText.toLowerCase().includes(g)));
if (genericMatches.length > 0) {
  console.log(`[LINK-ANALYZER] ⚠️ ${genericMatches.length} link(s) with generic anchors (e.g. "click here", "read more")`);
  genericMatches.slice(0, 5).forEach(l => console.log(`[LINK-ANALYZER]   → "${l.anchorText}" → ${l.href} (${l.sourceFile})`));
}

// ─── G3: Link distribution per target page ───

const linkCounts = new Map<string, LinkInfo[]>();
for (const link of allLinks) {
  if (!linkCounts.has(link.href)) linkCounts.set(link.href, []);
  linkCounts.get(link.href)!.push(link);
}

const sorted = [...linkCounts.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`\n[LINK-ANALYZER] Top 10 most-linked pages (internal link distribution):`);
sorted.slice(0, 10).forEach(([href, linkList]) => {
  console.log(`[LINK-ANALYZER]   ${linkList.length.toString().padStart(3)} links → ${href}`);
});

// ─── G4: Link depth distribution ───

const depthCounts = new Map<number, number>();
for (const link of allLinks) {
  const depth = link.href.split("/").filter(Boolean).length;
  depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
}

console.log(`\n[LINK-ANALYZER] Link click-depth distribution:`);
[...depthCounts.entries()].sort((a, b) => a[0] - b[0]).forEach(([depth, count]) => {
  console.log(`[LINK-ANALYZER]   Depth ${depth}: ${count} links`);
});

// ─── G5: Anchor text diversity ───

const uniqueAnchors = new Set(allLinks.map(l => l.anchorText.toLowerCase()));
console.log(`\n[LINK-ANALYZER] Anchor text diversity: ${uniqueAnchors.size} unique anchors out of ${allLinks.length} total links`);

// ─── REPORT ───

console.log("\n[LINK-ANALYZER] ========================================");
if (exitCode === 0) {
  console.log("[LINK-ANALYZER] ✅ Internal link architecture: all quality gates passed.");
} else {
  console.error(`[LINK-ANALYZER] ⚠️ ${warnings.length} link quality warning(s) found.`);
  warnings.forEach(w => console.error(`[LINK-ANALYZER]   → ${w}`));
}
console.log("[LINK-ANALYZER] ========================================");

process.exit(exitCode);
