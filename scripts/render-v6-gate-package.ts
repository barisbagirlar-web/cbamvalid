#!/usr/bin/env npx tsx
/**
 * G-09 CI helper — render a V6 package surface to disk so the forbidden-string
 * scan (scripts/gate-no-test-artifacts.sh) runs against real V6 output, not a
 * legacy sample. The 27th component (Enterprise Compliance Master Record.pdf)
 * is rendered from the V6 master-record model; the remaining components come
 * from the same shared seal pipeline the four-dossier suites exercise.
 *
 * Output layout:
 *   artifacts/gates/G-09/package/
 *     Enterprise Compliance Master Record.pdf
 *     <standard verifier artifacts: CSVs, workbook, trace, evidence, ...>
 *
 * Usage:
 *   npx tsx scripts/render-v6-gate-package.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildDossierSealedPackage } from "../tests/fixtures/four-dossier-package";
import {
  V6_ENGINE_VERSION,
  V6_RULESET,
  V6_SCHEMA_VERSION,
  buildV6Package,
} from "../tests/gates/gate-helpers";
import type { PackageArtifact } from "../functions/src/cbam/report/verifier-package-builder";
import { buildMasterRecordPdf } from "../functions/src/cbam/report/v6/master-record-pdf";

const OUT_DIR = resolve(process.cwd(), "artifacts", "gates", "G-09", "package");

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  const v6 = await buildV6Package("STEEL_IN");
  const v5 = await buildDossierSealedPackage("STEEL_IN");

  const masterRecordEntry: PackageArtifact = {
    path: "Enterprise Compliance Master Record.pdf",
    bytes: buildMasterRecordPdf(v6.masterRecordModel),
    mediaType: "application/pdf",
  };

  const allArtifacts = [...v5.artifacts, masterRecordEntry];
  const controlKey = v6.masterRecordModel.controlKey;

  const manifest = {
    schemaVersion: V6_SCHEMA_VERSION,
    reportId: controlKey.reportId,
    caseId: v6.caseData.caseId ?? "",
    packageCode: controlKey.packageCode,
    releaseVersion: controlKey.releaseVersion,
    generatedAt: controlKey.generatedAt,
    ruleset: V6_RULESET,
    engineVersion: V6_ENGINE_VERSION,
    packageReadinessState: v6.state,
    dataEvidenceReadiness: v6.scores.dataEvidenceReadiness,
    periodClosure: v6.scores.periodClosure,
    calculationRootHash: v6.calculation.calculationRootHash,
    componentCount: allArtifacts.length,
    evidenceCount: controlKey.evidenceCount,
    files: allArtifacts
      .map((entry) => ({
        path: entry.path,
        sha256: sha256(entry.bytes),
        sizeBytes: entry.bytes.byteLength,
        mediaType: entry.mediaType,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };

  const manifestEntry: PackageArtifact = {
    path: "Data Integrity Manifest.json",
    bytes: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    mediaType: "application/json",
  };

  for (const entry of [...allArtifacts, manifestEntry]) {
    const target = join(OUT_DIR, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.bytes);
  }

  console.log(
    `Rendered V6 gate package: ${allArtifacts.length + 1} components, state ${v6.state}, ` +
      `dataEvidenceReadiness ${v6.scores.dataEvidenceReadiness}, periodClosure ${v6.scores.periodClosure} → ${OUT_DIR}`
  );
}

void main();
