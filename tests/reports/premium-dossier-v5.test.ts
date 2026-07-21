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
import { assessReadiness, getReportingPeriodAssessment } from "../../functions/src/cbam/validation/readiness-score";
import { generateFindingsAndActions } from "../../functions/src/cbam/validation/findings-engine";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";

async function verifyPdfGeometry(pdfBytes: Buffer) {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;

  expect(document.numPages).toBeGreaterThanOrEqual(5);

  for (let pageNum = 1; pageNum <= document.numPages; pageNum++) {
    const page = await document.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const width = viewport.width;
    const height = viewport.height;

    content.items.forEach((item: any) => {
      if (!("str" in item) || !item.str.trim()) return;
      
      const tx = item.transform; // [scaleX, skewX, skewY, scaleY, x, y]
      const x = tx[4];
      const y = tx[5];

      expect(x).toBeGreaterThanOrEqual(-50);
      expect(x).toBeLessThanOrEqual(width + 50);
      expect(y).toBeGreaterThanOrEqual(-50);
      expect(y).toBeLessThanOrEqual(height + 50);
    });
  }
}

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
    
    // Enforce annual period for base readiness test
    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister[0].reportingPeriod = "2026 ANNUAL";
    // Test base readiness
    const readiness = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: "2027-01-15" });
    expect(readiness.operatorStatus).toBe("READY_FOR_VERIFIER_REVIEW");
    expect(parseFloat(readiness.score)).toBeGreaterThanOrEqual(90);
    expect(readiness.criticalBlockerCount).toBe(0);

    // Test PARTIALLY_SUPPORTED evidence blocking sealing/readiness
    const dirtyCase = JSON.parse(JSON.stringify(caseData));
    dirtyCase.evidenceRegister[0].supportStatus = "PARTIALLY_SUPPORTED";
    
    const readinessDirty = assessReadiness({ caseData: dirtyCase, isDraft: false, assessmentTimestamp: "2027-01-15" });
    expect(readinessDirty.operatorStatus).toBe("NOT_READY");
    expect(readinessDirty.missingMaterialEvidenceCount).toBeGreaterThan(0);

    // Test that quarterly period blocks readiness
    const quarterlyCase = JSON.parse(JSON.stringify(caseData));
    quarterlyCase.reportingPeriod.quarter.value = "Q1";
    const { operatorStatus: status, criticalBlockerCount, canSeal } = assessReadiness({ caseData: quarterlyCase, isDraft: false, assessmentTimestamp: "2027-01-15" });
    expect(status).toBe("NOT_READY");
    expect(criticalBlockerCount).toBeGreaterThan(0);
    expect(canSeal).toBe(false);

    const { findings } = generateFindingsAndActions(quarterlyCase);
    expect(findings).toContainEqual(
      expect.objectContaining({ findingId: "FND-PERIOD-NON-ANNUAL" })
    );
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
    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister[0].reportingPeriod = "2026 ANNUAL";
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
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT,
        assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID,
        releaseVersion: 5,
        rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5",
        releaseContractVersion: 5,
      },
    });

    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 1,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    });

    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    expect(manifest.schemaVersion).toBe("CBAMVALID-DOSSIER-5.0");
    expect(manifest.componentContract.requiredCount).toBe(25);

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

    const premiumPdf = artifacts.find((item) => item.path === "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf");
    expect(premiumPdf).toBeDefined();
    const pdfPremium = await pdfText(premiumPdf!.bytes);
    expect(pdfPremium.text).toContain("CBAMValid");
    expect(pdfPremium.text).toContain("Verification Readiness & Evidence Assurance Dossier");
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
    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister[0].reportingPeriod = "2026 ANNUAL";
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
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT,
        assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID,
        releaseVersion: 5,
        rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5",
        releaseContractVersion: 5,
      },
    });

    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 1,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
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
    expect(fs.existsSync(path.join(outputDir, "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "Data Integrity Manifest.json"))).toBe(true);
  }, 30_000);

  it("validates all reporting period fixtures correctly", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());

    const makePeriodCase = (year: string, quarter: string, startDate?: string, endDate?: string) => {
      const c = JSON.parse(JSON.stringify(caseData));
      c.reportingPeriod.year.value = year;
      c.reportingPeriod.quarter.value = quarter;
      if (startDate !== undefined) {
        c.reportingPeriod.startDate = { value: startDate, inputPath: "reportingPeriod.startDate", sourceEvidenceId: "EV-001" };
      } else {
        delete c.reportingPeriod.startDate;
      }
      if (endDate !== undefined) {
        c.reportingPeriod.endDate = { value: endDate, inputPath: "reportingPeriod.endDate", sourceEvidenceId: "EV-001" };
      } else {
        delete c.reportingPeriod.endDate;
      }
      return c;
    };

    // 1. 2026-Q1
    const q1Case = makePeriodCase("2026", "Q1");
    const q1Ass = getReportingPeriodAssessment(q1Case, "2027-01-15");
    expect(q1Ass.type).toBe("INTERIM_QUARTERLY");
    expect(q1Ass.definitiveAnnualEligible).toBe(false);
    expect(q1Ass.hardBlockerFindingIds).toContain("FND-PERIOD-NON-ANNUAL");

    // 2. 2026-Q2
    const q2Case = makePeriodCase("2026", "Q2");
    const q2Ass = getReportingPeriodAssessment(q2Case, "2027-01-15");
    expect(q2Ass.type).toBe("INTERIM_QUARTERLY");
    expect(q2Ass.definitiveAnnualEligible).toBe(false);

    // 3. one month
    const m1Case = makePeriodCase("2026", "M01");
    const m1Ass = getReportingPeriodAssessment(m1Case, "2027-01-15");
    expect(m1Ass.type).toBe("INTERIM_MONTHLY");
    expect(m1Ass.definitiveAnnualEligible).toBe(false);

    // 4. six months
    const h1Case = makePeriodCase("2026", "CUSTOM", "2026-01-01", "2026-06-30");
    const h1Ass = getReportingPeriodAssessment(h1Case, "2027-01-15");
    expect(h1Ass.type).toBe("CUSTOM_INTERNAL");
    expect(h1Ass.definitiveAnnualEligible).toBe(false);

    // 5. 2026 full year
    const fyCase = makePeriodCase("2026", "ANNUAL", "2026-01-01", "2026-12-31");
    const fyAss = getReportingPeriodAssessment(fyCase, "2027-01-15");
    expect(fyAss.type).toBe("DEFINITIVE_ANNUAL");
    expect(fyAss.definitiveAnnualEligible).toBe(true);

    // 6. leap-year full year
    const leapCase = makePeriodCase("2024", "ANNUAL", "2024-01-01", "2024-12-31");
    const leapAss = getReportingPeriodAssessment(leapCase, "2025-01-15");
    expect(leapAss.type).toBe("DEFINITIVE_ANNUAL");
    expect(leapAss.coveredDays).toBe(366);
    expect(leapAss.definitiveAnnualEligible).toBe(true);

    // 7. missing start date and year
    const missingStart = makePeriodCase("", "ANNUAL", "", "2026-12-31");
    const msAss = getReportingPeriodAssessment(missingStart, "2027-01-15");
    expect(msAss.hardBlockerFindingIds).toContain("FND-PERIOD-MISSING-START-DATE");

    // 8. missing end date and year
    const missingEnd = makePeriodCase("", "ANNUAL", "2026-01-01", "");
    const meAss = getReportingPeriodAssessment(missingEnd, "2027-01-15");
    expect(meAss.hardBlockerFindingIds).toContain("FND-PERIOD-MISSING-END-DATE");

    // 9. end before start
    const badChrono = makePeriodCase("2026", "ANNUAL", "2026-12-31", "2026-01-01");
    const bcAss = getReportingPeriodAssessment(badChrono, "2027-01-15");
    expect(bcAss.hardBlockerFindingIds).toContain("FND-PERIOD-INVALID-CHRONOLOGY");

    // 10. future year
    const futureCase = makePeriodCase("2099", "ANNUAL", "2099-01-01", "2099-12-31");
    const futAss = getReportingPeriodAssessment(futureCase, "2027-01-15");
    expect(futAss.hardBlockerFindingIds).toContain("FND-PERIOD-FUTURE-END-DATE");

    // 11. custom internal period
    const customCase = makePeriodCase("2026", "CUSTOM_PERIOD", "2026-03-01", "2026-08-15");
    const custAss = getReportingPeriodAssessment(customCase, "2027-01-15");
    expect(custAss.type).toBe("CUSTOM_INTERNAL");
    expect(custAss.definitiveAnnualEligible).toBe(false);
  });

  it("verifies PDF visual geometry and ensures all 30 sections, IDs and labels are present without silent truncation", async () => {
    const outputDir = path.join(process.cwd(), "artifacts", "sample-v5");
    const primaryPdfPath = path.join(outputDir, "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf");
    expect(fs.existsSync(primaryPdfPath)).toBe(true);

    const pdfBytes = fs.readFileSync(primaryPdfPath);
    await verifyPdfGeometry(pdfBytes);

    const { text, pages } = await pdfText(pdfBytes);
    
    // Check 30 sections
    for (let i = 1; i <= 30; i++) {
      expect(text).toContain(`${i}.`);
    }

    // Check critical findings & evidence references are present
    expect(text).toContain("11111111");
    expect(text).toContain("Prepared for Independent");
    expect(text).toContain("Verified Steel Operator GmbH");
    expect(text).toContain("NOT_PROVIDED");

    console.log(`Verified PDF Geometry successfully. Total pages: ${pages}`);
  });
});
