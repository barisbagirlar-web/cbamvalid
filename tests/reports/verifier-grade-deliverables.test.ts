import crypto from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import {
  REQUIRED_TOP_LEVEL_COMPONENTS,
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
  createVerifierEvidenceFiles,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";

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

describe("verifier-grade deliverables", () => {
  it("derives closed-form emissions, allocation reconciliation and per-good materiality", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const model = buildVerifierPackageModel({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });

    expect(controls.filter((item) => item.status === "BLOCKER")).toEqual([]);
    expect(calculation.totalDirectEmissions).toBe("80");
    expect(calculation.totalIndirectEmissions).toBe("40");
    expect(calculation.totalEmbeddedEmissions).toBe("120");
    expect(calculation.productionVolume).toBe("100");
    expect(calculation.specificEmbeddedEmissions).toBe("1.2");
    expect(calculation.allocationShareTotal).toBe("1");
    expect(calculation.allocationReconciliationDelta).toBe("0");
    expect(calculation.goods.map((item) => item.allocatedEmbeddedEmissions)).toEqual(["72", "48"]);
    expect(calculation.goods.map((item) => item.specificEmbeddedEmissions)).toEqual(["1.2", "1.2"]);
    expect(model.goods.map((item) => item.materialityThresholdSpecific)).toEqual(["0.06", "0.06"]);
    expect(model.automatedReadiness).toBe("READY_FOR_INDEPENDENT_VERIFICATION");
    expect(model.independentVerifierStatus).toBe("NOT_REVIEWED");
    expect(model.monitoringPlan.every((item) => item.status === "DOCUMENTED")).toBe(true);
    expect(model.ruleset.sourceHash).toBe(DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT);
  });

  it("generates substantive professional PDFs and controlled XLSX structure", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
    });

    expect(topLevel(artifacts.map((item) => item.path))).toHaveLength(25);
    const pdfArtifacts = artifacts.filter((item) => item.mediaType === "application/pdf");
    expect(pdfArtifacts).toHaveLength(11);
    for (const item of pdfArtifacts) {
      expect(item.bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
      expect(item.bytes.byteLength).toBeGreaterThan(5000);
      const parsed = await pdfText(item.bytes);
      expect(parsed.pages).toBeGreaterThanOrEqual(1);
      expect(parsed.text).toContain("CBAMValid");
      expect(parsed.text).toContain("independent");
      expect(parsed.text).toContain("Page 1 of");
    }

    const operator = artifacts.find((item) => item.path === "Operator Emissions Report.pdf");
    expect(operator).toBeDefined();
    const operatorPdf = await pdfText(operator!.bytes);
    expect(operatorPdf.pages).toBeGreaterThanOrEqual(2);
    expect(operatorPdf.text).toContain("Total embedded emissions");
    expect(operatorPdf.text).toContain("5% materiality");
    expect(operatorPdf.text).toContain("NOT_REVIEWED");

    const workbook = artifacts.find((item) => item.path === "Verifier Workspace.xlsx");
    expect(workbook).toBeDefined();
    expect(workbook!.bytes.byteLength).toBeGreaterThan(5000);
    const xlsx = await JSZip.loadAsync(workbook!.bytes, { checkCRC32: true });
    const workbookXml = await xlsx.file("xl/workbook.xml")!.async("string");
    expect(workbookXml).toContain("VERIFIER_SIGN_OFF");
    expect(workbookXml).toContain("LEGAL_SOURCES");
    expect(workbookXml.match(/<sheet /g)?.length).toBeGreaterThanOrEqual(14);

    const sheetXml = (await Promise.all(
      Object.keys(xlsx.files)
        .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
        .map((path) => xlsx.file(path)!.async("string"))
    )).join("\n");
    const relationshipXml = (await Promise.all(
      Object.keys(xlsx.files)
        .filter((path) => /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(path))
        .map((path) => xlsx.file(path)!.async("string"))
    )).join("\n");
    expect(sheetXml).toContain("<pane");
    expect(sheetXml).toContain("<autoFilter");
    expect(sheetXml).toContain("<conditionalFormatting");
    expect(sheetXml).toContain("<dataValidations");
    expect(sheetXml).toContain("COUNTIF(QUALITY_CONTROLS!C:C");
    expect(sheetXml).toContain("NOT_REVIEWED");
    expect(sheetXml).toContain("NO_OPINION");
    expect(relationshipXml).toContain("https://eur-lex.europa.eu/");
  }, 30_000);

  it("seals and reopens the exact 27-component package with regulatory provenance", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 1,
    });
    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    expect(manifest.schemaVersion).toBe("CBAMVALID-DOSSIER-4.0");
    expect(manifest.legalSourceRegistryHash).toBe(DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT);
    expect(manifest.componentContract.requiredCount).toBe(27);
    expect(manifest.files).toHaveLength(artifacts.length);

    const finalized = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    expect(finalized.zipHash).toMatch(/^[a-f0-9]{64}$/);
    const archive = await JSZip.loadAsync(finalized.zip, { checkCRC32: true });
    const paths = Object.keys(archive.files).filter((path) => !archive.files[path].dir || path === "Supporting_Evidence/");
    expect(topLevel(paths)).toEqual([...REQUIRED_TOP_LEVEL_COMPONENTS].sort());
    expect(await archive.file("Data Integrity Manifest.json")!.async("nodebuffer")).toEqual(manifestResult.bytes);
    expect(await archive.file("Manifest Signature.sig")!.async("string")).toContain("RSA_SIGN_PKCS1_2048_SHA256");
    expect(finalized.primaryPdf.byteLength).toBeGreaterThan(5000);
    expect(finalized.workbook.byteLength).toBeGreaterThan(5000);
  }, 30_000);
});
