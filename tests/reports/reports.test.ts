import { describe, it, expect } from "vitest";
import { buildPdfDossier } from "../../lib/cbam/report/pdf-builder";
import { buildWorkbook } from "../../lib/cbam/report/workbook-builder";
import { buildXml } from "../../lib/cbam/report/xml-builder";
import { orchestrateCalculation } from "../../lib/cbam/engine/calculation-orchestrator";

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
});
