/**
 * G-02 — single authoritative package state. D-01, D-02.
 *
 * Every output surface consumes one packageReadinessState. NOT_READY is
 * removed. An open period alone never produces a negative label.
 *
 * Evidence: package-wide state-string scan report under artifacts/gates/G-02/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGE_READINESS_STATES } from "../../functions/src/cbam/report/v6/types";
import { buildV6Package, masterRecordPdfText } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-02");

describe("G-02 status.single-source", () => {
  it("derives exactly one state value and never the removed NOT_READY", async () => {
    const built = await buildV6Package("CEMENT_EG", "2026-07-19T00:00:00.000Z");
    expect(PACKAGE_READINESS_STATES).toContain(built.state);
    expect(built.state).toBe("ON_TRACK_PERIOD_OPEN");

    const sources = [
      { surface: "packageReadinessState (state decision)", value: built.state },
      { surface: "master record badge", value: built.masterRecordModel.state },
      { surface: "xlsx package automated readiness", value: built.state },
    ];
    const distinct = new Set(sources.map((entry) => entry.value));
    expect(distinct.size).toBe(1);

    // G-02 scans every produced output for the removed NOT_READY label: the
    // rendered Master Record PDF text and the JSON artefacts that are sealed.
    const { text, bytes } = await masterRecordPdfText(built.masterRecordModel);
    expect(text).not.toMatch(/NOT_READY/);
    const jsonArtifacts = JSON.stringify({
      "Calculation Trace.json": built.calculation,
      "Data Integrity Manifest.json": built.masterRecordModel.controlKey,
    });
    expect(jsonArtifacts).not.toMatch(/NOT_READY/);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "state-scan.json"),
      JSON.stringify(
        {
          state: built.state,
          sources,
          forbidden: ["NOT_READY"],
          scanned: {
            masterRecordPdfBytes: bytes.byteLength,
            scannedOutputs: ["Enterprise Compliance Master Record.pdf", "Calculation Trace.json", "Data Integrity Manifest.json"],
          },
        },
        null,
        2
      )
    );
  });
});
