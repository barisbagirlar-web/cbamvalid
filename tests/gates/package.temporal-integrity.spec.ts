/**
 * G-09 — temporal integrity and test-artifact leak gate. D-08.
 *
 * Fail-closed: a signature/review timestamp after generatedAt blocks the
 * package (SIGNATURE_TIMESTAMP_INVALID). Findings: evidence files below 20 KB
 * raise EVIDENCE_SUSPICIOUSLY_SMALL; dates outside the reporting period ± 24
 * months raise DATE_OUTSIDE_REPORTING_WINDOW. Forbidden strings are scanned
 * across the rendered Master Record.
 *
 * Evidence: scan report under artifacts/gates/G-09/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTemporalIntegrity } from "../../functions/src/cbam/report/v6/temporal-integrity";
import { scanForbiddenStrings, scanComponentsForbiddenStrings } from "../../functions/src/cbam/report/v6/forbidden-strings";
import { buildV6Package, masterRecordPdfText } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-09");

describe("G-09 package.temporal-integrity", () => {
  it("accepts a temporally consistent package", async () => {
    const built = await buildV6Package("CEMENT_EG");
    const result = checkTemporalIntegrity(built.caseData, built.masterRecordModel.controlKey.generatedAt);
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it("blocks the package when a sign-off timestamp is later than generatedAt", async () => {
    const built = await buildV6Package("CEMENT_EG");
    built.caseData.operatorSignOffs[0] = {
      ...built.caseData.operatorSignOffs[0]!,
      signedAt: "2027-02-02T00:00:00.000Z",
    };
    const result = checkTemporalIntegrity(built.caseData, "2027-01-31T00:00:00.000Z");
    expect(result.errors.some((error) => error.includes("SIGNATURE_TIMESTAMP_INVALID"))).toBe(true);
  });

  it("flags suspiciously small evidence files below 20 KB", async () => {
    const built = await buildV6Package("ALU_CN");
    built.caseData.evidenceRegister[0] = { ...built.caseData.evidenceRegister[0]!, sizeBytes: 2000 };
    const result = checkTemporalIntegrity(built.caseData, built.masterRecordModel.controlKey.generatedAt);
    expect(result.smallEvidence.length).toBe(1);
    expect(result.findings.some((finding) => finding.includes("EVIDENCE_SUSPICIOUSLY_SMALL"))).toBe(true);
  });

  it("never lets forbidden strings leak into the rendered Master Record", async () => {
    const built = await buildV6Package("STEEL_IN");
    const { text, bytes } = await masterRecordPdfText(built.masterRecordModel);
    expect(scanForbiddenStrings(text)).toEqual([]);
    const leak = scanComponentsForbiddenStrings([
      { path: "Enterprise Compliance Master Record.pdf", text },
      { path: "Calculation Trace.json", text: JSON.stringify(built.calculation) },
      { path: "Data Integrity Manifest.json", text: JSON.stringify(built.masterRecordModel.controlKey) },
    ]);
    expect(leak).toEqual([]);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "scan-report.json"),
      JSON.stringify(
        {
          renderedMasterRecordBytes: bytes.byteLength,
          scannedComponents: ["Enterprise Compliance Master Record.pdf", "Calculation Trace.json", "Data Integrity Manifest.json"],
          forbiddenMatches: leak,
          scannedAt: built.masterRecordModel.controlKey.generatedAt,
        },
        null,
        2
      )
    );
  });
});
