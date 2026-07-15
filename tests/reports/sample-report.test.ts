import { describe, it, expect } from "vitest";
import { buildPdfDossier } from "../../functions/src/cbam/report/pdf-builder";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import path from "path";

describe("Sample Dossier Privacy Guard", () => {
  it("must redact sensitive information when redactForPublicSample is true", async () => {
    // 1. Load Fixture
    const fixturePath = path.resolve(__dirname, "../fixtures/cbam/sample-dossier-v1.json");
    const caseData = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    // Mock Calculation Output
    const calcMock = {
      inputs: { importYear: 2026, cnCode: "72085120" },
      applicability: { sector: "STEEL", isApplicable: true, underThreshold: false },
      pathway: { pathway: "DEFAULT" },
      specificDirectEmissions: 1.85,
      specificIndirectEmissions: 0.05,
      totalDirectEmissions: 27750,
      totalIndirectEmissions: 750,
      totalEmbeddedEmissions: 28500,
      certificatesBeforeReduction: 28500,
      carbonPricePaidCurrency: "EUR",
      carbonPricePaidPerTco2e: 25.5,
      eligibleCertificateReduction: 0,
      netCertificatesDue: 28500,
      pricing: { priceEurPerTonne: 80, state: "PUBLISHED", datasetVersion: "2026-v1" },
      estimatedCertificateCostEur: 2280000,
      traces: {}
    };

    // 2. Generate Canonical PDF
    const pdfBuffer = buildPdfDossier(caseData, calcMock as unknown as Parameters<typeof buildPdfDossier>[1], "SAMPLE-HASH", true, true);
    
    // 3. Extract text from PDF using pdfjs-dist
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ 
      data, 
      disableFontFace: true, 
      standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/" 
    });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = "";
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => ('str' in item ? item.str : "")).join(" ");
      fullText += pageText + " ";
    }

    // 4. Assert Privacy Guard Conditions
    // Should contain explicit redaction strings
    expect(fullText).toContain("REDACTED IN PUBLIC SAMPLE");
    
    // Should NOT contain the real data from the fixture stringifications if we had real ones
    // Although the fixture uses "FICTIONAL_DEMONSTRATION_DATA" for EORI, the code doesn't print it.
    // The code only prints REDACTED IN PUBLIC SAMPLE
    expect(fullText).not.toContain(caseData.importer.eori.value); // Because we intercepted it
    expect(fullText).not.toContain(caseData.installation.name.value);
  });
});
