import fs from "fs";
import path from "path";
import { rasterizePdfToWebPBuffers } from "../lib/pdf-rasterizer.ts";
import { buildPremiumDossierPdf } from "../functions/build/cbam/report/premium-dossier-pdf.js";
import { createVerifierGradeCase } from "../tests/fixtures/verifier-grade-case.ts";

async function main() {
  const outputDir = path.join(process.cwd(), "scratch", "pdf-pages");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const caseData = createVerifierGradeCase();
  const model = {
    reportId: "report_sample_v5_test_dossier_hash_12345",
    caseId: caseData.caseId,
    releaseVersion: 1,
    generatedAt: "2026-07-21T18:00:00.000Z",
    documentTitle: "CBAM Verification Readiness & Evidence Assurance Dossier",
    identity: {
      exporterOperator: String(caseData.exporterIdentity.legalName.value),
      importer: String(caseData.importerIdentity.legalName.value),
      eori: String(caseData.importerIdentity.eoriNumber.value),
      installation: String(caseData.installation.name.value),
      country: String(caseData.installation.country.value),
      reportingPeriod: `${caseData.reportingPeriod.year.value}-${caseData.reportingPeriod.quarter.value}`,
      systemBoundary: String(caseData.installation.systemBoundaries),
    },
    readiness: {
      score: "98.50",
      operatorStatus: "READY_FOR_VERIFIER_REVIEW",
      criticalBlockerCount: 0,
      materialFindingCount: 0,
      openFindingCount: 0,
      missingMaterialEvidenceCount: 0,
      unresolvedCalculationExceptionCount: 0,
      recommendedDecision: "READY_TO_HAND_OVER",
      dimensions: [
        { dimensionId: "IDENTITY", weight: "10", rawScore: "100.00", weightedScore: "10.00", passedRequirementCount: 6, applicableRequirementCount: 6, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "SCOPE_AND_METHODOLOGY", weight: "15", rawScore: "100.00", weightedScore: "15.00", passedRequirementCount: 4, applicableRequirementCount: 4, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "ACTIVITY_DATA", weight: "15", rawScore: "100.00", weightedScore: "15.00", passedRequirementCount: 5, applicableRequirementCount: 5, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "EVIDENCE", weight: "20", rawScore: "100.00", weightedScore: "20.00", passedRequirementCount: 15, applicableRequirementCount: 15, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "CALCULATION_INTEGRITY", weight: "15", rawScore: "100.00", weightedScore: "15.00", passedRequirementCount: 1, applicableRequirementCount: 1, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "ALLOCATION_AND_RECONCILIATION", weight: "10", rawScore: "100.00", weightedScore: "10.00", passedRequirementCount: 2, applicableRequirementCount: 2, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "DATA_QUALITY_AND_UNCERTAINTY", weight: "10", rawScore: "90.00", weightedScore: "9.00", passedRequirementCount: 1, applicableRequirementCount: 1, blockerFindingIds: [], materialFindingIds: [] },
        { dimensionId: "PACKAGE_INTEGRITY", weight: "5", rawScore: "90.00", weightedScore: "4.50", passedRequirementCount: 1, applicableRequirementCount: 1, blockerFindingIds: [], materialFindingIds: [] },
      ],
    },
    goods: caseData.goods.map((g, idx) => ({
      goodIndex: `Good ${idx + 1}`,
      cnCode: String(g.cnCode.value),
      sector: g.sector,
      productionVolume: String(g.productionVolume.value),
      productionUnit: String(g.productionVolume.canonicalUnit || "t"),
      allocationShare: String(g.allocationShare.value),
      allocatedEmbeddedEmissions: "48.00 tCO2e",
      specificEmbeddedEmissions: "0.8000 tCO2e/t",
    })),
    totals: {
      installationDirectEmissions: "80.00",
      totalDirectEmissions: "80.00",
      electricityIndirectEmissions: "40.00",
      eligibleCertificateReduction: "0.00",
      totalEmbeddedEmissions: "120.00",
      specificEmbeddedEmissions: "1.2000",
      allocationShareTotal: "1.00",
      allocationReconciliationDelta: "0.00",
    },
    precursors: [],
    evidenceSufficiency: [],
    findings: [],
    correctiveActions: [],
    requirementCrosswalk: [
      { requirementId: "REQ-01", legalLocation: "EU 2025/2546 Art 3", requirementText: "Operator identity declaration and address validation", owner: "OPERATOR", status: "PASSED" },
      { requirementId: "REQ-02", legalLocation: "EU 2025/2546 Art 4", requirementText: "Installation production route and process boundary", owner: "OPERATOR", status: "PASSED" },
    ],
    manifestSummary: {
      manifestHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      packageHash: "f4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
      signatureHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    },
    legalBoundary: "This operator-prepared dossier is provided exclusively for independent accredited verifier preparation under EU Regulation 2023/956 and Implementing Regulation (EU) 2025/2546.",
    schemaVersion: "5.0.0",
  };

  const pdfBuffer = buildPremiumDossierPdf(model, caseData);
  fs.writeFileSync(path.join(outputDir, "dossier-sample.pdf"), pdfBuffer);

  const images = await rasterizePdfToWebPBuffers(pdfBuffer);
  images.forEach((buf, idx) => {
    fs.writeFileSync(path.join(outputDir, `page-${idx + 1}.png`), buf);
  });

  console.log(`Rendered ${images.length} pages to ${outputDir}`);
}

main().catch(console.error);
