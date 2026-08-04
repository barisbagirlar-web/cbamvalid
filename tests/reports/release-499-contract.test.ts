import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const contract = fs.readFileSync(
  path.join(root, "docs/release/499_USD_RELEASE_CONTRACT.md"),
  "utf8"
);
const benchmark = JSON.parse(
  fs.readFileSync(path.join(root, "docs/release/499-value-benchmark.json"), "utf8")
) as {
  blendedProfessionalRateUsdPerHour: number;
  minimumEquivalentHours: number;
  minimumEquivalentValueUsd: number;
  calculatedEquivalentHours: number;
  calculatedEquivalentValueUsd: number;
  tasks: Array<{ manualEquivalentHours: number; requiredOutputs: string[] }>;
};
const premiumChapter = fs.readFileSync(
  path.join(root, "functions/src/cbam/report/premium-chapter-contract.ts"),
  "utf8"
);
const pdfRenderer = fs.readFileSync(
  path.join(root, "functions/src/cbam/report/premium-dossier-pdf-impl.ts"),
  "utf8"
);
const releaseGuard = fs.readFileSync(
  path.join(root, "scripts/guard-499-usd-release.ts"),
  "utf8"
);

const gateIds = [
  "G01_INTERNAL_CONSISTENCY",
  "G02_RECOMPUTATION",
  "G03_EVIDENCE",
  "G04_VERIFIER_BOUNDARY",
  "G05_LEGAL_SOURCE",
  "G06_PACKAGE_INTEGRITY",
  "G07_USABILITY",
  "G08_OUTPUT_QUALITY",
  "G09_COMMERCIAL_VALUE",
  "G10_P0",
] as const;

describe("frozen USD 499 release contract", () => {
  it("contains exactly the ten frozen gate identifiers", () => {
    for (const id of gateIds) {
      expect(contract).toContain(id);
      expect(releaseGuard).toContain(id);
    }
    expect(new Set(gateIds).size).toBe(10);
    expect(contract).toContain("Status: **FROZEN**");
    expect(contract).toContain("A PR-head artifact cannot be substituted for the merge-commit artifact");
  });

  it("locks the conservative commercial value above USD 2,500", () => {
    const summedHours = benchmark.tasks.reduce(
      (sum, task) => sum + task.manualEquivalentHours,
      0
    );
    expect(summedHours).toBe(benchmark.calculatedEquivalentHours);
    expect(summedHours).toBeGreaterThanOrEqual(benchmark.minimumEquivalentHours);
    expect(
      summedHours * benchmark.blendedProfessionalRateUsdPerHour
    ).toBe(benchmark.calculatedEquivalentValueUsd);
    expect(benchmark.calculatedEquivalentValueUsd).toBeGreaterThanOrEqual(
      benchmark.minimumEquivalentValueUsd
    );
    expect(benchmark.minimumEquivalentValueUsd).toBe(2500);
  });

  it("removes the misleading submission-readiness chapter name", () => {
    expect(premiumChapter).toContain("Registry Field-Mapping Completeness");
    expect(premiumChapter).not.toContain("Registry Submission Readiness");
  });

  it("pins the previous report contradictions as release failures", () => {
    expect(pdfRenderer).toContain('"Sealing critical blockers"');
    expect(pdfRenderer).toContain('"Reporting-period restrictions"');
    expect(pdfRenderer).toContain('"Evidence period coverage"');
    expect(pdfRenderer).toContain('row.status === "PENDING_VERIFIER"');
    expect(pdfRenderer).toContain('"Verifier action pending"');
    expect(releaseGuard).toContain("pending verifier displayed as Passed");
    expect(releaseGuard).toContain("Future Reporting Period End Date");
    expect(releaseGuard).toContain("Registry Submission Readiness heading present");
  });

  it("requires artifact-bound provenance before release-ready can be true", () => {
    for (const required of [
      "sourceCommitSha",
      "contractSha256",
      "pdfSha256",
      "zipSha256",
      "manifestSha256",
      "releaseP0DefectCount",
      "releaseReady",
    ]) {
      expect(releaseGuard).toContain(required);
    }
  });
});
