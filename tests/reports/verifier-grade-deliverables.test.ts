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
import { buildVerifierWorkbook } from "../../functions/src/cbam/report/xlsx-builder";
import { DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT } from "../../functions/src/cbam/registry/legal-sources";
import { createSignature } from "../fixtures/kms-test-signer";
import {
  FIXTURE_GENERATED_AT,
  FIXTURE_REPORT_ID,
  FIXTURE_PACKAGE_CODE,
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
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });

    expect(controls.filter((item) => item.status === "BLOCKER")).toEqual([]);
    expect(calculation.totalDirectEmissions).toBe("80");
    expect(calculation.totalIndirectEmissions).toBe("40");
    expect(calculation.totalEmbeddedEmissions).toBe("80");
    expect(calculation.productionVolume).toBe("100");
    expect(calculation.specificEmbeddedEmissions).toBe("0.8");
    expect(calculation.allocationShareTotal).toBe("1");
    expect(calculation.allocationReconciliationDelta).toBe("0");
    expect(calculation.goods.map((item) => item.allocatedEmbeddedEmissions)).toEqual(["48", "32"]);
    expect(calculation.goods.map((item) => item.specificEmbeddedEmissions)).toEqual(["0.8", "0.8"]);
    expect(calculation.goods.map((item) => item.indirectExclusionCode)).toEqual(["ANNEX_II_DIRECT_ONLY", "ANNEX_II_DIRECT_ONLY"]);
    expect(model.goods.map((item) => item.materialityThresholdSpecific)).toEqual(["0.04", "0.04"]);
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
      packageCode: FIXTURE_PACKAGE_CODE,
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
       expect(parsed.text).toContain("Verified Steel");
       expect(parsed.text).toContain("independent");
      expect(parsed.text).toContain("Page 1 of");
    }

    const operator = artifacts.find((item) => item.path === "Operator Emissions Report.pdf");
    expect(operator).toBeDefined();
    const operatorPdf = await pdfText(operator!.bytes);
    expect(operatorPdf.pages).toBeGreaterThanOrEqual(6);
    expect(operatorPdf.text).toContain("Executive summary");
    expect(operatorPdf.text).toContain("Emissions waterfall");
    expect(operatorPdf.text).toContain("Sensitivity analysis");
    expect(operatorPdf.text).toContain("Evidence register");
    expect(operatorPdf.text).toContain("Mathematical audit trail");
    expect(operatorPdf.text).toContain("Time-series availability");
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
      packageCode: FIXTURE_PACKAGE_CODE,
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
      evidenceCount: 4,
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

describe("FAZ 11 verifier workspace XLSX contract", () => {
  const FAZ11_SHEETS = [
    "README",
    "Executive Summary",
    "Operator",
    "Installation",
    "Goods",
    "Monitoring Plan",
    "Source Streams",
    "Emission Sources",
    "Meters",
    "Activity Data",
    "Precursors",
    "Allocation",
    "Calculations",
    "Evidence Register",
    "Evidence Matrix",
    "Risk Register",
    "Materiality",
    "Sampling Plan",
    "Misstatements",
    "Non-Conformities",
    "Corrective Actions",
    "Registry Crosswalk",
    "Verifier Team",
    "Site Visits",
    "Verifier Opinion",
    "Version Delta",
    "Manifest Index",
  ];

  it("contains all 27 mandated sheets from the canonical dataset", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const model = buildVerifierPackageModel({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const workbook = await buildVerifierWorkbook({
      caseData,
      calculation,
      controls,
      model,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const xlsx = await JSZip.loadAsync(workbook, { checkCRC32: true });
    const workbookXml = await xlsx.file("xl/workbook.xml")!.async("string");
    for (const name of FAZ11_SHEETS) {
      expect(workbookXml).toContain(`name="${name}"`);
    }
    expect(workbookXml).not.toContain("EMISSIONS_SUMMARY");
    expect(workbookXml).not.toContain("CALCULATION_TRACE");
    const sheetCount = workbookXml.match(/<sheet /g)?.length ?? 0;
    expect(sheetCount).toBeGreaterThanOrEqual(FAZ11_SHEETS.length);
  }, 30_000);

  it("locks formulas, marks input cells, and contains no macros or hidden data", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const workbook = await buildVerifierWorkbook({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const xlsx = await JSZip.loadAsync(workbook, { checkCRC32: true });
    const allSheetXml = (await Promise.all(
      Object.keys(xlsx.files)
        .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
        .map((path) => xlsx.file(path)!.async("string"))
    )).join("\n");
    const contentTypes = await xlsx.file("[Content_Types].xml")!.async("string");
    const styles = await xlsx.file("xl/styles.xml")!.async("string");
    expect(allSheetXml).toContain("<sheetProtection");
    expect(allSheetXml).toContain('<pane');
    expect(styles).toContain('<protection locked="0"');
    expect(allSheetXml).toContain('s="10"');
    expect(contentTypes).not.toContain("vbaProject");
    expect(contentTypes).not.toContain("application/vnd.ms-excel");
    expect(xlsx.file("xl/vbaProject.bin")).toBeNull();
  }, 30_000);

  it("renders the A-H segregation, allocation reconciliation and manifest index from the same dataset as the PDF/JSON", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const model = buildVerifierPackageModel({
      caseData,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const workbook = await buildVerifierWorkbook({
      caseData,
      calculation,
      controls,
      model,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const xlsx = await JSZip.loadAsync(workbook, { checkCRC32: true });
    const workbookXml = await xlsx.file("xl/workbook.xml")!.async("string");
    const sheetFiles = Object.keys(xlsx.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
    const allSheetXml = (await Promise.all(sheetFiles.map((path) => xlsx.file(path)!.async("string")))).join("\n");
    expect(allSheetXml).toContain("Installation direct emissions (A)");
    expect(allSheetXml).toContain("Certificate-relevant embedded emissions (G)");
    expect(allSheetXml).toContain("Total informational embedded emissions (H)");
    expect(allSheetXml).toContain("Allocation reconciliation delta");
    expect(allSheetXml).toContain(String(calculation.emissionsByCategory?.H_TOTAL_INFORMATIONAL_EMBEDDED));
    expect(allSheetXml).toContain("Data Integrity Manifest.json");
    expect(workbookXml).toContain("Manifest Index");
  }, 30_000);
});
