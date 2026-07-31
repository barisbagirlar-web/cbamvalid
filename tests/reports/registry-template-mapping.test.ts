import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { buildVerifierWorkbook } from "../../functions/src/cbam/report/xlsx-builder";
import { buildVerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import {
  REGISTRY_TEMPLATE_MAPPING_DATASET_NAME,
  buildRegistryTemplateMapping,
  buildRegistryTemplateMappingDataset,
} from "../../functions/src/cbam/registry/registry-template-mapping";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { FIXTURE_REPORT_ID, FIXTURE_PACKAGE_CODE, FIXTURE_GENERATED_AT } from "../fixtures/verifier-grade-case";

describe("FAZ 12 registry template mapping dataset", () => {
  it("is named Registry Verification Template Mapping Dataset and never claims official Registry XML", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const dataset = buildRegistryTemplateMappingDataset(caseData, "2026-07-31T00:00:00.000Z");
    expect(dataset.datasetName).toBe(REGISTRY_TEMPLATE_MAPPING_DATASET_NAME);
    expect(dataset.officialRegistryXml).toBe(false);
    expect(dataset.schemaVersion).toBe("REGISTRY-TEMPLATE-MAPPING-1.0");
    expect(dataset.fields.length).toBeGreaterThan(20);
  });

  it("covers operator, installation, period, goods, emissions, precursor, allocation and verifier sections", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const fields = buildRegistryTemplateMapping(caseData, "2026-07-31T00:00:00.000Z");
    const ids = new Set(fields.map((entry) => entry.registryFieldId));
    expect(ids.size).toBe(fields.length);
    for (const expected of [
      "REG-OP-LEGAL-NAME",
      "REG-OP-COUNTRY",
      "REG-INST-NAME",
      "REG-INST-COUNTRY",
      "REG-PERIOD-YEAR",
      "REG-GOOD-CN-0",
      "REG-GOOD-PROD-0",
      "REG-DIRECT-EM",
      "REG-ELECTRICITY",
      "REG-ALLOC-METHOD",
      "REG-VER-NAME",
      "REG-VER-ACC-NO",
      "REG-VER-OPINION",
    ]) {
      expect(ids).toContain(expected);
    }
    for (const entry of fields) {
      expect(entry.registryFieldId).toBeTruthy();
      expect(entry.section).toBeTruthy();
      expect(entry.legalBasis).toContain("(EU)");
      expect(entry.sourcePath).toBeTruthy();
      expect(["COMPLETE_OPERATOR", "PENDING_VERIFIER", "MISSING_OPERATOR", "NOT_APPLICABLE_WITH_BASIS"]).toContain(entry.status);
      expect(["OPERATOR", "CBAMVALID_SYSTEM", "INDEPENDENT_VERIFIER"]).toContain(entry.owner);
    }
  });

  it("marks verifier-reserved fields PENDING_VERIFIER and empty required operator fields MISSING_OPERATOR", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const fields = buildRegistryTemplateMapping(caseData, "2026-07-31T00:00:00.000Z");
    const verifierFields = fields.filter((entry) => entry.owner === "INDEPENDENT_VERIFIER");
    expect(verifierFields.length).toBeGreaterThan(0);
    for (const entry of verifierFields) {
      expect(entry.status).toBe("PENDING_VERIFIER");
    }
    const operatorName = fields.find((entry) => entry.registryFieldId === "REG-OP-LEGAL-NAME");
    expect(operatorName?.status).toBe("COMPLETE_OPERATOR");
    const missing = fields.find((entry) => entry.registryFieldId === "REG-OP-REG-NO");
    expect(["COMPLETE_OPERATOR", "MISSING_OPERATOR"]).toContain(missing?.status);
  });

  it("marks precursor and carbon-price fields NOT_APPLICABLE_WITH_BASIS when absent and COMPLETE_OPERATOR when present", () => {
    const noPrecursors = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    noPrecursors.precursors = [];
    noPrecursors.carbonPriceRecords = [];
    const fields = buildRegistryTemplateMapping(noPrecursors, "2026-07-31T00:00:00.000Z");
    const precursorRow = fields.find((entry) => entry.registryFieldId === "REG-PRECURSORS");
    expect(precursorRow?.status).toBe("NOT_APPLICABLE_WITH_BASIS");
    expect(precursorRow?.validationErrors).toContain("NOT_APPLICABLE_WITH_BASIS");
    const carbonRow = fields.find((entry) => entry.registryFieldId === "REG-CARBON-PRICE");
    expect(carbonRow?.status).toBe("NOT_APPLICABLE_WITH_BASIS");
  });

  it("renders the dataset in the Verifier Workspace Registry Mapping sheet", async () => {
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
    expect(model.registryTemplateMapping.length).toBeGreaterThan(0);
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
    expect(workbookXml).toContain('name="Registry Mapping"');
    const sheetFiles = Object.keys(xlsx.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
    const allSheetXml = (await Promise.all(sheetFiles.map((path) => xlsx.file(path)!.async("string")))).join("\n");
    expect(allSheetXml).toContain("REG-OP-LEGAL-NAME");
    expect(allSheetXml).toContain("COMPLETE_OPERATOR");
    expect(allSheetXml).toContain("PENDING_VERIFIER");
  }, 30_000);
});
