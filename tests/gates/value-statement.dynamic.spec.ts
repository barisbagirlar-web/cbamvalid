/**
 * G-12 — dynamic value statement. D-11, INV-04.
 *
 * Section B2 of the Enterprise Compliance Master Record is produced at
 * runtime. Every number is derived from the sealed registers; no hard-coded
 * count may appear. Two structurally different cases must produce different
 * B2 statements, and each metric must equal the corresponding register count.
 *
 * Evidence: the two B2 statements side by side under artifacts/gates/G-12/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistryTemplateMapping } from "../../functions/src/cbam/registry/registry-template-mapping";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-12");

describe("G-12 value-statement.dynamic", () => {
  it("derives every B2 metric at runtime and varies across two different cases", async () => {
    const steel = await buildV6Package("STEEL_IN");
    const alu = await buildV6Package("ALU_CN");

    const steelStatement = steel.masterRecordModel.valueStatement;
    const aluStatement = alu.masterRecordModel.valueStatement;

    expect(steelStatement.length).toBe(aluStatement.length);
    expect(JSON.stringify(steelStatement)).not.toBe(JSON.stringify(aluStatement));

    const rowsByMetric = new Map(steelStatement.map((row) => [row.metric, row.value]));
    const registryMapped = rowsByMetric.get("Registry fields mapped with legal basis, source path, owner and evidence lineage")!;
    const steelMapping = buildRegistryTemplateMapping(steel.caseData);
    const aluMapping = buildRegistryTemplateMapping(alu.caseData);
    expect(Number(registryMapped)).toBe(steelMapping.length);

    const byMetric = (rows: typeof steelStatement, metric: string) => Number(rows.find((row) => row.metric === metric)?.value);

    expect(byMetric(steelStatement, "Evidence documents graded, hashed and classified for independent verifiability")).toBe(steel.caseData.evidenceRegister.length);
    expect(byMetric(aluStatement, "Evidence documents graded, hashed and classified for independent verifiability")).toBe(alu.caseData.evidenceRegister.length);
    expect(byMetric(steelStatement, "Calculation nodes sealed with formula ID, input set, unit and hash")).toBe(steel.calculation.trace.length);
    expect(byMetric(steelStatement, "Methodology decisions recorded with rationale and legal basis")).toBe(steel.caseData.methodologyDecisions.length);

    // The two cases genuinely differ: different evidence and goods populations.
    expect(alu.caseData.evidenceRegister.length).not.toBe(steel.caseData.evidenceRegister.length);
    expect(aluMapping.length).not.toBe(steelMapping.length);
    expect(byMetric(steelStatement, "Registry fields mapped with legal basis, source path, owner and evidence lineage")).not.toBe(
      byMetric(aluStatement, "Registry fields mapped with legal basis, source path, owner and evidence lineage")
    );

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "two-cases-b2.json"),
      JSON.stringify({ caseA: { key: steel.key, valueStatement: steelStatement }, caseB: { key: alu.key, valueStatement: aluStatement } }, null, 2)
    );
  });
});
