/**
 * G-04 — hash architecture: unique naming and explainability. D-03.
 *
 * Multiple root hashes may coexist, but each is named and scoped in the Hash
 * Architecture table. A formula hash under the same name must be identical in
 * the Calculation Trace and the Calculation Graph.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHashArchitecture } from "../../functions/src/cbam/report/v6/hash-architecture";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-04");

describe("G-04 hash.architecture", () => {
  it("reports no inconsistency when trace and graph agree under the same formula name", async () => {
    const built = await buildV6Package("STEEL_IN");
    const traceHashes = built.calculation.trace.map((item) => ({ formulaId: item.formulaId, hash: item.calculationHash }));
    const graphHashes = traceHashes.map((item) => ({ ...item }));
    const { rows, inconsistencies } = buildHashArchitecture({
      calculationRootHash: built.calculation.calculationRootHash,
      graphRootHash: built.calculation.calculationRootHash,
      legalSourceRegistryHash: built.model.ruleset.sourceHash,
      traceCalculationHashes: traceHashes,
      graphNodeHashes: graphHashes,
    });
    expect(inconsistencies).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const names = new Set(rows.map((row) => row.hashName));
    expect(names.size).toBe(rows.length);
    for (const row of rows) {
      expect(row.covers.trim().length).toBeGreaterThan(0);
      expect(row.notCovered.trim().length).toBeGreaterThan(0);
      expect(row.reproduction.trim().length).toBeGreaterThan(0);
    }
    const masterRecordRows = built.masterRecordModel.hashArchitecture;
    expect(masterRecordRows.some((row) => row.hashName === "manifestHash")).toBe(true);
    expect(masterRecordRows.some((row) => row.hashName === "calculationRootHash")).toBe(true);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "hash-architecture.json"),
      JSON.stringify(
        {
          rows,
          inconsistencies,
          masterRecordTableRows: masterRecordRows,
          reproducedHash: built.calculation.calculationRootHash,
        },
        null,
        2
      )
    );
  });

  it("flags a formula whose trace hash differs from its graph hash under the same name", async () => {
    const built = await buildV6Package("CEMENT_EG");
    const traceHashes = built.calculation.trace.map((item) => ({ formulaId: item.formulaId, hash: item.calculationHash }));
    const graphHashes = traceHashes.map((item, index) => ({
      formulaId: item.formulaId,
      hash: index === 0 ? "d".repeat(64) : item.hash,
    }));
    const { inconsistencies } = buildHashArchitecture({
      calculationRootHash: built.calculation.calculationRootHash,
      legalSourceRegistryHash: built.model.ruleset.sourceHash,
      traceCalculationHashes: traceHashes,
      graphNodeHashes: graphHashes,
    });
    expect(inconsistencies.length).toBe(1);
    expect(inconsistencies[0]).toContain(traceHashes[0]!.formulaId);
  });
});
