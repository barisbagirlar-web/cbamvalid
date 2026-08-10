import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RegistryRecord = {
  route: string;
  status: string;
  primaryQueryClusterId: string | null;
  primaryEntity: string;
  searchIntent: string;
  ownerRoute: string | null;
  impressions28d: number | null;
  clicks28d: number | null;
  conversions28d: number | null;
  conversionValueMinor: number | null;
  productionCostMinor: number | null;
  portfolioDecision: string | null;
};

export type KacConfig = {
  site: { siteId: string; maxConcurrentKacActions: number };
  thresholds: { similarityMax: number; divestPendingMaxDays: number };
  economics: { paybackMaxMonths: number };
  measurement: { dataWindowStart: string };
};

export type ClusterOwner = {
  clusterId: string;
  ownerRoute: string | null;
  primaryEntity: string;
  searchIntent: string;
};

export type PriorityInputs = {
  expectedExtraClicks: number | null;
  cvr: number | null;
  conversionValueMinor: number | null;
  confidenceMultiplier: number | null;
  effort: number | null;
};

export type PortfolioWrite = {
  decision: "INVEST" | "HOLD" | "HARVEST" | "DIVEST";
  decisionRecordId: string | null;
  writerPhase: string;
};

export type StrikingDistanceEntry = {
  clusterId: string;
  gapType: "POSITION" | "CTR" | null;
};

export type PaybackInputs = {
  recommendation: "INVEST" | "HOLD" | "HARVEST" | "DIVEST" | null;
  productionCostMinor: number | null;
  monthlyExpectedValueMinor: number | null;
};

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildClusterMap(records: readonly RegistryRecord[]): ClusterOwner[] {
  const ownership = new Map<string, ClusterOwner>();
  for (const record of records) {
    if (record.status !== "live" || !record.primaryQueryClusterId) continue;
    const next: ClusterOwner = {
      clusterId: record.primaryQueryClusterId,
      ownerRoute: record.ownerRoute,
      primaryEntity: record.primaryEntity,
      searchIntent: record.searchIntent,
    };
    const existing = ownership.get(next.clusterId);
    if (existing && existing.ownerRoute !== next.ownerRoute) {
      throw new Error(`INV-11.1 multiple owners for ${next.clusterId}: ${existing.ownerRoute ?? "null"} vs ${next.ownerRoute ?? "null"}`);
    }
    ownership.set(next.clusterId, existing ?? next);
  }
  return [...ownership.values()].sort((a, b) => a.clusterId.localeCompare(b.clusterId));
}

export function assertCtrSourceAllowed(source: string | null): void {
  if (source === null || source === "site_gsc") return;
  throw new Error(`INV-11.2 prohibited CTR source: ${source}`);
}

export function assertOwnerCandidateSimilarity(
  candidateText: string,
  existingOwnerTexts: readonly string[],
  similarityMax: number,
): void {
  const maxObserved = existingOwnerTexts.reduce(
    (max, existing) => Math.max(max, jaccardSimilarity(candidateText, existing)),
    0,
  );
  if (maxObserved > similarityMax) {
    throw new Error(`INV-11.3 owner similarity ${maxObserved} exceeds config threshold ${similarityMax}`);
  }
}

export function assertPortfolioWriteAllowed(write: PortfolioWrite): void {
  if (!write.decisionRecordId) {
    throw new Error("INV-11.4 portfolio decision requires KARAR_DEFTERI evidence");
  }
  if (write.writerPhase !== "faz-01") {
    throw new Error("INV-11.4 registry portfolio decision writes are Phase-01 single-writer operations");
  }
}

export function scorePriority(inputs: PriorityInputs): { partial: boolean; score: number | null } {
  const required = [
    inputs.expectedExtraClicks,
    inputs.cvr,
    inputs.conversionValueMinor,
    inputs.confidenceMultiplier,
    inputs.effort,
  ];
  if (required.some((value) => value === null)) return { partial: true, score: null };
  if (inputs.effort === null || inputs.effort <= 0) throw new Error("KAC effort must be positive");
  if (inputs.confidenceMultiplier === null || inputs.confidenceMultiplier <= 0 || inputs.confidenceMultiplier > 1) {
    throw new Error("KAC confidence multiplier must be in (0,1]");
  }
  return {
    partial: false,
    score:
      (inputs.expectedExtraClicks as number) *
      (inputs.cvr as number) *
      (inputs.conversionValueMinor as number) *
      (inputs.confidenceMultiplier as number) /
      inputs.effort,
  };
}

