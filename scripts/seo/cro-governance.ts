import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type CroConfig = {
  thresholds: {
    intentScoreMin: number;
    croMinWeeks: number;
    consentTrackingRequired: boolean;
    consentValidationMaxAgeDays: number;
  };
};

export type IntentScores = {
  N1: number;
  N2: number;
  N3: number;
  N4: number;
  N5: number;
  N6: number;
  N7: number;
};

export type ExperimentVariant = {
  id: string;
  url: string;
  indexable: boolean;
  inSitemap: boolean;
  canonicalToControl: boolean;
  botContentParity: boolean;
};

export type CroExperiment = {
  id: string;
  route: string;
  status: "draft" | "approved" | "running" | "retired" | "invalid" | "inconclusive";
  primaryMetric: string | null;
  guardrailMetrics: string[];
  requiredSampleSize: number | null;
  mdePct: number | null;
  decisionRule: string | null;
  plannedDurationWeeks: number | null;
  a3ApprovalId: string | null;
  lockedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  interimAnalysisAt: string[];
  variants: ExperimentVariant[];
};

export type ConsentEvidence = {
  validatedAt: string | null;
  defaultDenied: boolean;
  defaultKeys: string[];
  updateKeys: string[];
  publicChoiceManager: boolean;
  structuralBreakRecorded: boolean;
};

const REQUIRED_CONSENT_KEYS = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
] as const;

function assertRubricRange(scores: IntentScores): void {
  for (const [key, value] of Object.entries(scores)) {
    if (!Number.isInteger(value) || value < 1 || value > 7) {
      throw new Error(`Invalid intent score ${key}=${value}; each N-score must be an integer 1..7`);
    }
  }
}

export function totalIntentScore(scores: IntentScores): number {
  assertRubricRange(scores);
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}

export function assertIntentEligible(scores: IntentScores, intentScoreMin: number): number {
  const total = totalIntentScore(scores);
  const gate = intentScoreMin * 7;
  if (total <= gate) {
    throw new Error(`INV-14.1 CRO blocked: intent score ${total} <= config gate ${gate}`);
  }
  return total;
}

export function assertExperimentLocked(experiment: CroExperiment, config: CroConfig): void {
  const startable = experiment.status === "approved" || experiment.status === "running";
  if (!startable) return;
  if (!experiment.primaryMetric?.trim()) throw new Error("INV-14.2 experiment primary metric is not locked");
  if (experiment.guardrailMetrics.length === 0) throw new Error("INV-14.2 experiment guardrails are not locked");
  if (!Number.isInteger(experiment.requiredSampleSize) || (experiment.requiredSampleSize ?? 0) <= 0) {
    throw new Error("INV-14.2 experiment required sample size is not locked");
  }
  if (experiment.mdePct === null || !Number.isFinite(experiment.mdePct) || experiment.mdePct <= 0) {
    throw new Error("INV-14.2 experiment MDE is not locked");
  }
  if (!experiment.decisionRule?.trim()) throw new Error("INV-14.2 experiment decisionRule is not locked");
  if (experiment.plannedDurationWeeks === null || experiment.plannedDurationWeeks < config.thresholds.croMinWeeks) {
    throw new Error("INV-14.2 experiment minimum duration is not locked to config");
  }
  if (!experiment.lockedAt) throw new Error("INV-14.2 experiment lock timestamp is missing");
  if (!experiment.a3ApprovalId) throw new Error("INV-14.2/A3 experiment start approval is missing");
}

export function assertNoPeeking(experiment: CroExperiment): void {
  if (experiment.status === "running" && experiment.interimAnalysisAt.length > 0) {
    throw new Error("INV-14.3 peeking detected: running experiment contains interim analysis");
  }
}

export function assertVariantIndexSafety(experiment: CroExperiment): void {
  for (const variant of experiment.variants) {
    if (variant.indexable || variant.inSitemap || !variant.canonicalToControl || !variant.botContentParity) {
      throw new Error(`INV-14.4 unsafe experiment variant ${variant.id}`);
    }
  }
}

export function classifyExperimentClosure(
  experiment: CroExperiment,
  config: CroConfig,
  observedFullWeeks: number,
): "VALID_FOR_DECISION" | "INCONCLUSIVE" {
  if (observedFullWeeks < config.thresholds.croMinWeeks) return "INCONCLUSIVE";
  if (!experiment.endedAt) return "INCONCLUSIVE";
  return "VALID_FOR_DECISION";
}

function daysBetween(now: Date, timestamp: string): number {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - parsed) / 86_400_000);
}

export function validateConsentModeV2(
  evidence: ConsentEvidence,
  config: CroConfig,
  now = new Date(),
): { status: "PASS" | "WARN"; ageDays: number } {
  if (!config.thresholds.consentTrackingRequired) return { status: "PASS", ageDays: 0 };
  if (!evidence.validatedAt || !evidence.defaultDenied || !evidence.publicChoiceManager || !evidence.structuralBreakRecorded) {
    throw new Error("Phase 14 consent-mode v2 validation FAIL");
  }
  for (const key of REQUIRED_CONSENT_KEYS) {
    if (!evidence.defaultKeys.includes(key) || !evidence.updateKeys.includes(key)) {
      throw new Error(`Phase 14 consent-mode v2 missing required key: ${key}`);
    }
  }
  const ageDays = daysBetween(now, evidence.validatedAt);
  return {
    status: ageDays > config.thresholds.consentValidationMaxAgeDays ? "WARN" : "PASS",
    ageDays,
  };
}

export function loadCroConfig(): CroConfig {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
  ) as CroConfig;
}

function main() {
  const config = loadCroConfig();
  const experiments = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/seo/cro_experiments.json"), "utf8"),
  ) as { data: { experiments: CroExperiment[]; consentValidation: ConsentEvidence } };
  for (const experiment of experiments.data.experiments) {
    assertExperimentLocked(experiment, config);
    assertNoPeeking(experiment);
    assertVariantIndexSafety(experiment);
  }
  const consent = validateConsentModeV2(experiments.data.consentValidation, config);
  console.log(`SEO_CRO_RESULT=${JSON.stringify({ experiments: experiments.data.experiments.length, consent })}`);
}

if (process.argv[1]?.endsWith("cro-governance.ts")) main();
