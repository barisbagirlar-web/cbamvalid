/**
 * Verifier ZIP vs operator Master Record boundary, plus customer-facing
 * period-closure clock. generatedAt is the only clock that may stamp
 * PERIOD_CLOSED / remaining days / operator sign-off effect.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  countVerifierControlledFileComponents,
  REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V6,
} from "../../functions/src/cbam/report/package-components";
import {
  buildDataIntegrityManifest,
  finalizeVerifierPackage,
} from "../../functions/src/cbam/report/verifier-package-builder";
import { MASTER_RECORD_FILE_NAME } from "../../functions/src/cbam/report/v6/master-record-model";
import { createFourDossierCase } from "../fixtures/four-dossiers";
import { buildDossierSealedPackage, dossierReportId } from "../fixtures/four-dossier-package";
import { createSignature } from "../fixtures/kms-test-signer";
import { buildV6PackageFromCase, masterRecordPdfText } from "./gate-helpers";

describe("verifier-operator boundary", () => {
  it("keeps the customer-facing period clock on generatedAt and the Master Record out of the verifier contract", async () => {
    const generatedAt = "2026-08-13T12:00:00.000Z";
    const caseData = createFourDossierCase("STEEL_IN");
    const built = await buildV6PackageFromCase(caseData, generatedAt, "STEEL_IN");

    expect(built.masterRecordModel.controlKey.componentCount).toBe(25);
    expect(built.masterRecordModel.controlKey.componentCount).toBe(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V6);
    expect(built.scores.periodEnded).toBe(false);
    expect(built.scores.periodClosure).toBeLessThan(100);
    expect(built.state).not.toBe("READY_FOR_INDEPENDENT_VERIFICATION");
    expect(built.stateReasonCodes).not.toContain("PERIOD_CLOSED");
    expect(built.masterRecordModel.calendar.periodEnded).toBe(false);
    expect(built.masterRecordModel.calendar.remainingDays).toBeGreaterThan(100);

    const { text } = await masterRecordPdfText(built.masterRecordModel);
    expect(text).toContain("B1 · Verifier package delivery inventory");
    expect(text).toMatch(/B1A\s*·\s*OPERATOR RECORDS/i);
    expect(text).toContain("not part of verifier handover package");
    expect(text).toContain(MASTER_RECORD_FILE_NAME);
    expect(text).toMatch(/Reporting period close[\s\S]*OPEN/);
    expect(text).toContain("NOT BINDING — signedAt after generatedAt");
    expect(text).not.toContain("2027-01-28T10:00:00.000Z");
  });

  it("seals a V7 ZIP with 25 verifier files and rejects Master Record membership", async () => {
    const built = await buildDossierSealedPackage("STEEL_IN");
    const unsigned = built.artifacts.filter(
      (item) => item.path !== "Data Integrity Manifest.json" && item.path !== "Manifest Signature.sig"
    );
    const generatedAt = built.caseData.auditEvents[0]?.timestamp ?? "2027-01-31T00:00:00.000Z";

    const manifestResult = buildDataIntegrityManifest({
      artifacts: unsigned,
      caseData: built.caseData,
      calculation: built.calculation,
      reportId: dossierReportId("STEEL_IN"),
      releaseVersion: 1,
      generatedAt,
      evidenceCount: built.evidenceFiles.length,
      releaseContractVersion: 7,
    });
    expect(manifestResult.manifest.componentContract.requiredCount).toBe(25);

    const finalized = await finalizeVerifierPackage({
      artifacts: unsigned,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt,
    });
    const archive = await JSZip.loadAsync(finalized.zip, { checkCRC32: true });
    const paths = Object.keys(archive.files);
    expect(paths).not.toContain(MASTER_RECORD_FILE_NAME);
    const topLevelFiles = paths.filter((path) => !path.includes("/") && !archive.files[path]!.dir);
    expect(topLevelFiles).toHaveLength(25);
    expect(
      countVerifierControlledFileComponents([
        ...manifestResult.manifest.files.map((file) => file.path),
        "Data Integrity Manifest.json",
        "Manifest Signature.sig",
      ])
    ).toBe(25);

    const poisoned = [
      ...unsigned,
      { path: MASTER_RECORD_FILE_NAME, bytes: Buffer.alloc(6000, 7), mediaType: "application/pdf" },
    ];
    const poisonedManifest = buildDataIntegrityManifest({
      artifacts: poisoned,
      caseData: built.caseData,
      calculation: built.calculation,
      reportId: dossierReportId("STEEL_IN"),
      releaseVersion: 1,
      generatedAt,
      evidenceCount: built.evidenceFiles.length,
      releaseContractVersion: 7,
    });
    await expect(
      finalizeVerifierPackage({
        artifacts: poisoned,
        manifestBytes: poisonedManifest.bytes,
        signature: createSignature(poisonedManifest.bytes),
        generatedAt,
      })
    ).rejects.toThrow(/PACKAGE_COMPONENT_CONTRACT_FAILED/);
  }, 30_000);
});
