import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type SreConfig = {
  site: { siteId: string };
  thresholds: {
    lcpP75Ms: number;
    inpP75Ms: number;
    clsP75: number;
    cohortIndexWarnPct: number;
    organicValueDropWarnPct: number;
    deployFreezeConsecutiveBreaches: number;
    alarmReopenCalibrationCount: number;
    evidenceSloMaxAgeDays: number;
    killEvaluationDays: number;
    killRefreshAttempts: number;
    killDecisionMaxDays: number;
    decisionEscalationDays: number;
  };
};

export type SloStatus = "PASS" | "BREACH" | "SKIP_NO_DATA";
export type SloRow = {
  slo: "cwv-p75" | "cohort-indexation" | "discovery-lag" | "organic-value" | "evidence-freshness";
  measured: unknown;
  thresholdRef: string;
  status: SloStatus;
  ts: string;
  reason: string;
};

export type KillCandidate = {
  assetId: string;
  ageDays: number | null;
  conversions: number | null;
  tasPartial: boolean | null;
  failedRefreshAttempts: number | null;
  triggerAgeDays: number | null;
  portfolioDecision: "INVEST" | "HOLD" | "HARVEST" | "DIVEST" | null;
};

export type SreInputs = {
  cwv: { lcpP75Ms: number; inpP75Ms: number; clsP75: number } | null;
  cohortIndexPct: number | null;
  discoveryLagHours: number | null;
  organicValueDropPct: number | null;
  latestConformanceAt: string | null;
  latestPnlAt: string | null;
  consecutiveBreachCount: number;
  freezeProposalAgeDays: number | null;
  freezeDecisionRecorded: boolean;
  alarmReopenCount: number;
  killCandidates: KillCandidate[];
};

function ageDays(now: Date, timestamp: string | null): number | null {
  if (!timestamp) return null;
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, (now.getTime() - value) / 86_400_000);
}

function row(
  slo: SloRow["slo"],
  measured: unknown,
  thresholdRef: string,
  status: SloStatus,
  ts: string,
  reason: string,
): SloRow {
  return { slo, measured, thresholdRef, status, ts, reason };
}

