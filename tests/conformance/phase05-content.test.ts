import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runContentGovernance } from "../../scripts/seo/content-governance-v6";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA" | "WARN";
  negativeTestPassed?: boolean;
};

describe("SEO V6 Phase 05 content risk firewall", () => {
  it("passes all blocking controls on the actual content/data plan", () => {
    const result = runContentGovernance(new Date("2026-08-09T21:45:00.000Z"));
    expect(result.blocks).toEqual([]);
    expect(result.stats.managedAssets).toBe(9);
    expect(result.stats.dataAssets).toBe(5);
    expect(result.stats.similarityPairsChecked).toBeGreaterThan(0);
    expect(result.stats.maxSimilarity).toBeLessThanOrEqual(0.7);
    expect(result.stats.staleAssets).toBe(0);
  });

  it("surfaces missing expert-review evidence without inventing reviewers", () => {
    const result = runContentGovernance(new Date("2026-08-09T21:45:00.000Z"));
    expect(result.stats.expertReviewGaps).toBe(5);
    expect(result.warnings.filter((warning) => warning.includes("INV-5.4"))).toHaveLength(5);
  });

  it("keeps every Phase-05 BLOCK result backed by a passing negative fixture", () => {
    const artifact = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/seo/invariant-results/faz-05.json"), "utf8"),
    ) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((row) => row.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });
});
