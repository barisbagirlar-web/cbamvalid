import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PortfolioDecision = "INVEST" | "HOLD" | "HARVEST" | "DIVEST";
export type BudgetSplit = { investPct: number; holdPct: number; harvestPct: number; divestPct: number };

export type Phase17Config = {
  site: { siteId: string; currency: string };
  economics: { budgetSplit: BudgetSplit; paybackMaxMonths: number };
  thresholds: { concentrationWarnPct: number; portfolioMinHistoryMonths: number; paybackCalibrationDays: number };
};

export function assertMinorUnit(value: number | null, field: string): void {
  if (value === null) return;
  if (!Number.isSafeInteger(value)) throw new Error(`${field} must be integer minor-unit money`);
}

export function assertConcentrationPlan(input: { concentrationPct: number; thresholdPct: number; diversificationPlan: string | null }): void {
  if (input.concentrationPct > input.thresholdPct && !input.diversificationPlan) {
    throw new Error("INV-17.1 concentration threshold breached without diversification plan");
  }
}

export type DivestExecution = {
  successorOr410Recorded: boolean;
  internalLinkCleanupPr: boolean;
  executionApproved: boolean;
  monitoringAndPnlClosureRecorded: boolean;
};

export function assertFourStepDivest(execution: DivestExecution): void {
  if (!execution.successorOr410Recorded || !execution.internalLinkCleanupPr || !execution.executionApproved || !execution.monitoringAndPnlClosureRecorded) {
    throw new Error("INV-17.2 DIVEST requires the complete four-step execution chain");
  }
}

export function assertBudgetDeviationApproval(input: { configured: BudgetSplit; proposed: BudgetSplit; approvalRecordId: string | null }): void {
  const keys: Array<keyof BudgetSplit> = ["investPct", "holdPct", "harvestPct", "divestPct"];
  const changed = keys.some((key) => input.configured[key] !== input.proposed[key]);
  if (changed && !input.approvalRecordId) {
    throw new Error("INV-17.3 any budget split deviation requires an A3 approval record before execution");
  }
}

export function assertPortfolioDecisionChain(input: {
  decision: PortfolioDecision;
  pnlHistoryMonths: number;
  minHistoryMonths: number;
  kacRecommendation: string | null;
  killQueueEvaluated: boolean;
  approvalRecordId: string | null;
}): void {
  if (input.pnlHistoryMonths < input.minHistoryMonths) throw new Error("INV-17.4 portfolio decision blocked: insufficient P&L history");
  if (!input.kacRecommendation) throw new Error("INV-17.4 portfolio decision blocked: missing KAC recommendation");
  if (!input.killQueueEvaluated) throw new Error("INV-17.4 portfolio decision blocked: kill queue not evaluated");
  if (!input.approvalRecordId) throw new Error("INV-17.4 portfolio decision blocked: missing A3 approval record");
}

export function paybackCalibration(input: {
  projectedMonths: number | null;
  actualMonths: number | null;
  observedDays: number;
  requiredDays: number;
}) {
  if (input.projectedMonths === null || input.actualMonths === null) return { status: "SKIP_NO_DATA" as const, deviationPct: null };
  if (input.observedDays < input.requiredDays) return { status: "WAIT_OBSERVATION_WINDOW" as const, deviationPct: null };
  if (input.projectedMonths <= 0 || input.actualMonths < 0) throw new Error("Payback months must be non-negative and projectedMonths must be positive");
  const deviationPct = Math.abs(input.actualMonths - input.projectedMonths) / input.projectedMonths * 100;
  return { status: deviationPct > 50 ? "WARN_CALIBRATION_REQUIRED" as const : "PASS" as const, deviationPct };
}

export function assertNoHarvestInvestment(input: { decision: PortfolioDecision; newInvestmentRequested: boolean }): void {
  if (input.decision === "HARVEST" && input.newInvestmentRequested) {
    throw new Error("HARVEST pages are maintenance-only and cannot receive new investment");
  }
}

type PnlArtifact = { data: { directRevenueMinor: number | null; assistedRevenueMinor: number | null; productionCostMinor: number | null; toolingCostMinor: number | null; status: string } };
type KacState = { data: { clusters: Array<{ clusterId: string; portfolioRecommendation: string | null }>; priorityQueue: unknown[] } };
type SloHistory = { data: { killQueue: unknown[] } };

export function buildCurrentPortfolioState(config: Phase17Config, pnl: PnlArtifact, kac: KacState, slo: SloHistory) {
  assertMinorUnit(pnl.data.directRevenueMinor, "directRevenueMinor");
  assertMinorUnit(pnl.data.assistedRevenueMinor, "assistedRevenueMinor");
  assertMinorUnit(pnl.data.productionCostMinor, "productionCostMinor");
  assertMinorUnit(pnl.data.toolingCostMinor, "toolingCostMinor");

  const pnlHistoryMonths = 0;
  const recommendations = kac.data.clusters.filter((row) => row.portfolioRecommendation !== null);
  const gatePass = pnlHistoryMonths >= config.thresholds.portfolioMinHistoryMonths && recommendations.length > 0;

  return {
    siteId: config.site.siteId,
    currency: config.site.currency,
    pnlHistoryMonths,
    requiredPnlHistoryMonths: config.thresholds.portfolioMinHistoryMonths,
    pnlStatus: pnl.data.status,
    kacRecommendationCount: recommendations.length,
    killQueueCount: slo.data.killQueue.length,
    decisionGate: gatePass ? "READY_FOR_A3_REVIEW" as const : "SKIP_NO_DATA" as const,
    decisions: [] as Array<{ clusterId: string; decision: PortfolioDecision }>,
    budgetExecution: null,
    concentrationPct: null,
    diversificationPlan: null,
    paybackCalibration: paybackCalibration({ projectedMonths: null, actualMonths: null, observedDays: 0, requiredDays: config.thresholds.paybackCalibrationDays }),
    harvestInvestmentFindings: [] as string[],
  };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase17Config;
  const pnl = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/pnl.json"), "utf8")) as PnlArtifact;
  const kac = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/kac/state.json"), "utf8")) as KacState;
  const slo = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/slo_history.json"), "utf8")) as SloHistory;
  console.log(`SEO_PORTFOLIO_RESULT=${JSON.stringify(buildCurrentPortfolioState(config, pnl, kac, slo))}`);
}

if (process.argv[1]?.endsWith("portfolio-governance.ts")) main();
