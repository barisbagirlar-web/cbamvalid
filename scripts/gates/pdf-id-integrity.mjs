#!/usr/bin/env node
/** WP-14: ID integrity patterns must not use soft hyphens / mid-token break hints in render CSS helpers */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const layout = path.join(root, "src/dossier/60-render/pdf/layout.ts");
if (!fs.existsSync(layout)) {
  console.error("gate:id-integrity FAIL: missing src/dossier/60-render/pdf/layout.ts");
  process.exit(1);
}
const text = fs.readFileSync(layout, "utf8");
const required = ["nowrap", "hyphens: none", "monospace", "shortUuid", "footerOneLine"];
let missing = 0;
for (const r of required) {
  if (!text.includes(r)) {
    console.error(`missing layout rule: ${r}`);
    missing += 1;
  }
}
if (missing) {
  console.error(`gate:id-integrity FAIL (${missing})`);
  process.exit(1);
}
console.log("gate:id-integrity PASS");
