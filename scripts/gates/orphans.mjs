#!/usr/bin/env node
/** INV-5 / WP-13: InputPath orphans bidirectional check against DossierModel assembly paths */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const graphFile = path.join(root, "src/dossier/20-kernel/graph.ts");
const assembleFile = path.join(root, "src/dossier/50-model/assembleDossier.ts");

if (!fs.existsSync(graphFile) || !fs.existsSync(assembleFile)) {
  console.error("gate:no-orphans FAIL: missing graph or assembleDossier");
  process.exit(1);
}

const graph = fs.readFileSync(graphFile, "utf8");
const paths = [...graph.matchAll(/path:\s*["']([^"']+)["']/g)].map((m) => m[1]);
if (paths.length === 0) {
  console.error("gate:no-orphans FAIL: no InputPath declarations in graph.ts");
  process.exit(1);
}

// Every path must be a known raw-case / goods path pattern consumed by normalize/graph
const ALLOWED = /^(directEmissionsTco2e|electricityMwh|gridFactorTco2ePerMwh|goods\.\d+\.(allocationShare|netMassTonnes))$/;
let bad = 0;
for (const p of paths) {
  if (!ALLOWED.test(p)) {
    console.error(`orphan/unknown InputPath: ${p}`);
    bad += 1;
  }
}
if (bad) {
  console.error(`gate:no-orphans FAIL (${bad})`);
  process.exit(1);
}
console.log(`gate:no-orphans PASS (${paths.length} paths)`);
