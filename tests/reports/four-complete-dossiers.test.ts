/**
 * Four complete current-engine sandbox dossiers.
 *
 * Mandatory tests:
 *  - four fixtures preflight PASS
 *  - four current report identities satisfy the production report contract
 *  - four full package seals PASS
 *  - four ZIP archives expose exactly 26 top-level components
 *  - four offline verifier runs PASS
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { assessReadiness } from "../../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";
import { computeEvidenceAssuranceScore } from "../../functions/src/cbam/report/honest-scoreboard";
import {
  REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
  REQUIRED_TOP_LEVEL_COMPONENTS_V5,
} from "../../functions/src/cbam/report/package-components";
import type { DataIntegrityManifest } from "../../functions/src/cbam/report/verifier-package-builder";
import {
  FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  FOUR_DOSSIER_KEYS,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
} from "../fixtures/four-dossiers";
import {
  DOSSIER_RELEASE_CONTRACT_VERSION,
  DOSSIER_RELEASE_VERSION,
  FOUR_DOSSIER_FIXTURE_SET,
  buildDossierSealedPackage,
  dossierReportId,
  legacyDossierReportId,
  type DossierSealedPackage,
} from "../fixtures/four-dossier-package";

function topLevel(paths: string[]): string[] {
  return [...new Set(paths.map((path) => {
    const slash = path.indexOf("/");
    return slash >= 0 ? `${path.slice(0, slash)}/` : path;
  }))].sort();
}

async function runOfflineVerifier(pkg: DossierSealedPackage): Promise<{
  ok: boolean;
  missing: string[];
  mismatched: string[];
}> {
  const manifest = JSON.parse(Buffer.from(pkg.manifestResult.bytes).toString("utf8")) as DataIntegrityManifest;
  const zip = await JSZip.loadAsync(pkg.finalized.zip, { checkCRC32: true });

  const missing: string[] = [];
  const mismatched: string[] = [];
  for (const file of manifest.files) {
    const entry = zip.files[file.path];
    if (!entry || entry.dir) {
      missing.push(file.path);
      continue;
    }
    const bytes = Buffer.from(await entry.async("uint8array"));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== file.sha256 || bytes.byteLength !== file.sizeBytes) {
      mismatched.push(file.path);
    }
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing, mismatched };
}

describe("four complete current-engine sandbox dossiers", () => {
  it("uses fresh production-compatible report identities and Release 1/V5 contract separation", () => {
    expect(FOUR_DOSSIER_FIXTURE_SET).toBe("FOUR_COMPLETE_DOSSIERS_V2");
    expect(DOSSIER_RELEASE_VERSION).toBe(1);
    expect(DOSSIER_RELEASE_CONTRACT_VERSION).toBe(5);

    const reportIds = FOUR_DOSSIER_KEYS.map(dossierReportId);
    expect(new Set(reportIds).size).toBe(FOUR_DOSSIER_KEYS.length);
    for (const key of FOUR_DOSSIER_KEYS) {
      expect(dossierReportId(key)).toMatch(/^report_[a-f0-9]{64}$/);
      expect(dossierReportId(key)).not.toBe(legacyDossierReportId(key));
    }
  });

  for (const key of FOUR_DOSSIER_KEYS) {
    describe(key, () => {
      it("preflight PASS — server assessReadiness allows sealing", async () => {
        const caseData = createFourDossierCase(key);
        await buildFourDossierEvidenceFiles(caseData);
        const parsed = AuditReadyCaseSchema.parse(caseData);
        const readiness = assessReadiness({
          caseData: parsed,
          isDraft: false,
          assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
          sealMode: "PREVIEW",
        });
        expect(readiness.canSeal).toBe(true);
        expect(readiness.operatorStatus).toBe("OPERATOR_PREPARATION_COMPLETE");
        expect(readiness.recommendedDecision).toBe("READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT");
        expect(readiness.criticalBlockerCount).toBe(0);
        expect(readiness.missingMaterialEvidenceCount).toBe(0);
        expect(readiness.openFindingCount).toBe(0);
        expect(readiness.assessedCoveragePercent).toBe("100");
        expect(readiness.score).toBe("100");

        const evidenceAssurance = computeEvidenceAssuranceScore(
          runEvidenceSufficiency(parsed, FOUR_DOSSIER_ASSESSMENT_TIMESTAMP)
        );
        expect(evidenceAssurance.score).toBe(100);
      });

      it("seal PASS — full pipeline produces a signed immutable ZIP", async () => {
        const pkg = await buildDossierSealedPackage(key);
        expect(pkg.finalized.zipHash).toMatch(/^[a-f0-9]{64}$/);
        expect(pkg.finalized.primaryPdf.byteLength).toBeGreaterThan(5000);
        expect(pkg.manifestResult.manifest.reportId).toBe(dossierReportId(key));
        expect(pkg.manifestResult.manifest.releaseVersion).toBe(1);
        expect(pkg.manifestResult.manifest.schemaVersion).toBe("CBAMVALID-DOSSIER-5.0");
        const archive = await JSZip.loadAsync(pkg.finalized.zip, { checkCRC32: true });
        expect(topLevel(Object.keys(archive.files))).toEqual(
          [...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort()
        );
      }, 30_000);

      it("ZIP component contract — exactly 26 top-level components", async () => {
        const pkg = await buildDossierSealedPackage(key);
        const manifest = JSON.parse(Buffer.from(pkg.manifestResult.bytes).toString("utf8")) as DataIntegrityManifest;
        expect(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5).toBe(26);
        expect(manifest.componentContract.requiredCount).toBe(26);
        expect(manifest.componentContract.requiredTopLevelComponents).toEqual(
          REQUIRED_TOP_LEVEL_COMPONENTS_V5
        );
        const archive = await JSZip.loadAsync(pkg.finalized.zip);
        expect(topLevel(Object.keys(archive.files)).length).toBe(26);
      });

      it("offline verifier PASS — every manifest file exists with matching hash and size", async () => {
        const pkg = await buildDossierSealedPackage(key);
        const result = await runOfflineVerifier(pkg);
        expect(result.missing).toEqual([]);
        expect(result.mismatched).toEqual([]);
        expect(result.ok).toBe(true);
      }, 30_000);
    });
  }
});
