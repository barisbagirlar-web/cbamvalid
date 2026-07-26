/**
 * Affirmative “complete CN coverage” claim scanner.
 * Negations ("not a complete…") are allowed; promotional completeness claims are not
 * while FULL_OFFICIAL_SCOPE_RESOLUTION=NOT_IMPLEMENTED.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS } from "../../lib/seo/cn-public-registry";

const ROOTS = ["app", "components/seo", "lib/seo", "public"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".txt", ".md", ".html"]);

/** Affirmative completeness claims (must stay at zero). */
const AFFIRMATIVE = [
  /\ball CBAM CN codes\b/i,
  /\bcomplete CBAM CN(?:\s+directory|\s+catalog|\s+index)?\b/i,
  /\bfull Annex I coverage\b/i,
  /\bentire Annex I\b/i,
  /\bcomplete CBAM(?:Valid)? CN directory\b/i,
  /\bfull official CN (?:universe|directory|catalog)\b/i,
];

const NEGATION_WINDOW = /not\s+(?:a\s+)?(?:complete|full)|is not a complete|are not a full|does not (?:provide|claim|publish).{0,40}complete/i;

function walk(dir: string, files: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (EXT.has(name.slice(name.lastIndexOf(".")))) files.push(full);
  }
}

export function scanCompleteCoverageClaims(cwd = process.cwd()): {
  status: typeof FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS;
  hits: readonly { file: string; line: number; text: string }[];
} {
  const hits: { file: string; line: number; text: string }[] = [];
  if (FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS !== "NOT_IMPLEMENTED") {
    return { status: FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS, hits };
  }

  const files: string[] = [];
  for (const root of ROOTS) walk(join(cwd, root), files);

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const pattern of AFFIRMATIVE) {
        if (!pattern.test(line)) continue;
        if (NEGATION_WINDOW.test(line)) continue;
        hits.push({
          file: relative(cwd, file),
          line: idx + 1,
          text: line.trim().slice(0, 200),
        });
      }
    });
  }
  return { status: FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS, hits };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("scan-complete-claims.ts")) {
  const result = scanCompleteCoverageClaims();
  console.log(`FULL_OFFICIAL_SCOPE_RESOLUTION=${result.status}`);
  console.log(`COMPLETE_CN_COVERAGE_CLAIMS=${result.hits.length}`);
  for (const hit of result.hits) {
    console.log(`HIT ${hit.file}:${hit.line}: ${hit.text}`);
  }
  process.exit(result.hits.length === 0 ? 0 : 1);
}
