import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertProgrammaticGate,
  auditAffiliateDisclosure,
  buildCurrentPhase16State,
  buildCoverage,
  observationStatus,
  type Phase16Config,
} from "../../scripts/seo/tam-growth";

type KacState = Parameters<typeof buildCurrentPhase16State>[1];
type Registry = Parameters<typeof buildCurrentPhase16State>[2];
const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase16Config;
const kac = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/kac/state.json"), "utf8")) as KacState;
const registry = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/registry/cbamvalid_seo_registry.json"), "utf8")) as Registry;

describe("Phase 16 TAM/growth", () => {
  it("reports governed-inventory coverage separately from unknown market TAM", () => {
    const result = buildCurrentPhase16State(config, kac, registry);
    expect(result.knownClusterCount).toBe(36);
    expect(result.ownedKnownClusterCount).toBe(36);
    expect(result.coverage.knownInventoryCoveragePct).toBe(100);
    expect(result.coverage.marketCoveragePct).toBeNull();
    expect(result.coverage.marketCoverageBand).toBe("SKIP_NO_DATA");
  });

  it("requires a valid denominator before market coverage classification", () => {
    expect(() => buildCoverage({
      knownClusterIds: ["a"],
      ownedClusterIds: ["a"],
      marketUniverseComplete: true,
      totalMarketClusterCount: 0,
      thresholds: config.thresholds,
    })).toThrow(/INV-16\.2/);
  });

  it("blocks programmatic loop before Phase 18 eligibility", () => {
    expect(() => assertProgrammaticGate({ loop: "programmatic_longtail", phase18EligibilityPassed: false })).toThrow(/Phase 18 eligibility/);
  });

  it("uses config observation windows", () => {
    expect(observationStatus({ loop: "content_compounding", observedDays: config.thresholds.contentLoopObservationDays - 1, thresholds: config.thresholds })).toBe("WARN_OBSERVATION_WINDOW");
    expect(observationStatus({ loop: "content_compounding", observedDays: config.thresholds.contentLoopObservationDays, thresholds: config.thresholds })).toBe("PASS");
  });

  it("keeps affiliate audit inactive for current revenue model", () => {
    expect(auditAffiliateDisclosure({ revenueModel: config.business.revenueModel, disclosureVisible: false, relSponsored: false }).status).toBe("SKIP_NOT_ACTIVE");
  });
});
