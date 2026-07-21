import { performDossierCalculations } from "../functions/src/cbam/calculator";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls";
import { buildVerifierPackageModel } from "../functions/src/cbam/report/verifier-model";
import { buildUnsignedVerifierArtifacts } from "../functions/src/cbam/report/verifier-package-builder";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { createVerifierGradeCase, createVerifierEvidenceFiles } from "../tests/fixtures/verifier-grade-case";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  
  const artifacts = await buildUnsignedVerifierArtifacts({
    caseData,
    calculation,
    controls,
    reportId: "report_test",
    releaseVersion: 1,
    generatedAt: new Date().toISOString(),
    evidenceFiles: createVerifierEvidenceFiles(),
    assessmentContext: {
      generatedAt: new Date().toISOString(),
      assessmentTimestamp: new Date().toISOString(),
      reportId: "report_test",
      releaseVersion: 1,
      rulesetVersion: "1.0",
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
      previousReleases: []
    }
  });

  const dossierPdf = artifacts.find(a => a.path === "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf");
  console.log("dossierPdf path:", dossierPdf?.path);
  console.log("dossierPdf size:", dossierPdf?.bytes.byteLength);

  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(dossierPdf.bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;

  console.log("dossierPdf Page Count:", document.numPages);
}

main().catch(console.error);
