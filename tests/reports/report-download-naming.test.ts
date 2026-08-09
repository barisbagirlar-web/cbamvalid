import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("sealed report download naming & reporting year (Enterprise 1000 mandate)", () => {
  const handler = source("functions/src/handlers/reports.ts");
  const page = source("app/(workspace)/cbam/reports/[reportId]/page.tsx");

  it("resolves the V5 main dossier download name for the pdf format", () => {
    expect(handler).toContain("resolveDownloadName(");
    expect(handler).toContain('if (format !== "pdf") return target.downloadName;');
    expect(handler).toContain('report.packageMetadata?.schemaVersion === "CBAMVALID-DOSSIER-5.0"');
    expect(handler).toContain('"CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf"');
  });

  it("uses the resolved download name for signed URLs and download descriptors", () => {
    expect(handler).toContain('const downloadName = resolveDownloadName(report, format);');
    expect(handler).toContain('responseDisposition: `attachment; filename="${downloadName}"`');
    expect(handler).toContain('return { url, fileName: downloadName, sha256: entry.sha256, sizeBytes: entry.sizeBytes, status: "success" };');
  });

  it("persists and renders the real reporting year instead of the ruleset prefix", () => {
    const seal = source("functions/src/cbam/report/seal-service.ts");
    expect(seal).toContain("reportingYear: year,");
    const contract = source("functions/src/cbam/report/report-contract.ts");
    expect(contract).toContain("reportingYear: z.number().int().min(2020).max(2099).optional()");
    expect(page).toContain("report.reportingYear ?? report.calculation.ruleset.match(/\\d{4}$/)?.[0]");
    expect(page).not.toContain("report.calculation.ruleset.substring(0, 4)");
  });

  it("maps the Advanced Downloads pdf card to the actual main dossier storage key", () => {
    expect(page).toContain('item.format === "pdf" ? "dossier.pdf"');
    expect(page).not.toContain('item.format === "pdf" ? "Product Scope Assessment.pdf"');
  });
});
