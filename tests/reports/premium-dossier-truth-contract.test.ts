import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pdfImplSource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/report/premium-dossier-pdf-impl.ts"),
  "utf8"
);
const pdfBoundarySource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/report/premium-dossier-pdf.ts"),
  "utf8"
);
const registryMappingSource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/registry/registry-template-mapping.ts"),
  "utf8"
);
const crosswalkSource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/registry/verification-template-2025-2546.ts"),
  "utf8"
);

describe("premium dossier truth and consistency contract", () => {
  it("separates sealing blockers, reporting-period restrictions and evidence coverage", () => {
    expect(pdfImplSource).toContain('"Sealing critical blockers"');
    expect(pdfImplSource).toContain('"Reporting-period restrictions"');
    expect(pdfImplSource).toContain('"Evidence period coverage"');
    expect(pdfImplSource).not.toContain('["Completeness", `${model.reportingPeriodAssessment.completenessPercent}%`]');
  });

  it("never labels verifier-reserved pending fields as passed", () => {
    expect(pdfImplSource).toContain('row.status === "PENDING_VERIFIER"');
    expect(pdfImplSource).toContain('"Verifier action pending"');
    expect(pdfImplSource).not.toContain('row.validationErrors.join("; ") || "Passed"');
  });

  it("separates verification law from calculation methodology with readable citations", () => {
    expect(crosswalkSource).toContain('legalSourceId: "IMPL_2025_2546"');
    expect(crosswalkSource).toContain('legalSourceId: "IMPL_2025_2547"');
    expect(crosswalkSource).toContain("Implementing Regulation (EU) 2025/2546, Article 6");
    expect(crosswalkSource).toContain("Implementing Regulation (EU) 2025/2547, Article 6 & Annex III");
    expect(crosswalkSource).toContain("Implementing Regulation (EU) 2025/2547, Annex II, point E");
    expect(pdfImplSource).toContain("controlled legal sources are listed row by row");
  });

  it("uses the immutable generatedAt clock for customer-facing period eligibility", () => {
    expect(pdfBoundarySource).toContain("getReportingPeriodAssessment(caseData, model.generatedAt)");
    expect(pdfBoundarySource).toContain("generateFindingsAndActions(caseData, model.generatedAt)");
    expect(pdfBoundarySource).toContain("CONTROLLED SYNTHETIC DEMONSTRATION — NOT REAL OPERATOR DATA — NOT FOR REGULATORY RELIANCE");
  });

  it("uses canonical V5 readiness as operator preparation and never claims period eligibility is inside that score", () => {
    expect(pdfBoundarySource).toContain("const canonicalOperatorScore = Number(model.readiness.score)");
    expect(pdfBoundarySource).toContain("operatorPreparationScore:");
    expect(pdfBoundarySource).toContain("externalVerifierCompleted");
    expect(pdfImplSource).toContain('"Operator-controlled data and calculation readiness"');
    expect(pdfImplSource).not.toContain('"Automated readiness including period eligibility"');
    expect(pdfImplSource).toContain('"External verifier completion"');
  });

  it("reports hashed manifest entries separately from the 26-component top-level contract", () => {
    expect(pdfBoundarySource).toContain("V5_NON_HASHED_CONTRACT_ENTRIES");
    expect(pdfBoundarySource).toContain("V5_SUPPORTING_CONTROL_FILES");
    expect(pdfBoundarySource).toContain("manifestFileCount: projectedHashedEntries");
    expect(pdfImplSource).toContain('"Required top-level components"');
    expect(pdfImplSource).toContain('"Manifest file count"');
  });

  it("maps electricity and grid-factor registry fields to their evaluated evidence requirements", () => {
    expect(registryMappingSource).toContain('evidenceIdsFor("REQ-ELEC-CON")');
    expect(registryMappingSource).toContain('validationErrorsFor("REQ-ELEC-CON")');
    expect(registryMappingSource).toContain('evidenceIdsFor("REQ-ELEC-FAC")');
    expect(registryMappingSource).toContain('validationErrorsFor("REQ-ELEC-FAC")');
    expect(registryMappingSource).not.toContain('evidenceIdsFor("REQ-ELEC")');
    expect(registryMappingSource).not.toContain('validationErrorsFor("REQ-GRID")');
  });
});
