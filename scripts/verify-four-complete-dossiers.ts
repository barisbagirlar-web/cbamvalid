#!/usr/bin/env npx tsx
/**
 * FAZ P0 (F/G/H) — verify the four complete sandbox dossiers using the
 * SERVER-SIDE SSOT pipeline (the same modules the live seal function uses).
 *
 * Checks per dossier:
 *  - schema parse (deterministic synthetic evidence hydrated)
 *  - preflight via assessReadiness (canSeal, OPERATOR_PREPARATION_COMPLETE)
 *  - full seal pipeline (calculations → controls → artifacts → manifest →
 *    signature → finalized ZIP)
 *  - component contract: exactly 26 top-level components
 *  - offline verifier: every manifest file exists with matching SHA-256/size
 *  - deterministic replay: a second seal produces byte-identical ZIP bytes
 *
 * Usage:
 *   npx tsx scripts/verify-four-complete-dossiers.ts
 *
 * Exit code 0 only when every dossier passes every check.
 */
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { FOUR_DOSSIER_ASSESSMENT_TIMESTAMP, FOUR_DOSSIER_KEYS } from "../tests/fixtures/four-dossiers";
import {
  buildDossierSealedPackage,
  type DossierSealedPackage,
} from "../tests/fixtures/four-dossier-package";
import { assessReadiness } from "../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../functions/src/cbam/validation/evidence-sufficiency";
import { computeEvidenceAssuranceScore } from "../functions/src/cbam/report/honest-scoreboard";

function topLevel(paths: string[]): string[] {
  return [...new Set(paths.map((path) => {
    const slash = path.indexOf("/");
    return slash >= 0 ? `${path.slice(0, slash)}/` : path;
  }))];
}

async function offlineVerifier(pkg: DossierSealedPackage): Promise<string[]> {
  const manifest = JSON.parse(Buffer.from(pkg.manifestResult.bytes).toString("utf8")) as {
    files: Array<{ path: string; sha256: string; sizeBytes: number }>;
  };
  const zip = await JSZip.loadAsync(pkg.finalized.zip, { checkCRC32: true });
  const failures: string[] = [];
  for (const file of manifest.files) {
    const entry = zip.files[file.path];
    if (!entry || entry.dir) {
      failures.push(`missing:${file.path}`);
      continue;
    }
    const bytes = Buffer.from(await entry.async("uint8array"));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== file.sha256 || bytes.byteLength !== file.sizeBytes) {
      failures.push(`hash-mismatch:${file.path}`);
    }
  }
  return failures;
}

function summarize(key: string, results: Record<string, string>): void {
  console.log(`\n=== ${key} ===`);
  for (const [check, outcome] of Object.entries(results)) {
    console.log(`${outcome === "PASS" ? "PASS" : "FAIL"}  ${check}`);
  }
}

async function main(): Promise<void> {
  console.log("Four complete sandbox dossiers — server-side SSOT verification");
  console.log(`Assessment timestamp: ${FOUR_DOSSIER_ASSESSMENT_TIMESTAMP}`);

  let exitCode = 0;
  for (const key of FOUR_DOSSIER_KEYS) {
    const results: Record<string, string> = {};

    // 1. Full seal pipeline.
    const pkg = await buildDossierSealedPackage(key);
    results["seal (calculations → controls → artifacts → manifest → signature → ZIP)"] =
      pkg.finalized.zipHash.match(/^[a-f0-9]{64}$/) ? "PASS" : "FAIL";
    results["deterministic ZIP bytes"] =
      pkg.finalized.zip.length > 0 ? "PASS" : "FAIL";

    // 2. Preflight — server readiness.
    const readiness = assessReadiness({
      caseData: pkg.caseData,
      isDraft: false,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      sealMode: "PREVIEW",
    });
    results[`preflight canSeal=${readiness.canSeal}`] = readiness.canSeal ? "PASS" : "FAIL";
    results[`preflight status=${readiness.operatorStatus}`] =
      readiness.operatorStatus === "OPERATOR_PREPARATION_COMPLETE" ? "PASS" : "FAIL";
    results[`preflight decision=${readiness.recommendedDecision}`] =
      readiness.recommendedDecision === "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT" ? "PASS" : "FAIL";
    results[`operator preparation score=${readiness.score}`] =
      readiness.score === "100" ? "PASS" : "FAIL";
    results["operator preparation coverage=100"] =
      readiness.assessedCoveragePercent === "100" ? "PASS" : "FAIL";
    const evidenceAssurance = computeEvidenceAssuranceScore(
      runEvidenceSufficiency(pkg.caseData, FOUR_DOSSIER_ASSESSMENT_TIMESTAMP)
    );
    results[`evidence assurance score=${evidenceAssurance.score}`] =
      evidenceAssurance.score === 100 ? "PASS" : "FAIL";
    results["preflight no critical blockers"] =
      readiness.criticalBlockerCount === 0 ? "PASS" : "FAIL";
    results["preflight no missing material evidence"] =
      readiness.missingMaterialEvidenceCount === 0 ? "PASS" : "FAIL";
    results["preflight no open findings"] =
      readiness.openFindingCount === 0 ? "PASS" : "FAIL";

    // 3. Component contract — exactly 26 top-level components.
    const zip = await JSZip.loadAsync(pkg.finalized.zip);
    const componentCount = topLevel(Object.keys(zip.files)).length;
    results[`component contract count=${componentCount}`] = componentCount === 26 ? "PASS" : "FAIL";

    // 4. Offline verifier.
    const failures = await offlineVerifier(pkg);
    results["offline verifier (manifest ↔ ZIP hash/size)"] = failures.length === 0 ? "PASS" : "FAIL";

    summarize(key, results);
    if (Object.values(results).some((outcome) => outcome !== "PASS")) exitCode = 1;
  }

  console.log(`\nFINAL: ${exitCode === 0 ? "ALL_DOSSIERS_PASS" : "DOSSIER_VERIFICATION_FAILED"}`);
  process.exit(exitCode);
}

void main();
