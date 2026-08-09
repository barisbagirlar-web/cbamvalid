import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadRegistryArtifact,
  runRegistryValidation,
  validateArtifactMeta,
  validateDynamicRouteCoverage,
  validateRecordShape,
} from "../../scripts/seo/registry-validate-v6";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA";
  negativeTestPassed?: boolean;
};

describe("SEO V6 Phase 1 registry", () => {
  it("covers the concrete public SEO inventory with no BLOCK violations", () => {
    const result = runRegistryValidation();
    expect(result.blocks).toEqual([]);
    expect(result.stats.recordCount).toBe(result.stats.expectedConcreteRouteCount);
    expect(result.stats.routeGapRatePct).toBe(0);
  });

  it("validates the complete C-01 artifact envelope and provenance", () => {
    const artifact = loadRegistryArtifact();
    expect(validateArtifactMeta(artifact.meta)).toEqual([]);
    expect(artifact.meta.generatorScript).toBe("scripts/seo/registry-validate-v6.ts");
    expect(artifact.meta.partial).toBe(true);
    expect(artifact.meta.coldStart).toBeNull();
  });

  it("classifies every dynamic public route family instead of silently dropping it", () => {
    const artifact = loadRegistryArtifact();
    expect(validateDynamicRouteCoverage(artifact)).toEqual([]);
    expect(artifact.data.dynamicRouteFamilies?.map((item) => item.routePattern).sort()).toEqual([
      "/cn-code/[code]",
      "/verify/[publicToken]",
      "/verify/package/[packageId]",
    ]);
  });

  it("validates fields that previously escaped the Phase-1 shape gate", () => {
    const artifact = loadRegistryArtifact();
    const broken = structuredClone(artifact.data.records[0]);
    broken.costConfidence = "high";
    broken.lastCrawledAt = "2026-08-09";
    broken.portfolioDecision = "INVEST";
    const errors = validateRecordShape(broken, 0);
    expect(errors.some((error) => error.includes("costConfidence requires productionCostMinor"))).toBe(true);
    expect(errors.some((error) => error.includes("invalid lastCrawledAt"))).toBe(true);
    expect(errors.some((error) => error.includes("portfolioDecision must remain null until Phase 17"))).toBe(true);
  });

  it("requires C-02 negativeTestPassed=true for every Phase-01 BLOCK result", () => {
    const path = resolve(process.cwd(), "data/seo/invariant-results/faz-01.json");
    const artifact = JSON.parse(readFileSync(path, "utf8")) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((item) => item.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });

  it("keeps portfolio economics partial while production cost is unavailable", () => {
    const result = runRegistryValidation();
    expect(result.stats.productionCostGapPct).toBe(100);
    expect(result.warnings.some((warning) => warning.startsWith("INV-1.4"))).toBe(true);
  });

  it("has no Phase 18 template concentration in Phase 1", () => {
    const result = runRegistryValidation();
    expect(result.stats.templateConcentrationPct).toBe(0);
  });
});
