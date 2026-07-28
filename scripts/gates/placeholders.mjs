#!/usr/bin/env node
/** WP-09: forbidden placeholder strings in dossier sources + render */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIRS = [
  path.join(root, "src/dossier"),
  path.join(root, "functions/src/dossier"),
];
const FORBIDDEN = [
  "Boundaries defined.",
  "Lorem",
  "\tTBD\t",
  '"TBD"',
  "'TBD'",
];

let hits = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(e.name)) {
      const text = fs.readFileSync(full, "utf8");
      // Allow content-contracts.ts to *define* the ban list
      if (full.endsWith("content-contracts.ts")) continue;
      for (const needle of FORBIDDEN) {
        if (text.includes(needle)) {
          console.error(`${full}: contains forbidden placeholder ${JSON.stringify(needle)}`);
          hits += 1;
        }
      }
    }
  }
}
DIRS.forEach(walk);
if (hits) {
  console.error(`gate:placeholders FAIL (${hits})`);
  process.exit(1);
}
console.log("gate:placeholders PASS");
