#!/usr/bin/env node
/** INV-8 / gate:recompute via vitest focused suite */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vitest = path.join(root, "node_modules/vitest/vitest.mjs");
const r = spawnSync(process.execPath, [vitest, "run", "tests/dossier/recompute.spec.ts"], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) {
  console.error("gate:recompute FAIL");
  process.exit(r.status || 1);
}
console.log("gate:recompute PASS");
