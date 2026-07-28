#!/usr/bin/env node
/** INV-1: 60-render must not import kernel/normalize/case.schema */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const renderDir = path.join(root, "src/dossier/60-render");
const FORBIDDEN = [
  /from\s+["'].*20-kernel/,
  /from\s+["'].*10-normalize/,
  /from\s+["'].*00-schema\/case\.schema/,
  /from\s+["']\.\.\/20-kernel/,
  /from\s+["']\.\.\/10-normalize/,
  /from\s+["']\.\.\/00-schema\/case\.schema/,
];

let hits = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
      const text = fs.readFileSync(full, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(text)) {
          console.error(`${full}: forbidden import matching ${re}`);
          hits += 1;
        }
      }
    }
  }
}
walk(renderDir);
if (hits) {
  console.error(`gate:layers FAIL (${hits})`);
  process.exit(1);
}
console.log("gate:layers PASS");
