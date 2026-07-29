import crypto from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema, EvidenceRecordSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  REQUIRED_TOP_LEVEL_COMPONENTS_V5,
  type DataIntegrityManifest,
} from "../../functions/src/cbam/report/verifier-package-builder";
import {
  assertCompleteArtifactCommit,
  isSealLeaseHeldByOther,
} from "../../functions/src/cbam/report/seal-activation";
import type { KmsSignatureResult } from "../../functions/src/cbam/report/kms-signature";
import { verifyPublicPackageSignature } from "../../lib/verify/package-signature";
import {
  createVerifierEvidenceFiles,
  createVerifierGradeCase,
  FIXTURE_GENERATED_AT,
  FIXTURE_PACKAGE_CODE,
  FIXTURE_REPORT_ID,
} from "../fixtures/verifier-grade-case";

function signatureFor(manifestBytes: Buffer): KmsSignatureResult {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    keyVersion: "projects/test/locations/europe-west1/keyRings/cbam/cryptoKeys/manifest/cryptoKeyVersions/1",
    algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    manifestHash: crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    signatureBase64: crypto.sign("sha256", manifestBytes, privateKey).toString("base64"),
    publicKeyPem: publicKey,
    protectionLevel: "SOFTWARE",
  };
}

describe("strict seal activation", () => {
  it("defaults newly registered evidence to pending review and scan", () => {
    const evidence = EvidenceRecordSchema.parse({
      evidenceId: "11111111-1111-4111-8111-111111111111",
      documentType: "PRODUCTION_RECORD",
      fileName: "production.pdf",
      storagePath: "evidence/user/case/evidence/production.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      issuer: "Operator",
      issueDate: "2026-01-31",
      reportingPeriod: "2026",
      fileHash: "a".repeat(64),
      uploadTimestamp: "2026-07-29T12:00:00.000Z",
      uploader: "user",
      linkedInputs: ["goods.0.productionVolume"],
      linkedCalculations: [],
    });
    expect(evidence.reviewStatus).toBe("PENDING");
    expect(evidence.supportStatus).toBe("PENDING");
    expect(evidence.malwareScanStatus).toBe("PENDING");
  });

  it("allows lease takeover only after expiry", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    expect(isSealLeaseHeldByOther({
      status: "IN_PROGRESS",
      leaseOwner: "worker-a",
      leaseExpiresAt: "2026-07-29T12:00:01.000Z",
    }, "worker-b", now)).toBe(true);
    expect(isSealLeaseHeldByOther({
      status: "IN_PROGRESS",
      leaseOwner: "worker-a",
      leaseExpiresAt: "2026-07-29T12:00:00.000Z",
    }, "worker-b", now)).toBe(false);
  });

  it("rejects partial artifact uploads before activation", () => {
    const hash = "a".repeat(64);
    expect(() => assertCompleteArtifactCommit(
      ["reports/u/r/dossier.zip", "reports/u/r/manifest.json"],
      [{ path: "reports/u/r/dossier.zip", sha256: hash, sizeBytes: 100 }]
    )).toThrow("SEAL_ARTIFACT_COMMIT_INCOMPLETE");
  });

  it("cryptographically derives public signature validity", () => {
    const manifestBytes = Buffer.from(JSON.stringify({ reportId: FIXTURE_REPORT_ID }), "utf8");
    const signature = signatureFor(manifestBytes);
    const signatureBytes = Buffer.from(JSON.stringify(signature), "utf8");
    const manifestHash = crypto.createHash("sha256").update(manifestBytes).digest("hex");
    const signatureHash = crypto.createHash("sha256").update(signatureBytes).digest("hex");
    const input = {
      reportId: FIXTURE_REPORT_ID,
      reportManifestHash: manifestHash,
      manifestBytes,
      manifestIndex: { sha256: manifestHash, sizeBytes: manifestBytes.byteLength },
      signatureBytes,
      signatureIndex: { sha256: signatureHash, sizeBytes: signatureBytes.byteLength },
    };
    expect(verifyPublicPackageSignature(input)).toBe(true);
    expect(verifyPublicPackageSignature({
      ...input,
      reportId: `report_${"b".repeat(64)}`,
    })).toBe(false);
    expect(verifyPublicPackageSignature({
      ...input,
      manifestBytes: Buffer.from(`${manifestBytes.toString("utf8")} `, "utf8"),
    })).toBe(false);
  });

  it("builds the exact 23-component V5 package and validates every reopened file", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const calculation = performDossierCalculations(caseData);
    const controls = runQualityControls(caseData);
    const evidenceFiles = createVerifierEvidenceFiles();
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT,
        assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID,
        packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 1,
        rulesetVersion: calculation.ruleset,
        productCode: "pack_premium_dossier_v5",
        releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: evidenceFiles.length,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    });
    const finalized = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: signatureFor(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const archive = await JSZip.loadAsync(finalized.zip, { checkCRC32: true });
    const topLevel = [...new Set(Object.keys(archive.files)
      .filter((path) => !archive.files[path].dir || path === "Supporting_Evidence/")
      .map((path) => path.includes("/") ? `${path.split("/")[0]}/` : path))].sort();
    expect(topLevel).toEqual([...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort());
    expect(topLevel).toHaveLength(23);

    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    for (const file of manifest.files) {
      const bytes = await archive.file(file.path)!.async("nodebuffer");
      expect(bytes.byteLength).toBe(file.sizeBytes);
      expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
    expect(archive.file("Supporting_Evidence/Manifest Signature.sig")).not.toBeNull();
  }, 30_000);
});
