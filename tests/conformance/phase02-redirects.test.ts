import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLedgerArtifact, runStaticValidation } from "../../scripts/seo/redirect-audit-v6";
import { runVariantAudit } from "../../scripts/seo/redirect-variant-audit-v6";

type InvariantResult = {
  id: string;
  severity: "BLOCK" | "WARN" | "INFO";
  status: "PASS" | "FAIL" | "SKIP_NO_DATA";
  negativeTestPassed?: boolean;
};

describe("SEO V6 Phase 02 host/canonical contract", () => {
  it("passes the actual redirect ledger, chain and HSTS contract", async () => {
    const result = await runStaticValidation();
    expect(result.blocks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.stats.ruleCount).toBe(3);
    expect(result.stats.capacityBasisPoints).toBe(15);
  });

  it("passes the duplicate URL variant inventory audit", () => {
    expect(runVariantAudit()).toEqual([]);
  });

  it("keeps every Phase-02 BLOCK invariant backed by a passing negative fixture", () => {
    const artifact = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/seo/invariant-results/faz-02.json"), "utf8"),
    ) as { data: { results: InvariantResult[] } };
    for (const result of artifact.data.results.filter((row) => row.severity === "BLOCK")) {
      expect(result.status, result.id).toBe("PASS");
      expect(result.negativeTestPassed, result.id).toBe(true);
    }
  });

  it("records non-code edge controls explicitly instead of pretending repository ownership", () => {
    const artifact = parseLedgerArtifact(
      JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/redirects.json"), "utf8")) as unknown,
    );
    expect(artifact.data.externalControls.length).toBeGreaterThan(0);
    expect(artifact.data.externalControls.every((control) => control.repositoryMutable === false)).toBe(true);
    expect(artifact.data.externalControls.every((control) => control.codeScopeStatus === "EXCLUDED_NON_CODE")).toBe(true);
  });
});