export function assertRecommendationAllowed(
  recommendation: "INVEST" | "HOLD" | "HARVEST" | "DIVEST" | null,
  partial: boolean,
): void {
  if (partial && recommendation === "INVEST") {
    throw new Error("INV-11.6 partial cluster cannot receive INVEST recommendation");
  }
}

export function assertInvestPaybackAllowed(inputs: PaybackInputs, paybackMaxMonths: number): number | null {
  if (inputs.recommendation !== "INVEST") return null;
  if (inputs.productionCostMinor === null || inputs.monthlyExpectedValueMinor === null) {
    throw new Error("KAC INVEST payback is partial because cost/value evidence is missing");
  }
  if (!Number.isSafeInteger(inputs.productionCostMinor) || inputs.productionCostMinor < 0) {
    throw new Error("KAC production cost must be a non-negative integer minor-unit value");
  }
  if (!Number.isSafeInteger(inputs.monthlyExpectedValueMinor) || inputs.monthlyExpectedValueMinor <= 0) {
    throw new Error("KAC monthly expected value must be a positive integer minor-unit value");
  }
  const paybackMonths = inputs.productionCostMinor / inputs.monthlyExpectedValueMinor;
  if (paybackMonths > paybackMaxMonths) {
    throw new Error(`KAC INVEST payback ${paybackMonths} exceeds config economics.paybackMaxMonths=${paybackMaxMonths}`);
  }
  return paybackMonths;
}

export function assertStrikingDistanceClassified(entry: StrikingDistanceEntry): void {
  if (!entry.gapType) {
    throw new Error(`INV-11.7 striking-distance entry ${entry.clusterId} must classify POSITION vs CTR gap`);
  }
}

export function assertDivestPendingAge(ageDays: number, divestPendingMaxDays: number): "PASS" | "WARN" {
  return ageDays > divestPendingMaxDays ? "WARN" : "PASS";
}

export function buildKacState(config: KacConfig, records: readonly RegistryRecord[]) {
  const clusterMap = buildClusterMap(records);
  const clusters = clusterMap.map((cluster) => {
    const score = scorePriority({
      expectedExtraClicks: null,
      cvr: null,
      conversionValueMinor: null,
      confidenceMultiplier: null,
      effort: null,
    });
    assertRecommendationAllowed(null, score.partial);
    return {
      ...cluster,
      partial: score.partial,
      priorityScore: score.score,
      nineState: null,
      strikingDistance: null,
      portfolioRecommendation: null,
      measurementStatus: "SKIP_NO_DATA" as const,
    };
  });

  return {
    siteId: config.site.siteId,
    dataWindowStart: config.measurement.dataWindowStart,
    clusterCount: clusters.length,
    clusters,
    ctrModel: {
      source: null,
      status: "SKIP_NO_DATA" as const,
      reason: "No connected first-party GSC position/CTR series; industry CTR fallback is prohibited.",
    },
    nineStateDistribution: { SKIP_NO_DATA: clusters.length },
    priorityQueue: [] as string[],
    maxConcurrentActions: config.site.maxConcurrentKacActions,
    priorityFormula:
      "expectedExtraClicks × cvr × conversionValueMinor × confidenceMultiplier ÷ effort",
    paybackRule: "productionCostMinor ÷ monthlyExpectedValueMinor <= economics.paybackMaxMonths",
    partial: true,
    confidence: "low" as const,
    portfolioWriteState: "READ_ONLY_NO_DECISION" as const,
  };
}

function main() {
  const config = loadJson<KacConfig>("sites/cbamvalid/seo.config.json");
  const registry = loadJson<{ data: { records: RegistryRecord[] } }>(
    "data/seo/registry/cbamvalid_seo_registry.json",
  );
  const state = buildKacState(config, registry.data.records);
  if (state.priorityQueue.length > state.maxConcurrentActions) {
    throw new Error("KAC priority queue exceeds config.site.maxConcurrentKacActions");
  }
  console.log(`SEO_KAC_RESULT=${JSON.stringify(state)}`);
}

if (process.argv[1]?.endsWith("kac-prioritize.ts")) main();
