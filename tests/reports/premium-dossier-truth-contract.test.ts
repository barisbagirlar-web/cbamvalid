import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "functions/src/cbam/report/premium-dossier-pdf-impl.ts"),
  "utf8"
);

describe("premium dossier truth and consistency contract", () => {
  it("separates sealing blockers, reporting-period restrictions and evidence coverage", () => {
    expect(source).toContain('"Sealing critical blockers"');
    expect(source).toContain('"Reporting-period restrictions"');
    expect(source).toContain('"Evidence period coverage"');
    expect(source).not.toContain('["Completeness", `${model.reportingPeriodAssessment.completenessPercent}%`]');
  });

  it("never labels verifier-reserved pending fields as passed", () => {
    expect(source).toContain('row.status === "PENDING_VERIFIER"');
    expect(source).toContain('"Verifier action pending"');
    expect(source).not.toContain('row.validationErrors.join("; ") || "Passed"');
  });

  it("does not hard-code a contradictory implementing-regulation number", () => {
    expect(source).not.toContain("Implementing Regulation (EU) 2025/2547");
    expect(source).toContain("controlled legal sources are listed row by row");
  });
});
