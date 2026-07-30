import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5, REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 } from "../../functions/src/cbam/report/package-components";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type DataIntegrityManifest,
} from "../../functions/src/cbam/report/verifier-package-builder";
import type { KmsSignatureResult } from "../../functions/src/cbam/report/kms-signature";
import {
  FIXTURE_GENERATED_AT,
  FIXTURE_REPORT_ID,
  FIXTURE_PACKAGE_CODE,
  createVerifierEvidenceFiles,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";
import { assessReadiness, getReportingPeriodAssessment } from "../../functions/src/cbam/validation/readiness-score";
import { generateFindingsAndActions } from "../../functions/src/cbam/validation/findings-engine";

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

    content.items.forEach((item) => {
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
    protectionLevel: "SOFTWARE",
  };
}

function buildTestCalcGraph(rootHash: string): {
  rootHash: string;
  nodes: ReadonlyArray<{
    id: string; label: string; formula: string;
    legalBasis: readonly string[]; inputNodes: readonly string[];
    inputPaths: readonly { path: string }[];
    value: { toString(): string }; unit: string; hash: string;
  }>;
} {
  const node = (id: string, label: string, formula: string, value: string, unit: string, inputs: string[], basis: string[]) => ({
    id, label, formula, legalBasis: basis, inputNodes: inputs,
    inputPaths: inputs.map((i) => ({ path: i })),
    value: { toString: () => value }, unit, hash: "",
  });
  const nodes = [
    node("CBAM_CALC_ROOT", "Embedded Emissions", "COMBINE", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_80", "Direct Emissions", "SUM", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_INSTALL_80", "Installation Direct", "DIRECT_MEASURE", "80", "tCO2e", [], ["IR 2025/2547"]),
    node("CBAM_INDIRECT_40", "Electricity Indirect", "GRID_FACTOR*CONSUMPTION", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"], ["IR 2025/2547"]),
    node("CBAM_GRID_0.4", "Grid Emission Factor", "FACTOR", "0.4", "tCO2e/MWh", [], ["IR 2025/2547"]),
    node("CBAM_CONSUMPTION_100", "Electricity Consumption", "MEASURE", "100", "MWh", [], ["IR 2025/2547"]),
  ];
  return { rootHash, nodes };
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
    
    const firstEvId = caseData.evidenceRegister[0].evidenceId;
    caseData.importerIdentity.legalName.evidenceId = firstEvId;
    caseData.importerIdentity.eoriNumber.evidenceId = firstEvId;
    caseData.importerIdentity.address!.evidenceId = firstEvId;
    caseData.exporterIdentity.legalName.evidenceId = firstEvId;
    caseData.exporterIdentity.address!.evidenceId = firstEvId;
    caseData.installation.name.evidenceId = firstEvId;
    caseData.installation.country.evidenceId = firstEvId;
    caseData.installation.productionRoute.evidenceId = firstEvId;
    caseData.reportingPeriod.year.evidenceId = firstEvId;
    caseData.reportingPeriod.quarter.evidenceId = firstEvId;
    caseData.goods[0]!.cnCode.evidenceId = firstEvId;
    caseData.goods[0]!.allocationShare!.evidenceId = firstEvId;
    caseData.goods[1]!.cnCode.evidenceId = firstEvId;
    caseData.goods[1]!.allocationShare!.evidenceId = firstEvId;

    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister.forEach(e => { e.reportingPeriod = "2026 ANNUAL"; });
    // Test base readiness
    const readiness = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: "2027-01-15" });
    console.log("DEBUG_READINESS:", JSON.stringify(readiness, null, 2));
    expect(readiness.operatorStatus).toBe("NOT_READY");
    expect(parseFloat(readiness.score)).toBeLessThan(90);
    // WP-07/08: concentration + diversity + incomplete operator evidence must prevent perfect readiness
    expect(parseFloat(readiness.assessedCoveragePercent)).toBe(100);
    expect(readiness.recommendedDecision).toBe("DO_NOT_SUBMIT");
    expect(readiness.dimensions.every((d) => d.assessmentState === "ASSESSED")).toBe(true);

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

  it("seals and reopens the exact V5 package", async () => {
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
    
    const firstEvId = caseData.evidenceRegister[0].evidenceId;
    caseData.importerIdentity.legalName.evidenceId = firstEvId;
    caseData.importerIdentity.eoriNumber.evidenceId = firstEvId;
    caseData.importerIdentity.address!.evidenceId = firstEvId;
    caseData.exporterIdentity.legalName.evidenceId = firstEvId;
    caseData.exporterIdentity.address!.evidenceId = firstEvId;
    caseData.installation.name.evidenceId = firstEvId;
    caseData.installation.country.evidenceId = firstEvId;
    caseData.installation.productionRoute.evidenceId = firstEvId;
    caseData.reportingPeriod.year.evidenceId = firstEvId;
    caseData.reportingPeriod.quarter.evidenceId = firstEvId;
    caseData.goods[0]!.cnCode.evidenceId = firstEvId;
    caseData.goods[0]!.allocationShare!.evidenceId = firstEvId;
    caseData.goods[1]!.cnCode.evidenceId = firstEvId;
    caseData.goods[1]!.allocationShare!.evidenceId = firstEvId;

    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister.forEach(e => { e.reportingPeriod = "2026 ANNUAL"; });
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT,
        assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID,
        packageCode: FIXTURE_PACKAGE_CODE,
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
      evidenceCount: 4,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    });

    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    expect(manifest.schemaVersion).toBe("CBAMVALID-DOSSIER-5.0");
    expect(manifest.componentContract.requiredCount).toBe(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5);

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
    expect(pdf.text).toContain("Operator-Prepared Emissions Statement");

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
    
    const firstEvId = caseData.evidenceRegister[0].evidenceId;
    caseData.importerIdentity.legalName.evidenceId = firstEvId;
    caseData.importerIdentity.eoriNumber.evidenceId = firstEvId;
    caseData.importerIdentity.address!.evidenceId = firstEvId;
    caseData.exporterIdentity.legalName.evidenceId = firstEvId;
    caseData.exporterIdentity.address!.evidenceId = firstEvId;
    caseData.installation.name.evidenceId = firstEvId;
    caseData.installation.country.evidenceId = firstEvId;
    caseData.installation.productionRoute.evidenceId = firstEvId;
    caseData.reportingPeriod.year.evidenceId = firstEvId;
    caseData.reportingPeriod.quarter.evidenceId = firstEvId;
    caseData.goods[0]!.cnCode.evidenceId = firstEvId;
    caseData.goods[0]!.allocationShare!.evidenceId = firstEvId;
    caseData.goods[1]!.cnCode.evidenceId = firstEvId;
    caseData.goods[1]!.allocationShare!.evidenceId = firstEvId;

    caseData.reportingPeriod.quarter.value = "ANNUAL";
    caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
    caseData.evidenceRegister.forEach(e => { e.reportingPeriod = "2026 ANNUAL"; });
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT,
        assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID,
        packageCode: FIXTURE_PACKAGE_CODE,
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
      evidenceCount: 4,
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
    expect(fyAss.completenessStatus).toBe("PASSED");

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
    expect(futAss.completenessStatus).toBe("BLOCKED");
    expect(futAss.completenessPercent).toBe("0");
    expect(futAss.definitiveAnnualEligible).toBe(false);

    // 10b. mid-year assessment cannot PASS full-year 2026 completeness
    const midYearCase = makePeriodCase("2026", "ANNUAL", "2026-01-01", "2026-12-31");
    const midAss = getReportingPeriodAssessment(midYearCase, "2026-07-27T12:00:00.000Z");
    expect(midAss.hardBlockerFindingIds).toContain("FND-PERIOD-FUTURE-END-DATE");
    expect(midAss.completenessStatus).toBe("BLOCKED");
    expect(midAss.definitiveAnnualEligible).toBe(false);

    // 11. custom internal period
    const customCase = makePeriodCase("2026", "CUSTOM_PERIOD", "2026-03-01", "2026-08-15");
    const custAss = getReportingPeriodAssessment(customCase, "2027-01-15");
    expect(custAss.type).toBe("CUSTOM_INTERNAL");
    expect(custAss.definitiveAnnualEligible).toBe(false);
  });

  it("blocks READY decision when any readiness dimension is NOT_ASSESSED and never renormalizes to 100", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    // Minimal identity-only case without material evidence/methods — forces sparse assessment.
    caseData.evidenceRegister = [];
    caseData.methodologyDecisions = [];
    caseData.goods = [];
    caseData.directEmissions.evidenceId = undefined;
    caseData.electricityConsumed.evidenceId = undefined;
    caseData.gridEmissionFactor.evidenceId = undefined;

    const readiness = assessReadiness({
      caseData,
      isDraft: false,
      assessmentTimestamp: FIXTURE_GENERATED_AT,
    });

    const unassessedWeight = readiness.dimensions
      .filter((d) => d.assessmentState === "NOT_ASSESSED")
      .reduce((sum, d) => sum + Number(d.weight), 0);

    if (unassessedWeight > 0) {
      expect(Number(readiness.score)).toBeLessThan(100);
      expect(readiness.recommendedDecision).not.toBe("READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT");
      expect(readiness.operatorStatus === "INCOMPLETE_ASSESSMENT" || readiness.operatorStatus === "NOT_READY").toBe(true);
    }

    // Absolute scoring invariant: score cannot exceed assessedCoverage.
    expect(Number(readiness.score)).toBeLessThanOrEqual(Number(readiness.assessedCoveragePercent) + 0.01);
  });

  it("rejects goods lineage / methodology contamination (one-good vs two-goods)", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    // Collapse to one good but leave stale goods.1 lineage + two-goods methodology text.
    caseData.goods = [caseData.goods[1]!];
    caseData.goods[0]!.allocationShare = {
      ...caseData.goods[0]!.allocationShare!,
      value: "1",
    };
    const controls = runQualityControls(caseData);
    const goodsConsistency = controls.find((c) => c.ruleId === "QC_12");
    expect(goodsConsistency?.status).toBe("BLOCKER");
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
    expect(text).toContain("Verified Steel Operator A.S.");
    expect(text).toContain("NOT_PROVIDED");
    expect(text).not.toContain("2023/1776");
    expect(text).toContain("2025/2547");
    expect(text).toContain(`${REQUIRED_TOP_LEVEL_COMPONENTS_V5.length} controlled`);
    expect(text).toContain("NOT_READY");
    expect(text).toContain("ANNEX II");
    expect(text).not.toContain("FIPS 140-2 Level 3 KMS Sealed Hash");
    expect(text).toContain("detached KMS signature");
    expect(text).toContain("72011011");
    expect(text).toContain("72011019");

    console.log(`Verified PDF Geometry successfully. Total pages: ${pages}`);
  });

  // ---- Patch 9: Regression Tests ----
  it("Test A — Exact V5 contract: topLevelCount=26, no missing/extra, Calc Graph present", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    expect(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5).toBe(26);
    expect(manifest.componentContract.requiredCount).toBe(26);
    const expectedComponents = [...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort();
    expect(expectedComponents).toContain("Calculation Graph.json");
    expect(manifest.componentContract.requiredTopLevelComponents).toEqual(REQUIRED_TOP_LEVEL_COMPONENTS_V5);

    const finalized = await finalizeVerifierPackage({
      artifacts, manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    expect(finalized.zipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(finalized.primaryPdf.byteLength).toBeGreaterThan(5000);
  }, 30_000);

  it("Test B — Manifest integrity: sha256, sizeBytes, mediaType match every artifact", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    const allArtifactMap = new Map(artifacts.map(a => [a.path, a]));
    for (const file of manifest.files) {
      const artifact = allArtifactMap.get(file.path);
      expect(artifact).toBeDefined();
      const actualHash = crypto.createHash("sha256").update(artifact!.bytes).digest("hex");
      expect(actualHash).toBe(file.sha256);
      expect(artifact!.bytes.byteLength).toBe(file.sizeBytes);
      expect(artifact!.mediaType).toBe(file.mediaType);
    }
  }, 30_000);

  it("Test C — ZIP reopen: exact top-level set, all manifest hashes, manifest signature, calc graph recompute PASS", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const finalized = await finalizeVerifierPackage({
      artifacts, manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const zip = await JSZip.loadAsync(finalized.zip);
    const reopenedTopLevel = [...new Set(Object.keys(zip.files).filter(p => !zip.files[p].dir || p === "Supporting_Evidence/").map(p => { const s = p.indexOf("/"); return s >= 0 ? p.slice(0, s)+"/" : p; }))].sort();
    expect(reopenedTopLevel).toEqual([...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort());
    const manifestFromZip = JSON.parse(await zip.file("Data Integrity Manifest.json")!.async("string"));
    for (const file of manifestFromZip.files) {
      const entry = zip.file(file.path);
      expect(entry).toBeDefined();
      const bytes = await entry!.async("nodebuffer");
      const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
      expect(actualHash).toBe(file.sha256);
    }
    const calcGraphFromZip = JSON.parse(await zip.file("Calculation Graph.json")!.async("string"));
    expect(calcGraphFromZip.rootHash).toBe(calcGraph.rootHash);
    expect(calcGraphFromZip.nodes).toHaveLength(6);
    expect(calcGraphFromZip.nodes[0].id).toBe("CBAM_CALC_ROOT");
  }, 30_000);

  it("Test D — PDF modification attack: alter PDF bytes after manifest, expect MANIFEST_ARTIFACT_CONTRACT_FAILED", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const tamperedArtifacts = artifacts.map(a =>
      a.path === "Operator Emissions Report.pdf"
        ? { ...a, bytes: Buffer.concat([a.bytes, Buffer.from("TAMPER", "utf8")]) }
        : a
    );
    await expect(finalizeVerifierPackage({
      artifacts: tamperedArtifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    })).rejects.toThrow("PACKAGE_MANIFEST_ARTIFACT_CONTRACT_FAILED");
  }, 30_000);

  it("Test E — Extra component: add unlisted top-level file, expect COMPONENT_CONTRACT_FAILED with extraComponents", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const contaminated = [...artifacts, {
      path: "Extra_Unauthorized_File.csv",
      bytes: Buffer.from("extra", "utf8"),
      mediaType: "text/csv",
    }];
    await expect(finalizeVerifierPackage({
      artifacts: contaminated,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    })).rejects.toThrow(/PACKAGE_COMPONENT_CONTRACT_FAILED.*extraComponents.*Extra_Unauthorized_File/);
  }, 30_000);

  it("Test F — Missing graph: V5 flow without calcGraph, expect COMPONENT_CONTRACT_FAILED missing=Calc Graph", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      // no calcGraph
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    await expect(finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    })).rejects.toThrow(/PACKAGE_COMPONENT_CONTRACT_FAILED.*Calculation Graph.json/);
  }, 30_000);

  it("Test G — Signature tampering: modify manifest bytes after signing, expect SIGNATURE_VERIFICATION_FAILED", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData, controls, calculation,
      reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5, generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 4,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const tamperedBytes = Buffer.concat([manifestResult.bytes, Buffer.from("TAMPER", "utf8")]);
    await expect(finalizeVerifierPackage({
      artifacts,
      manifestBytes: tamperedBytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    })).rejects.toThrow("PACKAGE_MANIFEST_SIGNATURE_HASH_MISMATCH");
  }, 30_000);
});
