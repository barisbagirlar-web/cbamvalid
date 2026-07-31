#!/usr/bin/env npx tsx
/**
 * FAZ P0 (H) — render the four complete sandbox dossiers to artifacts so the
 * PDF/XLSX/ZIP can be inspected by a human reviewer (and by the inspect
 * command). Uses the same shared seal pipeline as the test suites.
 *
 * Output layout:
 *   artifacts/four-complete-dossiers/<KEY>/
 *     <caseId>-verifier-package.zip
 *     <caseId>-primary-report.pdf
 *     <caseId>-workbook.xlsx
 *     <caseId>-manifest.json
 *     <caseId>-calculation-trace.json
 *     evidence/<evidenceId>.pdf
 *
 * Usage:
 *   npx tsx scripts/render-four-complete-dossiers.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { FOUR_DOSSIER_KEYS } from "../tests/fixtures/four-dossiers";
import { buildDossierSealedPackage } from "../tests/fixtures/four-dossier-package";

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function main(): Promise<void> {
  const root = resolve(process.cwd(), "artifacts", "four-complete-dossiers");
  for (const key of FOUR_DOSSIER_KEYS) {
    const pkg = await buildDossierSealedPackage(key);
    const outDir = join(root, key);
    mkdirSync(outDir, { recursive: true });

    const base = safeName(pkg.caseData.caseId ?? key);
    writeFileSync(join(outDir, `${base}-verifier-package.zip`), pkg.finalized.zip);
    writeFileSync(join(outDir, `${base}-primary-report.pdf`), pkg.finalized.primaryPdf);
    writeFileSync(join(outDir, `${base}-manifest.json`), pkg.manifestResult.bytes);
    for (const artifact of pkg.artifacts) {
      if (artifact.path === "Calculation Trace.json") {
        writeFileSync(join(outDir, `${base}-calculation-trace.json`), artifact.bytes);
      }
    }

    // Unzip the full package so reviewers can open any component directly.
    const zip = await JSZip.loadAsync(pkg.finalized.zip);
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const target = join(outDir, "package", relativePath);
      mkdirSync(resolve(target, ".."), { recursive: true });
      writeFileSync(target, Buffer.from(await file.async("uint8array")));
      if (relativePath.toLowerCase().endsWith(".xlsx")) {
        writeFileSync(join(outDir, `${base}-workbook.xlsx`), Buffer.from(await file.async("uint8array")));
      }
    }

    // Evidence PDFs (deterministic synthetic documents).
    const evidenceDir = join(outDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    for (const file of pkg.evidenceFiles) {
      writeFileSync(join(evidenceDir, `${safeName(file.evidenceId)}.pdf`), file.bytes);
    }

    console.log(
      `Rendered ${key}: ${pkg.finalized.primaryPdf.byteLength} byte primary PDF, ` +
      `${pkg.manifestResult.manifest.componentContract.requiredCount} components, ` +
      `zipHash ${pkg.finalized.zipHash.slice(0, 16)}… → ${outDir}`
    );
  }
  console.log(`\nRendered all four dossiers under ${root}`);
}

void main();
