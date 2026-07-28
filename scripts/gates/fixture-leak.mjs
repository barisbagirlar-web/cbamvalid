#!/usr/bin/env node
/** INV-7: fixture identifiers must not leak outside __fixtures__ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DENY = [
  "11111111-1111-4111-8111-111111111111",
  "NL123456789AB",
  "Verified Steel Operator",
  "Verified Integrated Steel Installation",
];
const SCAN = [
  path.join(root, "src/dossier"),
  path.join(root, "functions/src/dossier"),
  path.join(root, "lib/dossier"),
  path.join(root, "functions/src/cbam/report"),
];

let hits = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__fixtures__" || e.name === "node_modules") continue;
      walk(full);
    } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
      // tests may reference deny strings; gate scopes production dossier/report paths
      const text = fs.readFileSync(full, "utf8");
      for (const d of DENY) {
        if (text.includes(d)) {
          console.error(`${full}: fixture leak ${d}`);
          hits += 1;
        }
      }
    }
  }
}
SCAN.forEach(walk);
if (hits) {
  console.error(`gate:fixtures FAIL (${hits})`);
  process.exit(1);
}
console.log("gate:fixtures PASS");
