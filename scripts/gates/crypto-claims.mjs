#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const FILES = [path.join(ROOT, "functions/src/cbam/report/premium-dossier-pdf.ts")];
const FORBIDDEN = [
  /FIPS 140-2 Level 3 KMS Sealed Hash/,
  /controlled package components frozen & digitally signed/,
];

let hits = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`${file}: forbidden pattern ${re}`);
      hits += 1;
    }
  }
}
if (hits > 0) {
  console.error("gate:crypto-claims FAIL");
  process.exit(1);
}
console.log("gate:crypto-claims PASS");
