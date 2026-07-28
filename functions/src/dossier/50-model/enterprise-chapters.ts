/**
 * Part D — Enterprise / Exclusive chapter registry + content contracts.
 * Missing required chapters for a tier → seal/render blocked with DATA GAP.
 */
import {
  evaluateContentContract,
  type ContentContract,
  type ContentContractOutcome,
} from "../40-readiness/content-contracts";

export type DossierTier = "STANDARD" | "PREMIUM" | "ENTERPRISE" | "EXCLUSIVE";

export interface EnterpriseChapterDef {
  readonly id: string;
  readonly title: string;
  readonly tier: "ENTERPRISE" | "EXCLUSIVE" | "PREMIUM";
  readonly contract: ContentContract;
}

export const ENTERPRISE_CHAPTERS: readonly EnterpriseChapterDef[] = [
  {
    id: "E-01",
    title: "Monitoring Plan Conformance Statement",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-01",
      requiredFields: ["monitoringPlanEvidenceId", "conformanceStatement", "templateElementsCovered"],
      minRecords: 1,
    },
  },
  {
    id: "E-02",
    title: "Source Stream & Emission Source Register",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-02",
      requiredFields: ["sourceStreams", "emissionSources"],
      minRecords: 1,
    },
  },
  {
    id: "E-03",
    title: "Metering & Instrumentation Register",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-03",
      requiredFields: ["meters", "calibrationValidity"],
      minRecords: 1,
    },
  },
  {
    id: "E-04",
    title: "Tier & Uncertainty Assessment",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-04",
      requiredFields: ["tierRows", "uncertaintyMethod"],
      minRecords: 1,
    },
  },
  {
    id: "E-05",
    title: "Mass & Energy Balance Reconciliation",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-05",
      requiredFields: ["massBalance", "energyBalance", "reconciliationDelta"],
      minRecords: 1,
    },
  },
  {
    id: "E-06",
    title: "Process-Level Attribution & Non-Associated Flows",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-06",
      requiredFields: ["processes", "nonAssociatedFlows"],
      minRecords: 1,
    },
  },
  {
    id: "E-07",
    title: "Precursor Register",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-07",
      requiredFields: ["precursorDecision", "actualVsDefaultTest"],
      minRecords: 0,
    },
  },
  {
    id: "E-08",
    title: "Default Value Fallback & Mark-up Analysis",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-08",
      requiredFields: ["defaultValueRows", "markUpAnalysis"],
      minRecords: 0,
    },
  },
  {
    id: "E-09",
    title: "Carbon Price Paid in Country of Origin (Art. 9)",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-09",
      requiredFields: ["carbonPriceRecords", "certificateAdjustment"],
      minRecords: 0,
    },
  },
  {
    id: "E-10",
    title: "Data Flow, Control Activities & Risk Assessment",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-10",
      requiredFields: ["dataFlowMap", "controlActivities", "riskAssessment"],
      minRecords: 1,
    },
  },
  {
    id: "E-11",
    title: "Sampling Plan & Population Definition",
    tier: "ENTERPRISE",
    contract: {
      chapterId: "E-11",
      requiredFields: ["populationDefinition", "samplingPlan"],
      minRecords: 1,
    },
  },
  {
    id: "E-12",
    title: "Materiality & Misstatement Envelope",
    tier: "EXCLUSIVE",
    contract: {
      chapterId: "E-12",
      requiredFields: ["materialityRate", "misstatementEnvelope"],
      minRecords: 1,
    },
  },
  {
    id: "E-13",
    title: "Site-Visit Readiness Pack",
    tier: "EXCLUSIVE",
    contract: {
      chapterId: "E-13",
      requiredFields: ["sitePlan", "interviewList", "documentPullList", "meterLocations"],
      minRecords: 1,
    },
  },
  {
    id: "E-14",
    title: "Sensitivity & Scenario Annex",
    tier: "EXCLUSIVE",
    contract: {
      chapterId: "E-14",
      requiredFields: ["actualScenario", "defaultScenario", "benchmarkScenario"],
      minRecords: 1,
    },
  },
  {
    id: "E-15",
    title: "Registry Submission Readiness",
    tier: "EXCLUSIVE",
    contract: {
      chapterId: "E-15",
      requiredFields: ["fieldMapping", "validationDryRun"],
      minRecords: 1,
    },
  },
  {
    id: "E-16",
    title: "Independent Recomputation Instructions",
    tier: "EXCLUSIVE",
    contract: {
      chapterId: "E-16",
      requiredFields: ["cliUsage", "verificationReportPath"],
      minRecords: 1,
    },
  },
] as const;

const TIER_RANK: Record<DossierTier, number> = {
  STANDARD: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  EXCLUSIVE: 3,
};

function chapterRequiredForTier(chapter: EnterpriseChapterDef, tier: DossierTier): boolean {
  // Part F: E-01..E-04, E-07, E-08 are Premium+; other ENTERPRISE ids need Enterprise+; EXCLUSIVE need Exclusive.
  if (["E-01", "E-02", "E-03", "E-04", "E-07", "E-08"].includes(chapter.id)) {
    return TIER_RANK[tier] >= TIER_RANK.PREMIUM;
  }
  if (chapter.tier === "EXCLUSIVE") return TIER_RANK[tier] >= TIER_RANK.EXCLUSIVE;
  return TIER_RANK[tier] >= TIER_RANK.ENTERPRISE;
}

export interface ChapterEvaluation {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
  readonly outcome: ContentContractOutcome;
}

export function evaluateEnterpriseChapters(params: {
  readonly tier: DossierTier;
  readonly providedByChapterId: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}): {
  readonly evaluations: readonly ChapterEvaluation[];
  readonly blockingGaps: readonly string[];
} {
  const evaluations: ChapterEvaluation[] = [];
  const blockingGaps: string[] = [];

  for (const chapter of ENTERPRISE_CHAPTERS) {
    const required = chapterRequiredForTier(chapter, params.tier);
    const provided = params.providedByChapterId[chapter.id] || {};
    const outcome = required
      ? evaluateContentContract(chapter.contract, provided)
      : ({ status: "NOT_APPLICABLE", reason: `Not required for tier ${params.tier}` } as const);
    evaluations.push({
      id: chapter.id,
      title: chapter.title,
      required,
      outcome,
    });
    if (required && outcome.status === "INSUFFICIENT") {
      blockingGaps.push(`${chapter.id}:${outcome.dataGapMessage}`);
    }
  }

  return {
    evaluations: Object.freeze(evaluations),
    blockingGaps: Object.freeze(blockingGaps),
  };
}
