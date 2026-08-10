import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type GrowthLoop = "content_compounding" | "tool_virality" | "ugc_loop" | "programmatic_longtail";

export type Phase16Config = {
  site: { siteId: string; industry: string };
  business: { revenueModel: string };
  thresholds: {
    growthCoverageNewPct: number;
    growthCoverageStrengthenPct: number;
    contentLoopObservationDays: number;
    toolLoopObservationDays: number;
    ugcLoopObservationDays: number;
    lcpP75Ms: number;
    inpP75Ms: number;
    clsP75: number;
  };
};

export type TamCell = {
  cellId: string;
  vertical: string;
  intent: string;
  geography: string;
  evidenceIds: readonly string[];
};

export function assertTamEvidence(cells: readonly TamCell[]): void {
  if (cells.length === 0) throw new Error("INV-16.1 TAM map requires at least one evidence-backed cell");
  for (const cell of cells) {
    if (!cell.cellId || !cell.vertical || !cell.intent || !cell.geography || cell.evidenceIds.length === 0) {
      throw new Error(`INV-16.1 TAM evidence missing for ${cell.cellId || "unknown-cell"}`);
    }
  }
}

export function buildCoverage(input: {
  knownClusterIds: readonly string[];
  ownedClusterIds: readonly string[];
  marketUniverseComplete: boolean;
  totalMarketClusterCount: number | null;
  thresholds: Pick<Phase16Config["thresholds"], "growthCoverageNewPct" | "growthCoverageStrengthenPct">;
}) {
  const known = new Set(input.knownClusterIds);
  const owned = new Set(input.ownedClusterIds.filter((id) => known.has(id)));
  const knownInventoryCoveragePct = known.size === 0 ? null : (owned.size / known.size) * 100;

  if (!input.marketUniverseComplete || input.totalMarketClusterCount === null) {
    return {
      knownInventoryCoveragePct,
      marketCoveragePct: null,
      marketCoverageBand: "SKIP_NO_DATA" as const,
      denominatorDefinition: "market query-cluster universe incomplete",
    };
  }
  if (!Number.isInteger(input.totalMarketClusterCount) || input.totalMarketClusterCount <= 0) {
    throw new Error("INV-16.2 complete market universe requires a positive integer denominator");
  }
  const marketCoveragePct = (owned.size / input.totalMarketClusterCount) * 100;
  const marketCoverageBand = marketCoveragePct < input.thresholds.growthCoverageNewPct
    ? "NEW_CLUSTER"
    : marketCoveragePct <= input.thresholds.growthCoverageStrengthenPct
      ? "STRENGTHEN_OWNER"
      : "NEW_VERTICAL_OR_GEOGRAPHY";
  return { knownInventoryCoveragePct, marketCoveragePct, marketCoverageBand, denominatorDefinition: "evidence-backed market query-cluster universe" };
}

export function assertUgcModeration(input: { loop: GrowthLoop; moderationScript: string | null }): void {
  if (input.loop === "ugc_loop" && !input.moderationScript) {
    throw new Error("INV-16.3 UGC growth loop requires a moderation script before assignment");
  }
}

export function assertProgrammaticGate(input: { loop: GrowthLoop; phase18EligibilityPassed: boolean }): void {
  if (input.loop === "programmatic_longtail" && !input.phase18EligibilityPassed) {
    throw new Error("Phase 16 programmatic_longtail assignment is blocked until the Phase 18 eligibility gate passes");
  }
}

export function assertAdsCwvBudget(input: {
  revenueModel: string;
  lcpP75Ms: number | null;
  inpP75Ms: number | null;
  clsP75: number | null;
  thresholds: Pick<Phase16Config["thresholds"], "lcpP75Ms" | "inpP75Ms" | "clsP75">;
}): void {
  if (input.revenueModel !== "ads" && input.revenueModel !== "mixed") return;
  if (input.lcpP75Ms === null || input.inpP75Ms === null || input.clsP75 === null) {
    throw new Error("INV-16.4 ads revenue requires CWV field evidence before growth investment");
  }
  if (input.lcpP75Ms > input.thresholds.lcpP75Ms || input.inpP75Ms > input.thresholds.inpP75Ms || input.clsP75 > input.thresholds.clsP75) {
    throw new Error("INV-16.4 ads revenue CWV budget breached");
  }
}

export function requiredObservationDays(loop: GrowthLoop, thresholds: Pick<Phase16Config["thresholds"], "contentLoopObservationDays" | "toolLoopObservationDays" | "ugcLoopObservationDays">): number | null {
  if (loop === "content_compounding") return thresholds.contentLoopObservationDays;
  if (loop === "tool_virality") return thresholds.toolLoopObservationDays;
  if (loop === "ugc_loop") return thresholds.ugcLoopObservationDays;
  return null;
}

