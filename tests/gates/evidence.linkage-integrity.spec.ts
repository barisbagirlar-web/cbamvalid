/**
 * G-07 — evidence linkage integrity. D-06.
 *
 * A link is allowed only to a field inside the evidence's declared
 * supportedFields, and to a calculation node only when the evidence supports
 * one of that node's inputs. Every link carries a supportType. Cartesian
 * linkage is forbidden.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateEvidenceLinkage,
  type EvidenceLink,
  type EvidenceLinkageInputs,
} from "../../functions/src/cbam/report/v6/evidence-linkage";
import { buildRegistryTemplateMapping } from "../../functions/src/cbam/registry/registry-template-mapping";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-07");

describe("G-07 evidence.linkage-integrity", () => {
  it("accepts only meaningful links inside supportedFields with a supportType", () => {
    const links: EvidenceLink[] = [
      { evidenceId: "E-1", linkedField: "electricityConsumed", supportType: "DIRECTLY_EVIDENCES" },
      { evidenceId: "E-2", linkedField: "goods.0.productionVolume", supportType: "DIRECTLY_EVIDENCES" },
    ];
    const inputs: EvidenceLinkageInputs = {
      links,
      supportedFieldsByEvidence: {
        "E-1": ["electricityConsumed", "gridEmissionFactor"],
        "E-2": ["goods.0.productionVolume", "goods.0.allocationShare"],
      },
      calculationNodes: [{ nodeId: "N-1", inputPaths: ["electricityConsumed", "gridEmissionFactor"] }],
    };
    expect(validateEvidenceLinkage(inputs)).toEqual([]);
  });

  it("rejects a link outside supportedFields (D-06 cartesian look)", () => {
    const errors = validateEvidenceLinkage({
      links: [{ evidenceId: "E-CUSTOMS", linkedField: "directEmissions", supportType: "DIRECTLY_EVIDENCES" }],
      supportedFieldsByEvidence: { "E-CUSTOMS": ["importerIdentity.eoriNumber", "goods.0.cnCode"] },
      calculationNodes: [{ nodeId: "N-DIRECT", inputPaths: ["directEmissions"] }],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("outside its supportedFields");
  });

  it("rejects a missing supportType and linkage that exceeds supported fields", () => {
    const errors = validateEvidenceLinkage({
      links: [
        { evidenceId: "E-3", linkedField: "directEmissions" },
        { evidenceId: "E-4", linkedField: "a.b", supportType: "DIRECTLY_EVIDENCES" },
      ],
      supportedFieldsByEvidence: { "E-3": ["directEmissions"], "E-4": ["x"] },
    });
    expect(errors.some((error) => error.includes("has no supportType"))).toBe(true);
  });

  it("rejects a calculation-node link when the evidence supports no node input", () => {
    const errors = validateEvidenceLinkage({
      links: [{ evidenceId: "E-5", linkedField: "N-TOTAL", supportType: "DIRECTLY_EVIDENCES" }],
      supportedFieldsByEvidence: { "E-5": ["productionVolume"] },
      calculationNodes: [{ nodeId: "N-TOTAL", inputPaths: ["directEmissions"] }],
    });
    expect(errors.some((error) => error.includes("without supporting one of its inputs"))).toBe(true);
  });

  it("sealed field-to-evidence links stay far below the cartesian upper bound", async () => {
    const built = await buildV6Package("STEEL_IN");
    const mapping = buildRegistryTemplateMapping(built.caseData);
    const evidenceById = new Map(built.caseData.evidenceRegister.map((record) => [record.evidenceId, record]));
    const stripValueSuffix = (path: string) => path.replace(/\.value$/, "");
    const eligibleFields = mapping.filter(
      (field) => field.owner !== "INDEPENDENT_VERIFIER" && !field.sourcePath.startsWith("N/A")
    );

    const cartesianUpperBound = built.caseData.evidenceRegister.length * eligibleFields.length;
    let actualPairs = 0;
    let meaningfulPairs = 0;
    for (const field of eligibleFields) {
      for (const evidenceId of field.evidenceIds) {
        actualPairs += 1;
        const evidence = evidenceById.get(evidenceId);
        if (evidence && evidence.linkedInputs.includes(stripValueSuffix(field.sourcePath))) {
          meaningfulPairs += 1;
        }
      }
    }
    const unmeaningfulPairs = actualPairs - meaningfulPairs;

    expect(actualPairs).toBeLessThan(cartesianUpperBound / 2);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "linkage-comparison.json"),
      JSON.stringify(
        {
          evidenceCount: built.caseData.evidenceRegister.length,
          eligibleFieldCount: eligibleFields.length,
          cartesianUpperBound,
          actualFieldEvidencePairs: actualPairs,
          meaningfulPairs,
          unmeaningfulPairs,
          reductionRatio: Number((actualPairs / cartesianUpperBound).toFixed(4)),
        },
        null,
        2
      )
    );
  });
});
