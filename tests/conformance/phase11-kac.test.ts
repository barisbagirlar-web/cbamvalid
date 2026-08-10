import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDivestPendingAge,
  assertStrikingDistanceClassified,
  buildKacState,
  type KacConfig,
  type RegistryRecord,
} from "../../scripts/seo/kac-prioritize";

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as KacConfig;
const registry = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/seo/registry/cbamvalid_seo_registry.json"), "utf8"),
) as { data: { records: RegistryRecord[] } };

describe("SEO V6 Phase 11 KAC state", () => {
  it("builds one deterministic owner per current primary cluster without inventing metrics", () => {
    const state = buildKacState(config, registry.data.records);
    expect(state.clusterCount).toBeGreaterThan(0);
    expect(new Set(state.clusters.map((item) => item.clusterId)).size).toBe(state.clusterCount);
    expect(state.clusters.every((item) => item.partial)).toBe(true);
    expect(state.clusters.every((item) => item.priorityScore === null)).toBe(true);
    expect(state.clusters.every((item) => item.portfolioRecommendation === null)).toBe(true);
    expect(state.ctrModel.status).toBe("SKIP_NO_DATA");
    expect(state.priorityQueue.length).toBeLessThanOrEqual(config.site.maxConcurrentKacActions);
    console.log(`SEO_KAC_STATE=${JSON.stringify(state)}`);
  });

  it("requires striking-distance rows to distinguish position from CTR gaps", () => {
    expect(() => assertStrikingDistanceClassified({ clusterId: "fixture", gapType: "POSITION" })).not.toThrow();
    expect(() => assertStrikingDistanceClassified({ clusterId: "fixture", gapType: "CTR" })).not.toThrow();
    expect(() => assertStrikingDistanceClassified({ clusterId: "fixture", gapType: null })).toThrow(/INV-11\.7/);
  });

  it("uses the configured DIVEST pending threshold", () => {
    expect(assertDivestPendingAge(config.thresholds.divestPendingMaxDays, config.thresholds.divestPendingMaxDays)).toBe("PASS");
    expect(assertDivestPendingAge(config.thresholds.divestPendingMaxDays + 1, config.thresholds.divestPendingMaxDays)).toBe("WARN");
  });
});