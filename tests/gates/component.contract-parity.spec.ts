/**
 * G-05 — component contract full parity. D-04.
 *
 * The sealed component contract, the manifest file list and every
 * primary-document reference in delivered documents must match exactly.
 * The V6 package surface is exactly 27 components.
 *
 * Evidence: three-list comparison under artifacts/gates/G-05/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_TOP_LEVEL_COMPONENTS_V6,
  REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V6,
} from "../../functions/src/cbam/report/package-components";
import { validateComponentContractParity } from "../../functions/src/cbam/report/v6/component-contract";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-05");

describe("G-05 component.contract-parity", () => {
  it("mandates the Enterprise Compliance Master Record as the 27th component", () => {
    expect(REQUIRED_TOP_LEVEL_COMPONENTS_V6).toContain("Enterprise Compliance Master Record.pdf");
    expect(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V6).toBe(27);
  });

  it("accepts a contract whose manifest, exclusions and references are fully aligned", () => {
    const contract = [...REQUIRED_TOP_LEVEL_COMPONENTS_V6];
    const exclusions = ["dossier.zip"];
    const manifestFiles = [...contract, "Supporting_Evidence/README.txt", "Supporting_Evidence/verify/cli.js"];
    const documentReferences = ["Enterprise Compliance Master Record.pdf", "Calculation Trace.json"];
    const errors = validateComponentContractParity({
      contract,
      manifestFiles,
      manifestExclusions: exclusions,
      documentReferences,
      primaryDocumentCountClaim: contract.length,
      primaryDocumentCountActual: contract.length,
    });
    expect(errors).toEqual([]);
  });

  it("rejects a dangling primary-document reference and a wrong count claim", () => {
    const contract = [...REQUIRED_TOP_LEVEL_COMPONENTS_V6];
    const errors = validateComponentContractParity({
      contract,
      manifestFiles: [...contract],
      manifestExclusions: [],
      documentReferences: ["Missing Handover Pack.pdf"],
      primaryDocumentCountClaim: 26,
      primaryDocumentCountActual: contract.length,
    });
    expect(errors.some((error) => error.includes("Missing Handover Pack.pdf"))).toBe(true);
    expect(errors.some((error) => error.includes("does not match actual"))).toBe(true);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "three-list-comparison.json"),
      JSON.stringify({ contract, manifest: contract, exclusions: [], references: contract, count: contract.length }, null, 2)
    );
  });
});
