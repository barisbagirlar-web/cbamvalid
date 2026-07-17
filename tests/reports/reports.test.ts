import { describe, it, expect } from "vitest";
import { buildPdfDossier } from "../../functions/src/cbam/report/pdf-builder";
import { buildWorkbook } from "../../functions/src/cbam/report/workbook-builder";
import { buildXml } from "../../functions/src/cbam/report/xml-builder";
import { orchestrateCalculation } from "../../lib/cbam/engine/calculation-orchestrator";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";

describe("Report Builders & Sealing Artifacts", () => {
  const mockInput = {
    role: "IMPORTER" as const,
    importYear: 2026,
    importQuarter: 1,
    cnCode: "72011011",
    productionVolume: 100,
    installationName: "Test Installation",
    hasActualData: false,
    isVerified: false,
    isComplexGood: false,
  };

  const calcResult = orchestrateCalculation(mockInput);

  it("Generates PDF dossier buffer successfully", () => {
    const pdf = buildPdfDossier(mockInput, calcResult, "mock-hash-value");
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("Generates Excel workbook XML buffer successfully", () => {
    const workbook = buildWorkbook(mockInput, calcResult);
    expect(workbook).toBeInstanceOf(Buffer);
    expect(workbook.length).toBeGreaterThan(0);
  });

  it("Generates XML interoperability string successfully", () => {
    const xml = buildXml(mockInput, calcResult, "mock-hash-value");
    expect(typeof xml).toBe("string");
    expect(xml).toContain("CBAMDefinitiveDossier");
    expect(xml).toContain("mock-hash-value");
  });

  it("Flags TR origin + EUR currency carbon price record as INVALID_STATE", () => {
    const invalidCase = {
      caseId: "case_test_invalid",
      uid: "test_uid",
      goods: [{ cnCode: { value: "72011011" }, productionVolume: { value: "100" } }],
      directEmissions: { value: "150", unit: "tCO2e" },
      electricityConsumed: { value: "50", unit: "MWh" },
      gridEmissionFactor: { value: "0.45", unit: "tCO2e/MWh" },
      precursors: [],
      installationCountry: "TR",
      carbonPriceRecords: [{ id: "rec_1", amountPaid: 25.5, currency: "EUR", legislationReference: "TR Carbon Tax Law 44" }]
    };
    expect(() => performDossierCalculations(invalidCase as any)).toThrow("INVALID_STATE");
  });
});
