import { describe, expect, it } from "vitest";
import { assertVariantIndexSafety, type CroExperiment } from "../../scripts/seo/cro-governance";

const base: CroExperiment = {
  id: "fixture",
  route: "/product",
  status: "draft",
  primaryMetric: null,
  guardrailMetrics: [],
  requiredSampleSize: null,
  mdePct: null,
  decisionRule: null,
  plannedDurationWeeks: null,
  a3ApprovalId: null,
  lockedAt: null,
  startedAt: null,
  endedAt: null,
  interimAnalysisAt: [],
  variants: [],
};

describe("INV-14.4 experiment variant index ban", () => {
  it("rejects a synthetic indexable experiment variant", () => {
    const exp = { ...base, variants: [{ id:"B", url:"/product?exp=B", indexable:true, inSitemap:false, canonicalToControl:true, botContentParity:true }] };
    expect(() => assertVariantIndexSafety(exp)).toThrow(/INV-14\.4/);
  });

  it("rejects a bot-differentiated variant even when noindex", () => {
    const exp = { ...base, variants: [{ id:"B", url:"/product?exp=B", indexable:false, inSitemap:false, canonicalToControl:true, botContentParity:false }] };
    expect(() => assertVariantIndexSafety(exp)).toThrow(/INV-14\.4/);
  });
});