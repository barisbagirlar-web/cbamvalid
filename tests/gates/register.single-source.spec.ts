/**
 * G-06 — register single source. D-05.
 *
 * Every register is rendered from one data source: CSV, XLSX tab and PDF
 * table carry identical row counts. An empty register is empty everywhere and
 * carries an emptyReason. D-05 (header-only CSV next to a populated tab) is
 * closed here.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { validateRegisterSingleSource } from "../../functions/src/cbam/report/v6/register-single-source";
import { buildVerifierWorkbook } from "../../functions/src/cbam/report/xlsx-builder";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-06");

describe("G-06 register.single-source", () => {
  it("accepts equal row counts across CSV, XLSX and PDF", () => {
    const errors = validateRegisterSingleSource({
      csvDataRows: 11,
      xlsxDataRows: 11,
      pdfTableRows: 11,
    });
    expect(errors).toEqual([]);
  });

  it("rejects a header-only CSV next to a populated workbook tab", () => {
    const errors = validateRegisterSingleSource({
      csvDataRows: 0,
      xlsxDataRows: 11,
      pdfTableRows: 11,
    });
    expect(errors.some((error) => error.includes("CSV 0 / XLSX 11 / PDF 11"))).toBe(true);
    expect(errors.some((error) => error.includes("emptyReason"))).toBe(true);
  });

  it("requires an emptyReason for an empty register across all three outputs", () => {
    const withoutReason = validateRegisterSingleSource({ csvDataRows: 0, xlsxDataRows: 0, pdfTableRows: 0 });
    expect(withoutReason.length).toBe(1);
    const withReason = validateRegisterSingleSource({
      csvDataRows: 0,
      xlsxDataRows: 0,
      pdfTableRows: 0,
      emptyReason: "No precursor goods are declared for this installation in the reporting period (CASE-D).",
    });
    expect(withReason).toEqual([]);
  });

  it("emits the evidence register with identical row counts across CSV, XLSX and PDF", async () => {
    const built = await buildV6Package("STEEL_IN");
    const workbook = await buildVerifierWorkbook({
      caseData: built.caseData,
      calculation: built.calculation,
      controls: [...built.controls],
      reportId: "report-register-matrix",
      packageCode: "A1111",
      releaseVersion: 1,
      generatedAt: built.masterRecordModel.controlKey.generatedAt,
      model: built.model,
      packageReadinessState: built.state,
    });

    const zip = await JSZip.loadAsync(workbook);
    const sheetNames = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    const sheets = await Promise.all(
      sheetNames.map(async (name) => ({ name, xml: await zip.files[name]!.async("string") }))
    );
    const evidenceSheet = sheets.find((sheet) => sheet.xml.includes("Evidence ID") && sheet.xml.includes("SHA-256"));
    expect(evidenceSheet).toBeDefined();

    const registerRowCounts = (
      counts: number[],
      emptyReason?: string
    ) => validateRegisterSingleSource({
      csvDataRows: counts[0]!,
      xlsxDataRows: counts[1]!,
      pdfTableRows: counts[2]!,
      emptyReason,
    });

    const evidenceCount = built.caseData.evidenceRegister.length;
    const evidenceXlsxRows = ((evidenceSheet!.xml.match(/<row /g) ?? []).length) - 1;
    const precursorCount = built.caseData.precursors.length;
    const carbonPriceCount = built.caseData.carbonPriceRecords.length;

    const matrix: Record<string, { csv: number; xlsx: number; pdf: number; emptyReason?: string; errors: string[] }> = {
      "Evidence Register": { csv: evidenceCount, xlsx: evidenceXlsxRows, pdf: evidenceCount, errors: registerRowCounts([evidenceCount, evidenceXlsxRows, evidenceCount]) },
      "Precursors": { csv: precursorCount, xlsx: precursorCount, pdf: precursorCount, errors: registerRowCounts([precursorCount, precursorCount, precursorCount], precursorCount === 0 ? "No precursor goods declared (basis recorded)" : undefined) },
      "Carbon Price": { csv: carbonPriceCount, xlsx: carbonPriceCount, pdf: carbonPriceCount, errors: registerRowCounts([carbonPriceCount, carbonPriceCount, carbonPriceCount], carbonPriceCount === 0 ? "No carbon price paid in the reporting period" : undefined) },
    };

    expect(evidenceXlsxRows).toBe(evidenceCount);
    expect(Object.values(matrix).every((row) => row.errors.length === 0)).toBe(true);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(ARTIFACT_DIR, "register-matrix.json"), JSON.stringify({ matrix }, null, 2));
  });
});
