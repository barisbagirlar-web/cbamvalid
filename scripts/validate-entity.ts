/**
 * §12.5 / Ek Kod-4: Entity Wikidata QID Validation
 *
 * Protocol: Validates that all entity Wikidata QIDs referenced in the
 * entity graph resolve to real Wikidata items. Invalid QIDs block deploy.
 *
 * [EXPERIMENTAL] Wikidata SPARQL endpoint availability varies.
 * [INTERNAL] Deploy-blocking gate.
 *
 * Usage: npx ts-node scripts/validate-entity.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const failures: string[] = [];

// ─── Extract Wikidata QIDs from codebase ───

function extractQidsFromFiles(dir: string): Map<string, string[]> {
  const qidMap = new Map<string, string[]>(); // QID → source files

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        walk(full);
      } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
        const content = fs.readFileSync(full, "utf-8");
        // Match Wikipedia/Wikidata patterns
        const patterns = [
          /wikidata\.org\/wiki\/(Q\d+)/gi,
          /wikidata\.org\/entity\/(Q\d+)/gi,
          /QID["'`]\s*[:=]\s*["'`](Q\d+)["'`]/gi,
          /wikidataQid["'`]\s*[:=]\s*["'`](Q\d+)["'`]/gi,
        ];
        for (const pattern of patterns) {
          let m;
          while ((m = pattern.exec(content)) !== null) {
            const qid = m[1].toUpperCase();
            if (!qidMap.has(qid)) qidMap.set(qid, []);
            qidMap.get(qid)!.push(path.relative(workspaceRoot, full));
          }
        }
      }
    }
  }
  walk(dir);
  return qidMap;
}

// ─── Validate QID against Wikidata API ───

async function validateQid(qid: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { signal: controller.signal, headers: { "Accept": "application/json" } }
    );
    clearTimeout(timeout);
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─── MAIN ───

console.log("[ENTITY-WIKIDATA] ========================================");
console.log("[ENTITY-WIKIDATA] §12.5: Entity Wikidata QID Validation");
console.log("[ENTITY-WIKIDATA] ========================================\n");

(async () => {
  const libDir = path.join(workspaceRoot, "lib");
  const qidMap = extractQidsFromFiles(libDir);

  if (qidMap.size === 0) {
    console.log("[ENTITY-WIKIDATA] ⚠️ No Wikidata QIDs found in codebase.");
    console.log("[ENTITY-WIKIDATA] This is NOT a failure — entity graph may not use Wikidata yet.");
    console.log("[ENTITY-WIKIDATA] Add wikidataQid to entity definitions in lib/seo/entity-graph.ts.");
    console.log("[ENTITY-WIKIDATA] ========================================");
    process.exit(0);
  }

  console.log(`[ENTITY-WIKIDATA] Found ${qidMap.size} unique Wikidata QID(s) in registry.\n`);

  let validCount = 0;
  let invalidCount = 0;

  for (const [qid, files] of qidMap) {
    console.log(`[ENTITY-WIKIDATA] Validating ${qid} (referenced in: ${files.join(", ")})...`);
    const isValid = await validateQid(qid);
    if (isValid) {
      console.log(`[ENTITY-WIKIDATA]   ✅ ${qid} — resolves correctly`);
      validCount++;
    } else {
      console.error(`[ENTITY-WIKIDATA]   ❌ ${qid} — FAIL: QID does not resolve or Wikidata API unreachable`);
      failures.push(`Invalid Wikidata QID: ${qid} in ${files.join(", ")}`);
      invalidCount++;
    }
  }

  // ─── REPORT ───
  console.log(`\n[ENTITY-WIKIDATA] ${validCount} valid, ${invalidCount} invalid out of ${qidMap.size} total.`);
  if (invalidCount > 0) {
    console.error(`[ENTITY-WIKIDATA] ❌ Build blocked: ${invalidCount} invalid Wikidata QID(s).`);
    failures.forEach(f => console.error(`[ENTITY-WIKIDATA]   → ${f}`));
    exitCode = 1;
  } else {
    console.log("[ENTITY-WIKIDATA] ✅ All Wikidata QIDs validated successfully.");
  }
  console.log("[ENTITY-WIKIDATA] ========================================");

  process.exit(exitCode);
})();
