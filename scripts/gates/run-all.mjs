#!/usr/bin/env node
/** Run all dossier engine gates; non-zero if any fail. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gates = [
  "layers.mjs",
  "no-render-math.mjs",
  "orphans.mjs",
  "legal-refs.mjs",
  "fixture-leak.mjs",
  "placeholders.mjs",
  "version-literals.mjs",
  "crypto-claims.mjs",
  "pdf-id-integrity.mjs",
  "recompute.mjs",
];

let failed = 0;
for (const g of gates) {
  const r = spawnSync(process.execPath, [path.join(root, "scripts/gates", g)], {
    cwd: root,
    encoding: "utf8",
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) failed += 1;
}

const vitest = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "src/dossier/40-readiness/backing.spec.ts",
    "tests/dossier",
  ],
  { cwd: root, encoding: "utf8", env: process.env }
);
process.stdout.write(vitest.stdout || "");
process.stderr.write(vitest.stderr || "");
if (vitest.status !== 0) failed += 1;

if (failed) {
  console.error(`gate:all FAIL (${failed} groups)`);
  process.exit(1);
}
console.log("gate:all PASS");
