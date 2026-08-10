import { describe, expect, it } from "vitest";
import { resolveV6Phase } from "../../scripts/seo/resolve-v6-phase.mjs";

describe("SEO V6 workflow phase routing", () => {
  it("keeps a normal feature PR in global conformance without inventing a phase", () => {
    expect(resolveV6Phase({ eventName: "pull_request", headRef: "feat/cbamvalid-6.0-audit" })).toEqual({
      phase: "",
      phaseScoped: false,
    });
  });

  it("maps bootstrap and numbered SEO branches to their exact phase", () => {
    expect(resolveV6Phase({ eventName: "pull_request", headRef: "seo/bootstrap-routing-fix" })).toEqual({
      phase: "bootstrap",
      phaseScoped: true,
    });
    expect(resolveV6Phase({ eventName: "pull_request", headRef: "seo/faz-19-valuation-dd" })).toEqual({
      phase: "faz-19",
      phaseScoped: true,
    });
  });

  it("fails closed for malformed or out-of-range SEO branches", () => {
    expect(() => resolveV6Phase({ eventName: "pull_request", headRef: "seo/faz-99-invalid" })).toThrow(/Invalid V6 phase/);
    expect(() => resolveV6Phase({ eventName: "pull_request", headRef: "seo/not-a-phase" })).toThrow(/Malformed V6 SEO branch/);
  });

  it("requires an explicit valid phase for manual dispatch", () => {
    expect(resolveV6Phase({ eventName: "workflow_dispatch", dispatchPhase: "faz-07" })).toEqual({
      phase: "faz-07",
      phaseScoped: true,
    });
    expect(() => resolveV6Phase({ eventName: "workflow_dispatch", dispatchPhase: "" })).toThrow(/Invalid V6 phase/);
  });
});
