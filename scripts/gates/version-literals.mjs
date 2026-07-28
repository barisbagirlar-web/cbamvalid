#!/usr/bin/env node
/** WP-10: no version-looking string literals in 60-render */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "src/dossier/60-render");
const patterns = [
  /\bV\d+\.\d+\b/,
  /\b\d+\.\d+\.\d+\b/,
  /CBAMVALID-DOSSIER-\d/,
  /EU-CBAM-DEFINITIVE/,
];

let hits = 0;
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js)$/.test(e.name)) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) return;
        for (const re of patterns) {
          if (re.test(line) && /["'`]/.test(line)) {
            console.error(`${full}:${i + 1}: ${trimmed}`);
            hits += 1;
            break;
          }
        }
      });
    }
  }
}
walk(dir);
if (hits) {
  console.error(`gate:version-literals FAIL (${hits})`);
  process.exit(1);
}
console.log("gate:version-literals PASS");
