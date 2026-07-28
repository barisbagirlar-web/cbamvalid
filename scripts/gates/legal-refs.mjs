#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RENDER_DIRS = [
  path.join(ROOT, "src/dossier/60-render"),
];
const LITERAL = /\(EU\)\s*20[0-9]{2}\/[0-9]{3,4}/;

let hits = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      text.split("\n").forEach((line, i) => {
        if (LITERAL.test(line)) {
          console.error(`${full}:${i + 1}: ${line.trim()}`);
          hits += 1;
        }
      });
    }
  }
}
RENDER_DIRS.forEach(walk);
if (hits > 0) {
  console.error(`gate:legal-refs FAIL (${hits} hits)`);
  process.exit(1);
}
console.log("gate:legal-refs PASS");
