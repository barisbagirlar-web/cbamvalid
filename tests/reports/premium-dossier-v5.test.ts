import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import {
  REQUIRED_TOP_LEVEL_COMPONENTS_V5,
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type DataIntegrityManifest,
} from "../../functions/src/cbam/report/verifier-package-builder";
import { buildVerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import { DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT } from "../../functions/src/cbam/registry/legal-sources";
import type { KmsSignatureResult } from "../../functions/src/cbam/report/kms-signature";
import {
  FIXTURE_GENERATED_AT,
  FIXTURE_REPORT_ID,
  FIXTURE_EVIDENCE_ID,
  createVerifierEvidenceFiles,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";
import { assessReadiness } from "../../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";

async function pdfText(bytes: Buffer): Promise<{ text: string; pages: number }> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
  }
  return { text, pages: document.numPages };
}

function topLevel(paths: string[]): string[] {
  return [...new Set(paths.map((path) => {
    const slash = path.indexOf("/");
    return slash >= 0 ? `${path.slice(0, slash)}/` : path;
  }))].sort();
}

function createSignature(manifestBytes: Buffer): KmsSignatureResult {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const manifestHash = crypto.createHash("sha256").update(manifestBytes).digest("hex");
  const signature = crypto.sign("sha256", manifestBytes, privateKey);
  return {
    keyVersion: "projects/test/locations/europe-west1/keyRings/cbam/cryptoKeys/manifest/cryptoKeyVersions/1",
    algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    manifestHash,
    signatureBase64: signature.toString("base64"),
    publicKeyPem: publicKey,
  };
}

describe("premium-dossier-v5 deliverables", () => {
  it("derives V5 specific readiness scores, findings, and checks hard gates", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.evidenceRegister[0].linkedInputs.push(
      "exporterIdentity.legalName",
      "exporterIdentity.address",
      "importerIdentity.legalName",
      "importerIdentity.eoriNumber",
      "installation.name",
      "installation.country",
      "installation.productionRoute",
      "reportingPeriod.year",
      "reportingPeriod.quarter",
      "goods.0.cnCode",
      "goods.0.allocationShare",
      "goods.1.cnCode",
      "goods.1.allocationShare"
    );
    
    // Test base readiness
    const readiness = assessReadiness({ caseData, isDraft: false });
    expect(readiness.operatorStatus).toBe("READY_FOR_VERIFIER_REVIEW");
    expect(parseFloat(readiness.score)).toBeGreaterThanOrEqual(90);
    expect(readiness.criticalBlockerCount).toBe(0);

    // Test PARTIALLY_SUPPORTED evidence blocking sealing/readiness
    const dirtyCase = JSON.parse(JSON.stringify(caseData));
    dirtyCase.evidenceRegister[0].supportStatus = "PARTIALLY_SUPPORTED";
    
    const readinessDirty = assessReadiness({ caseData: dirtyCase, isDraft: false });
    expect(readinessDirty.operatorStatus).toBe("NOT_READY");
    expect(readinessDirty.missingMaterialEvidenceCount).toBeGreaterThan(0);
  });

  it("seals and reopens the exact 23-component V5 package", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.evidenceRegister[0].linkedInputs.push(
      "exporterIdentity.legalName",
      "exporterIdentity.address",
      "importerIdentity.legalName",
      "importerIdentity.eoriNumber",
      "installation.name",
      "installation.country",
      "installation.productionRoute",
      "reportingPeriod.year",
      "reportingPeriod.quarter",
      "goods.0.cnCode",
      "goods.0.allocationShare",
      "goods.1.cnCode",
      "goods.1.allocationShare"
    );
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
    });

    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 1,
    });

    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    expect(manifest.schemaVersion).toBe("CBAMVALID-DOSSIER-5.0");
    expect(manifest.componentContract.requiredCount).toBe(23);

    const finalized = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    
    expect(finalized.zipHash).toMatch(/^[a-f0-9]{64}$/);
    const archive = await JSZip.loadAsync(finalized.zip, { checkCRC32: true });
    const paths = Object.keys(archive.files).filter((path) => !archive.files[path].dir || path === "Supporting_Evidence/");
    
    expect(topLevel(paths)).toEqual([...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort());
    
    const primaryPdf = artifacts.find((item) => item.path === "Operator Emissions Report.pdf");
    expect(primaryPdf).toBeDefined();
    const pdf = await pdfText(primaryPdf!.bytes);
    expect(pdf.text).toContain("CBAMValid");
    expect(pdf.text).toContain("Verification Readiness & Evidence Assurance Dossier");
  }, 30_000);

  it("exports the sample-v5 dossier to artifacts/sample-v5", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.evidenceRegister[0].linkedInputs.push(
      "exporterIdentity.legalName",
      "exporterIdentity.address",
      "importerIdentity.legalName",
      "importerIdentity.eoriNumber",
      "installation.name",
      "installation.country",
      "installation.productionRoute",
      "reportingPeriod.year",
      "reportingPeriod.quarter",
      "goods.0.cnCode",
      "goods.0.allocationShare",
      "goods.1.cnCode",
      "goods.1.allocationShare"
    );
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
    });

    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 1,
    });

    const finalized = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });

    const zip = await JSZip.loadAsync(finalized.zip);
    const outputDir = path.join(process.cwd(), "artifacts", "sample-v5");
    fs.mkdirSync(outputDir, { recursive: true });
    
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) {
        fs.mkdirSync(path.join(outputDir, relativePath), { recursive: true });
      } else {
        const fileBuffer = await file.async("nodebuffer");
        const outPath = path.join(outputDir, relativePath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, fileBuffer);
      }
    }
    
    // Also save the ZIP package itself in the folder!
    fs.writeFileSync(path.join(outputDir, "dossier.zip"), finalized.zip);
    
    // Check that files exist in outputDir
    expect(fs.existsSync(path.join(outputDir, "Operator Emissions Report.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "Data Integrity Manifest.json"))).toBe(true);
  }, 30_000);
});