export function evaluateSre(config: SreConfig, inputs: SreInputs, now = new Date()) {
  const ts = now.toISOString();
  const rows: SloRow[] = [];

  if (!inputs.cwv) {
    rows.push(row("cwv-p75", null, "thresholds.lcpP75Ms|inpP75Ms|clsP75", "SKIP_NO_DATA", ts, "Field CWV p75 data unavailable."));
  } else {
    const breached =
      inputs.cwv.lcpP75Ms > config.thresholds.lcpP75Ms ||
      inputs.cwv.inpP75Ms > config.thresholds.inpP75Ms ||
      inputs.cwv.clsP75 > config.thresholds.clsP75;
    rows.push(row("cwv-p75", inputs.cwv, "thresholds.lcpP75Ms|inpP75Ms|clsP75", breached ? "BREACH" : "PASS", ts, breached ? "At least one field CWV p75 exceeds config." : "Field CWV p75 is within config."));
  }

  if (inputs.cohortIndexPct === null) {
    rows.push(row("cohort-indexation", null, "thresholds.cohortIndexWarnPct", "SKIP_NO_DATA", ts, "GSC cohort indexation data unavailable."));
  } else {
    const breached = inputs.cohortIndexPct < config.thresholds.cohortIndexWarnPct;
    rows.push(row("cohort-indexation", inputs.cohortIndexPct, "thresholds.cohortIndexWarnPct", breached ? "BREACH" : "PASS", ts, breached ? "Cohort indexation is below config." : "Cohort indexation meets config."));
  }

  rows.push(
    inputs.discoveryLagHours === null
      ? row("discovery-lag", null, "INV-8.2:observational", "SKIP_NO_DATA", ts, "Discovery timestamps unavailable; no lag is invented.")
      : row("discovery-lag", inputs.discoveryLagHours, "INV-8.2:observational", "PASS", ts, "Discovery lag recorded as an observational SLO; no unsupported breach threshold is invented."),
  );

  if (inputs.organicValueDropPct === null) {
    rows.push(row("organic-value", null, "thresholds.organicValueDropWarnPct", "SKIP_NO_DATA", ts, "Governed organic-value series unavailable."));
  } else {
    const breached = inputs.organicValueDropPct > config.thresholds.organicValueDropWarnPct;
    rows.push(row("organic-value", inputs.organicValueDropPct, "thresholds.organicValueDropWarnPct", breached ? "BREACH" : "PASS", ts, breached ? "Organic value decline exceeds config." : "Organic value decline is within config."));
  }

  const conformanceAgeDays = ageDays(now, inputs.latestConformanceAt);
  const pnlAgeDays = ageDays(now, inputs.latestPnlAt);
  const evidenceMissing = conformanceAgeDays === null || pnlAgeDays === null;
  const evidenceBreached =
    evidenceMissing ||
    (conformanceAgeDays as number) > config.thresholds.evidenceSloMaxAgeDays ||
    (pnlAgeDays as number) > config.thresholds.evidenceSloMaxAgeDays;
  rows.push(
    row(
      "evidence-freshness",
      { conformanceAgeDays, pnlAgeDays },
      "thresholds.evidenceSloMaxAgeDays",
      evidenceBreached ? "BREACH" : "PASS",
      ts,
      evidenceBreached ? "Conformance/P&L evidence is missing or stale." : "Conformance and P&L evidence are fresh.",
    ),
  );

  const breaches = rows.filter((item) => item.status === "BREACH");
  const nextConsecutiveBreaches = breaches.length > 0 ? inputs.consecutiveBreachCount + 1 : 0;
  const freezeProposalRequired = nextConsecutiveBreaches >= config.thresholds.deployFreezeConsecutiveBreaches;
  const freezeEscalation =
    freezeProposalRequired &&
    !inputs.freezeDecisionRecorded &&
    inputs.freezeProposalAgeDays !== null &&
    inputs.freezeProposalAgeDays > config.thresholds.decisionEscalationDays;
  const alarmCalibrationRequired = inputs.alarmReopenCount >= config.thresholds.alarmReopenCalibrationCount;

  const killQueue = inputs.killCandidates.flatMap((candidate) => {
    const triggered =
      candidate.ageDays !== null &&
      candidate.ageDays >= config.thresholds.killEvaluationDays &&
      candidate.conversions === 0 &&
      candidate.tasPartial === true &&
      candidate.failedRefreshAttempts !== null &&
      candidate.failedRefreshAttempts >= config.thresholds.killRefreshAttempts;
    if (!triggered) return [];
    const decisionSatisfied = candidate.portfolioDecision !== null && candidate.portfolioDecision !== "INVEST";
    const overdue =
      !decisionSatisfied &&
      candidate.triggerAgeDays !== null &&
      candidate.triggerAgeDays > config.thresholds.killDecisionMaxDays;
    return [{
      assetId: candidate.assetId,
      status: decisionSatisfied ? "RESOLVED" : overdue ? "BLOCK" : "OPEN",
      decision: candidate.portfolioDecision,
      thresholdRefs: ["thresholds.killEvaluationDays", "thresholds.killRefreshAttempts", "thresholds.killDecisionMaxDays"],
    }];
  });

  return {
    siteId: config.site.siteId,
    checkedAt: ts,
    slos: rows,
    breachCount: breaches.length,
    issueRequired: breaches.length > 0,
    issueTitle: breaches.length > 0 ? `[SEO SRE] ${config.site.siteId} SLO breach` : null,
    issueBody: breaches.length > 0
      ? [
          `SEO SRE detected ${breaches.length} governed SLO breach(es) at ${ts}.`,
          ...breaches.map((item) => `- ${item.slo}: ${item.reason} (${item.thresholdRef})`),
          freezeProposalRequired ? "- Deploy-freeze proposal required; A3 decision must be recorded before execution." : "",
          "No deploy, merge, redirect, noindex or portfolio action is executed by this monitor.",
        ].filter(Boolean).join("\n")
      : null,
    nextConsecutiveBreaches,
    freezeProposalRequired,
    freezeEscalation,
    alarmFatigue: { reopenCount: inputs.alarmReopenCount, calibrationRequired: alarmCalibrationRequired },
    killQueue,
    killQueueBlockCount: killQueue.filter((item) => item.status === "BLOCK").length,
    status: killQueue.some((item) => item.status === "BLOCK") ? "BLOCK" : breaches.length > 0 ? "BREACH" : "PASS",
  };
}

export function assertBreachHasIssue(result: ReturnType<typeof evaluateSre>, issueUrl: string | null): void {
  if (result.issueRequired && !issueUrl) throw new Error("INV-12.1 SLO breach has no issue link");
}

export function assertKillQueueDecisionDeadline(result: ReturnType<typeof evaluateSre>): void {
  if (result.killQueueBlockCount > 0) throw new Error("INV-12.5 kill-triggered asset exceeded the portfolio decision deadline");
}

function readGeneratedAt(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { meta?: { generatedAt?: string } };
    return parsed.meta?.generatedAt ?? null;
  } catch {
    return null;
  }
}

function loadCurrentInputs(): SreInputs {
  const pnlPath = resolve(process.cwd(), "data/seo/pnl.json");
  const conformancePath = resolve(process.cwd(), "data/seo/invariant-results/faz-11.json");
  return {
    cwv: null,
    cohortIndexPct: null,
    discoveryLagHours: null,
    organicValueDropPct: null,
    latestConformanceAt: readGeneratedAt(conformancePath),
    latestPnlAt: readGeneratedAt(pnlPath),
    consecutiveBreachCount: 0,
    freezeProposalAgeDays: null,
    freezeDecisionRecorded: false,
    alarmReopenCount: 0,
    killCandidates: [],
  };
}

function main() {
  const siteIndex = process.argv.indexOf("--site");
  const siteId = siteIndex >= 0 ? process.argv[siteIndex + 1] : "cbamvalid";
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), `sites/${siteId}/seo.config.json`), "utf8"),
  ) as SreConfig;
  const result = evaluateSre(config, loadCurrentInputs());
  const outIndex = process.argv.indexOf("--out");
  if (outIndex >= 0 && process.argv[outIndex + 1]) {
    writeFileSync(resolve(process.cwd(), process.argv[outIndex + 1]), `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(`SEO_SLO_RESULT=${JSON.stringify(result)}`);
  if (result.killQueueBlockCount > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("seo-slo-check.ts")) main();
