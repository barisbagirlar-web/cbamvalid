import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pdfSource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/report/premium-dossier-pdf-impl.ts"),
  "utf8"
);
const crosswalkSource = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/registry/verification-template-2025-2546.ts"),
  "utf8"
);

describe("premium dossier truth and consistency contract", () => {
  it("separates sealing blockers, reporting-period restrictions and evidence coverage", () => {
    expect(pdfSource).toContain('"Sealing critical blockers"');
    expect(pdfSource).toContain('"Reporting-period restrictions"');
    expect(pdfSource).toContain('"Evidence period coverage"');
    expect(pdfSource).not.toContain('["Completeness", `${model.reportingPeriodAssessment.completenessPercent}%`]');
  });

  it("never labels verifier-reserved pending fields as passed", () => {
    expect(pdfSource).toContain('row.status === "PENDING_VERIFIER"');
    expect(pdfSource).toContain('"Verifier action pending"');
    expect(pdfSource).not.toContain('row.validationErrors.join("; ") || "Passed"');
  });

  it("separates verification law from calculation methodology", () => {
    expect(crosswalkSource).toContain('legalSourceId: "IMPL_2025_2546"');
    expect(crosswalkSource).toContain('legalSourceId: "IMPL_2025_2547"');
    expect(crosswalkSource).toContain('legalLocation: "Article 6 & Annex III"');
    expect(crosswalkSource).toContain('legalLocation: "Annex II, point E"');
    expect(pdfSource).toContain("controlled legal sources are listed row by row");
  });
});