export function observationStatus(input: { loop: GrowthLoop; observedDays: number; thresholds: Phase16Config["thresholds"] }): "PASS" | "WARN_OBSERVATION_WINDOW" | "NOT_APPLICABLE" {
  const required = requiredObservationDays(input.loop, input.thresholds);
  if (required === null) return "NOT_APPLICABLE";
  return input.observedDays >= required ? "PASS" : "WARN_OBSERVATION_WINDOW";
}

export function auditAffiliateDisclosure(input: { revenueModel: string; disclosureVisible: boolean; relSponsored: boolean }) {
  if (input.revenueModel !== "affiliate" && input.revenueModel !== "mixed") return { status: "SKIP_NOT_ACTIVE" as const };
  return { status: input.disclosureVisible && input.relSponsored ? "PASS" as const : "WARN_MISSING_DISCLOSURE" as const };
}

type KacState = {
  data: {
    clusterCount: number;
    clusters: Array<{ clusterId: string; ownerRoute: string; measurementStatus: string }>;
  };
};

type Registry = {
  data: {
    records: Array<{ primaryQueryClusterId: string | null; ownerRoute: string | null; linkableAsset: boolean; route: string; type: string }>;
  };
};

export function buildCurrentPhase16State(config: Phase16Config, kac: KacState, registry: Registry) {
  const clusters = [...kac.data.clusters].sort((a, b) => a.clusterId.localeCompare(b.clusterId));
  const knownClusterIds = clusters.map((row) => row.clusterId);
  const ownedClusterIds = clusters.filter((row) => Boolean(row.ownerRoute)).map((row) => row.clusterId);
  const cells: TamCell[] = [
    { cellId: "cbam-global-commercial", vertical: config.site.industry, intent: "commercial", geography: "GLOBAL", evidenceIds: ["phase00-public-proxy", "phase11-governed-cluster-inventory"] },
    { cellId: "cbam-global-informational", vertical: config.site.industry, intent: "informational", geography: "GLOBAL", evidenceIds: ["phase00-public-proxy", "phase11-governed-cluster-inventory"] },
    { cellId: "cbam-global-tool", vertical: config.site.industry, intent: "tool", geography: "GLOBAL", evidenceIds: ["phase00-public-proxy", "phase11-governed-cluster-inventory"] },
  ];
  assertTamEvidence(cells);

  const coverage = buildCoverage({
    knownClusterIds,
    ownedClusterIds,
    marketUniverseComplete: false,
    totalMarketClusterCount: null,
    thresholds: config.thresholds,
  });

  const contentCandidates = registry.data.records
    .filter((row) => row.linkableAsset && row.primaryQueryClusterId)
    .map((row) => ({ clusterId: row.primaryQueryClusterId as string, ownerRoute: row.ownerRoute ?? row.route, proposedLoop: "content_compounding" as const, investmentState: "PROPOSED_ONLY", observedDays: 0, observationStatus: observationStatus({ loop: "content_compounding", observedDays: 0, thresholds: config.thresholds }) }))
    .sort((a, b) => a.clusterId.localeCompare(b.clusterId));

  assertAdsCwvBudget({ revenueModel: config.business.revenueModel, lcpP75Ms: null, inpP75Ms: null, clsP75: null, thresholds: config.thresholds });

  return {
    siteId: config.site.siteId,
    knownClusterCount: kac.data.clusterCount,
    ownedKnownClusterCount: ownedClusterIds.length,
    cells,
    coverage,
    contentCandidates,
    blockedLoops: [
      { loop: "tool_virality" as const, reason: "share metric unavailable" },
      { loop: "ugc_loop" as const, reason: "moderation script not installed" },
      { loop: "programmatic_longtail" as const, reason: "Phase 18 eligibility gate not passed" },
    ],
    revenueModel: config.business.revenueModel,
    affiliateAudit: auditAffiliateDisclosure({ revenueModel: config.business.revenueModel, disclosureVisible: false, relSponsored: false }),
  };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase16Config;
  const kac = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/kac/state.json"), "utf8")) as KacState;
  const registry = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/registry/cbamvalid_seo_registry.json"), "utf8")) as Registry;
  const result = buildCurrentPhase16State(config, kac, registry);
  console.log(`SEO_TAM_GROWTH_RESULT=${JSON.stringify(result)}`);
}

if (process.argv[1]?.endsWith("tam-growth.ts")) main();
