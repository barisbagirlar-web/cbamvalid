#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../../src/dossier/60-render");
if (!fs.existsSync(ROOT)) {
  console.log("gate:no-render-math PASS (no render tree yet)");
  process.exit(0);
}

let hits = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      if (/\b(tco2e|emissions|seePriced|allocated)\w*\s*[\+\-\*\/]/.test(text)) {
        console.error(full);
        hits += 1;
      }
    }
  }
}
walk(ROOT);
if (hits) process.exit(1);
console.log("gate:no-render-math PASS");
