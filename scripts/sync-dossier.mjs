#!/usr/bin/env node
/**
 * Sync canonical src/dossier → lib/dossier and functions/src/dossier.
 * SSOT is src/dossier. Mirrors exist only for Next SSR and Cloud Functions import paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "dossier");
const targets = [path.join(root, "lib", "dossier"), path.join(root, "functions", "src", "dossier")];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(src)) {
  console.error("MISSING src/dossier");
  process.exit(1);
}

for (const t of targets) {
  fs.rmSync(t, { recursive: true, force: true });
  copyDir(src, t);
  console.log(`synced → ${path.relative(root, t)}`);
}
