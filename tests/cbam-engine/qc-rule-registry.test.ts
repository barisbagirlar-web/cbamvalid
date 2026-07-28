import { describe, expect, it } from "vitest";
import {
  getQcRuleFamilyCount,
  isRegisteredQcFamily,
  QC_RULE_REGISTRY,
} from "../../lib/cbam/validation/qc-rule-registry";
import { HOMEPAGE_STATS } from "../../lib/marketing/homepage-stats";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";

describe("QC rule registry SSOT", () => {
  it("exposes a stable family count derived from the registry", () => {
    expect(getQcRuleFamilyCount()).toBe(QC_RULE_REGISTRY.length);
    expect(getQcRuleFamilyCount()).toBeGreaterThan(0);
    expect(HOMEPAGE_STATS.qcChecks).toBe(getQcRuleFamilyCount());
  });

  it("recognizes runtime rule ids produced by runQualityControls", () => {
    const results = runQualityControls(createVerifierGradeCase());
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(isRegisteredQcFamily(result.ruleId)).toBe(true);
    }
  });
});

describe("homepage stats SSOT", () => {
  it("pins dossier pages and workflow stages to product sources", () => {
    expect(HOMEPAGE_STATS.dossierPages).toBe(16);
    expect(HOMEPAGE_STATS.workflowStages).toBe(8);
    expect(HOMEPAGE_STATS.exportFormats).toBe(3);
  });
});
