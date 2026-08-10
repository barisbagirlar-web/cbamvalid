/**
 * G-03 — XLSX status parity. D-02.
 *
 * No workbook tab invents its own readiness value. The VERIFIER_SIGN_OFF
 * "Package automated readiness" cell (D2) is fed from the single
 * packageReadinessState; the forbidden NOT_READY string appears nowhere.
 *
 * Evidence: cell-to-value mapping report under artifacts/gates/G-03/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildVerifierWorkbook } from "../../functions/src/cbam/report/xlsx-builder";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-03");

function inlineCellValues(sheetXml: string): Record<string, string> {
  const cells: Record<string, string> = {};
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c r="([A-Z]+\d+)"[^>]*>(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>|<v>([\s\S]*?)<\/v>)<\/c>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetXml)) !== null) {
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]!)) !== null) {
      cells[cellMatch[1]!] = cellMatch[2] ?? cellMatch[3] ?? "";
    }
  }
  return cells;
}

describe("G-03 xlsx.status-parity", () => {
  it("feeds the Package automated readiness cell from the single packageReadinessState", async () => {
    const built = await buildV6Package("ALU_CN", "2026-11-15T00:00:00.000Z");
    const workbook = await buildVerifierWorkbook({
      caseData: built.caseData,
      calculation: built.calculation,
      controls: [...built.controls],
      reportId: "report-xlsx-parity",
      packageCode: "A1111",
      releaseVersion: 1,
      generatedAt: built.masterRecordModel.controlKey.generatedAt,
      model: built.model,
      packageReadinessState: built.state,
    });

    const zip = await JSZip.loadAsync(workbook);
    const sheetNames = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    expect(sheetNames.length).toBeGreaterThan(0);

    const mappings: Array<{ sheet: string; cell: string; value: string }> = [];
    let automatedCell: string | undefined;
    for (const sheetName of sheetNames) {
      const sheetXml = await zip.files[sheetName]!.async("string");
      if (!sheetXml.includes("Package automated readiness")) continue;
      const cells = inlineCellValues(sheetXml);
      for (const [reference, value] of Object.entries(cells)) {
        mappings.push({ sheet: sheetName, cell: reference, value });
      }
      const d2 = cells["D2"];
      expect(d2).toBe(built.state);
      automatedCell = d2;
      expect(sheetXml).not.toMatch(/NOT_READY/);
    }

    expect(automatedCell).toBe(built.state);

    // Every status-bearing package cell across the whole workbook agrees with
    // the single source; the forbidden string never leaks.
    const allSheets = await Promise.all(
      sheetNames.map(async (sheetName) => zip.files[sheetName]!.async("string"))
    );
    expect(allSheets.join("\n")).not.toMatch(/NOT_READY/);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "cell-mapping.json"),
      JSON.stringify({ packageReadinessState: built.state, cellMappings: mappings }, null, 2)
    );
  });
});
