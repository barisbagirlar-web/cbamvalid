import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildConsentModeBootstrapScript, CONSENT_MODE_V2_KEYS } from "../../components/marketing/consent-mode";
import {
  assertIntentEligible,
  classifyExperimentClosure,
  loadCroConfig,
  validateConsentModeV2,
  type ConsentEvidence,
  type CroExperiment,
  type IntentAssessment,
} from "../../scripts/seo/cro-governance";

const config = loadCroConfig();
const state = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/seo/cro_experiments.json"), "utf8"),
) as { data: { experiments: CroExperiment[]; consentValidation: ConsentEvidence; intentAssessments: IntentAssessment[] } };

describe("SEO V6 Phase 14 CRO / Consent Mode v2", () => {
  it("boots Consent Mode v2 default-denied with all four required signals before public hydration", () => {
    const script = buildConsentModeBootstrapScript();
    expect(script).toContain("'consent','default'");
    expect(script).toContain("analytics_storage:'denied'");
    expect(script).toContain("ad_storage:'denied'");
    expect(script).toContain("ad_user_data:'denied'");
    expect(script).toContain("ad_personalization:'denied'");
    for (const key of CONSENT_MODE_V2_KEYS) expect(script).toContain(key);

    const layout = readFileSync(resolve(process.cwd(), "app/(public)/layout.tsx"), "utf8");
    expect(layout).toContain("<ConsentModeBootstrap />");
    expect(layout).toContain("<AnalyticsConsentManager />");
  });

  it("validates the current candidate consent evidence against config", () => {
    const result = validateConsentModeV2(state.data.consentValidation, config, new Date("2026-08-10T10:43:00Z"));
    expect(result.status).toBe("PASS");
  });

  it("applies the seven-dimension intent rubric to the current product conversion page", () => {
    expect(state.data.intentAssessments).toHaveLength(1);
    const assessment = state.data.intentAssessments[0];
    expect(assessment?.route).toBe("/product");
    const total = assertIntentEligible(assessment!.scores, config.thresholds.intentScoreMin);
    expect(total).toBe(44);
    expect(Object.keys(assessment!.evidence)).toEqual(expect.arrayContaining(["N1","N2","N3","N4","N5","N6","N7"]));
  });

  it("keeps experiments stopped without A3 instead of inventing a winner", () => {
    expect(state.data.experiments).toEqual([]);
  });

  it("classifies a short closed experiment as inconclusive using config.croMinWeeks", () => {
    const fixture: CroExperiment = {
      id: "fixture",
      route: "/product",
      status: "retired",
      primaryMetric: "conversion",
      guardrailMetrics: ["bounce"],
      requiredSampleSize: 100,
      mdePct: 10,
      decisionRule: "locked",
      plannedDurationWeeks: config.thresholds.croMinWeeks,
      a3ApprovalId: "A3-FIXTURE",
      lockedAt: "2026-01-01T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-08T00:00:00Z",
      interimAnalysisAt: [],
      variants: [],
    };
    expect(classifyExperimentClosure(fixture, config, config.thresholds.croMinWeeks - 1)).toBe("INCONCLUSIVE");
  });
});