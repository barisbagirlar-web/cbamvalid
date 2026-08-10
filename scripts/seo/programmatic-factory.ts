import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertRegisteredTemplate } from "./templates";

export type Phase18Config = {
  thresholds: {
    similarityMax: number;
    decisionEscalationDays: number;
    programmaticIndexMinPct: number;
    programmaticEvalDays: number;
    programmaticReviewSampleMin: number;
    programmaticPilotMinPages: number;
    programmaticPilotMaxPages: number;
  };
};

export type EligibilityInput = {
  templateId: string;
  portfolioDecision: string | null;
  growthLoop: string | null;
  structuredDataSource: string | null;
  dataFreshnessEvidence: string | null;
  uniqueQuestionPerPage: boolean;
  uniquenessScorable: boolean;
  pilotPageCount: number;
  pilotObservedDays: number;
  pilotIndexedCount: number;
  pilotImpressions: number | null;
};

export function assertProgrammaticEligibility(input: EligibilityInput, config: Phase18Config): void {
  assertRegisteredTemplate(input.templateId);
  if (input.portfolioDecision !== "INVEST") throw new Error("INV-18.2 eligibility requires a Phase-17 INVEST decision");
  if (input.growthLoop !== "programmatic_longtail") throw new Error("INV-18.2 eligibility requires programmatic_longtail assignment");
  if (!input.structuredDataSource || !input.dataFreshnessEvidence) throw new Error("INV-18.2 eligibility requires structured, refreshable data evidence");
  if (!input.uniqueQuestionPerPage) throw new Error("INV-18.2 eligibility requires a unique user question per page");
  if (!input.uniquenessScorable) throw new Error("INV-18.2 eligibility requires calculable uniqueness");
  if (input.pilotPageCount < config.thresholds.programmaticPilotMinPages || input.pilotPageCount > config.thresholds.programmaticPilotMaxPages) {
    throw new Error("INV-18.2 pilot page count is outside configured bounds");
  }
  if (input.pilotObservedDays < config.thresholds.programmaticEvalDays || input.pilotIndexedCount !== input.pilotPageCount || input.pilotImpressions === null || input.pilotImpressions <= 0) {
    throw new Error("INV-18.2 pilot evidence has not met the configured observation/indexation/impression gate");
  }
}

export function assertNoInvariantExemptions(exemptions: readonly string[]): void {
  if (exemptions.length > 0) throw new Error(`INV-18.3 programmatic batches cannot exempt invariants: ${exemptions.join(",")}`);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("similarity sample cannot be empty");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function assertBatchUniqueness(similarities: readonly number[], similarityMax: number): number {
  const med = median(similarities);
  if (med >= similarityMax) throw new Error("INV-18.6 batch median similarity must remain below config.thresholds.similarityMax");
  return med;
}

export function assertBatchDiscipline(input: {
  batchPageCount: number;
  humanReviewCount: number;
  approvalRecordId: string | null;
  config: Phase18Config;
}): void {
  if (input.batchPageCount <= 0 || input.batchPageCount > input.config.thresholds.programmaticPilotMaxPages) {
    throw new Error("Programmatic batch exceeds the configured page limit");
  }
  if (input.humanReviewCount < input.config.thresholds.programmaticReviewSampleMin) {
    throw new Error("Programmatic batch lacks the configured minimum human review sample");
  }
  if (!input.approvalRecordId) throw new Error("Programmatic publication requires A3 approval record");
}

export type RollbackDryRun = {
  templateId: string;
  batchRoutes: readonly string[];
  revertCommitAvailable: boolean;
  noindexFallbackAvailable: boolean;
  restoresPreBatchRouteSet: boolean;
};

export function assertRollbackDryRun(input: RollbackDryRun): void {
  assertRegisteredTemplate(input.templateId);
  if (input.batchRoutes.length === 0 || !input.revertCommitAvailable || !input.noindexFallbackAvailable || !input.restoresPreBatchRouteSet) {
    throw new Error("INV-18.5 rollback dry-run proof is incomplete");
  }
}

export function evaluateKillSwitch(input: {
  batchAgeDays: number;
  indexedPct: number | null;
  proposalAgeDays: number;
  decisionRecorded: boolean;
  config: Phase18Config;
}) {
  if (input.indexedPct === null) return { status: "SKIP_NO_DATA" as const, escalation: false };
  if (input.batchAgeDays < input.config.thresholds.programmaticEvalDays) return { status: "WAIT_EVALUATION_WINDOW" as const, escalation: false };
  if (input.indexedPct >= input.config.thresholds.programmaticIndexMinPct) return { status: "PASS" as const, escalation: false };
  const escalation = !input.decisionRecorded && input.proposalAgeDays > input.config.thresholds.decisionEscalationDays;
  return { status: "PROPOSE_NOINDEX_REQUIRES_A3" as const, escalation };
}

type PortfolioBoard = { data: { decisions: Array<{ clusterId: string; decision: string }> } };
type GrowthLoops = { data: { assignments: Array<{ clusterId: string; growthLoop: string }> } };

export function currentFactoryState(config: Phase18Config, portfolio: PortfolioBoard, loops: GrowthLoops) {
  const investClusters = new Set(portfolio.data.decisions.filter((row) => row.decision === "INVEST").map((row) => row.clusterId));
  const programmaticClusters = loops.data.assignments.filter((row) => row.growthLoop === "programmatic_longtail" && investClusters.has(row.clusterId));
  return {
    gateIn: programmaticClusters.length > 0 ? "READY_FOR_ELIGIBILITY" as const : "BLOCKED_NO_INVEST_PROGRAMMATIC_CLUSTER" as const,
    eligibleClusterIds: programmaticClusters.map((row) => row.clusterId).sort(),
    activeBatches: [],
    publicationState: "NO_PUBLICATION" as const,
    candidateTemplateIds: ["cn-code-detail-v1"],
    currentKillSwitch: evaluateKillSwitch({ batchAgeDays: 0, indexedPct: null, proposalAgeDays: 0, decisionRecorded: false, config }),
  };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase18Config;
  const portfolio = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/portfolio_board.json"), "utf8")) as PortfolioBoard;
  const loops = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/growth_loops.json"), "utf8")) as GrowthLoops;
  console.log(`SEO_PROGRAMMATIC_RESULT=${JSON.stringify(currentFactoryState(config, portfolio, loops))}`);
}

if (process.argv[1]?.endsWith("programmatic-factory.ts")) main();
