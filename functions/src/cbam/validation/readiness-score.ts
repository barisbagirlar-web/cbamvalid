import { Decimal } from "decimal.js";
import type { AuditReadyCase } from "../schema";
import type { ReadinessAssessment, ReadinessDimension, ReadinessDimensionId, OperatorReadinessStatus } from "../report/premium-dossier-schema";
import { runEvidenceSufficiency } from "./evidence-sufficiency";
import { generateFindingsAndActions } from "./findings-engine";

export function assessReadiness(params: {
  caseData: AuditReadyCase;
  isDraft: boolean;
}): ReadinessAssessment {
  const { caseData, isDraft } = params;

  // 1. Run validation engines
  const sufficiency = runEvidenceSufficiency(caseData);
  const { findings } = generateFindingsAndActions(caseData);

  // 2. Map requirements & findings to dimensions
  const dimensionDefinitions: Record<ReadinessDimensionId, {
    weight: Decimal;
    reqIds: string[];
    rulePrefixes: string[];
  }> = {
    IDENTITY: {
      weight: new Decimal("10"),
      reqIds: ["REQ-OP-NAME", "REQ-OP-ADDR", "REQ-IM-NAME", "REQ-IM-EORI", "REQ-INST-NAME", "REQ-INST-COUNTRY"],
      rulePrefixes: ["QC_00", "QC_01"],
    },
    SCOPE_AND_METHODOLOGY: {
      weight: new Decimal("15"),
      reqIds: ["REQ-INST-ROUTE", "REQ-INST-BOUNDS", "REQ-PERIOD-YEAR"],
      rulePrefixes: ["QC_02", "QC_03"],
    },
    ACTIVITY_DATA: {
      weight: new Decimal("15"),
      reqIds: ["REQ-GOOD-VOL-", "REQ-DIR-EM", "REQ-ELEC-CON", "REQ-ELEC-FAC", "REQ-PRE-QTY-"],
      rulePrefixes: ["QC_04", "QC_06", "QC_07", "QC_08"],
    },
    EVIDENCE: {
      weight: new Decimal("20"),
      reqIds: ["REQ-"], // all evidence reqs
      rulePrefixes: ["QC_10"],
    },
    CALCULATION_INTEGRITY: {
      weight: new Decimal("15"),
      reqIds: [],
      rulePrefixes: ["QC_11"],
    },
    ALLOCATION_AND_RECONCILIATION: {
      weight: new Decimal("10"),
      reqIds: ["REQ-GOOD-ALLOC-"],
      rulePrefixes: ["QC_05A"],
    },
    DATA_QUALITY_AND_UNCERTAINTY: {
      weight: new Decimal("10"),
      reqIds: [],
      rulePrefixes: [],
    },
    PACKAGE_INTEGRITY: {
      weight: new Decimal("5"),
      reqIds: [],
      rulePrefixes: [],
    },
  };

  const dimensions: ReadinessDimension[] = [];
  let totalWeightedScore = new Decimal(0);

  // Helper to check if a requirement belongs to a dimension
  const reqBelongsTo = (reqId: string, dimId: ReadinessDimensionId): boolean => {
    const def = dimensionDefinitions[dimId];
    if (dimId === "EVIDENCE") return true; // Evidence checks all
    return def.reqIds.some(id => reqId === id || (id.endsWith("-") && reqId.startsWith(id)));
  };

  const ruleBelongsTo = (ruleId: string, dimId: ReadinessDimensionId): boolean => {
    const def = dimensionDefinitions[dimId];
    return def.rulePrefixes.some(prefix => ruleId === prefix || ruleId.startsWith(prefix));
  };

  const dimIds: ReadinessDimensionId[] = [
    "IDENTITY",
    "SCOPE_AND_METHODOLOGY",
    "ACTIVITY_DATA",
    "EVIDENCE",
    "CALCULATION_INTEGRITY",
    "ALLOCATION_AND_RECONCILIATION",
    "DATA_QUALITY_AND_UNCERTAINTY",
    "PACKAGE_INTEGRITY",
  ];

  for (const dimId of dimIds) {
    const def = dimensionDefinitions[dimId];

    // Filter sufficiency rows for this dimension
    const dimSufficiency = sufficiency.filter(row => reqBelongsTo(row.requirementId, dimId));
    // Filter findings for this dimension
    const dimFindings = findings.filter(f => ruleBelongsTo(f.ruleId, dimId));

    const blockerFindingIds = dimFindings.filter(f => f.blocksOperatorReadiness || f.blocksSealing).map(f => f.findingId);
    const materialFindingIds = dimFindings.filter(f => f.severity === "MATERIAL" || f.severity === "CRITICAL").map(f => f.findingId);

    let passedCount = dimSufficiency.filter(row => row.state === "SUPPORTED").length;
    let applicableCount = dimSufficiency.length;

    // Default to at least 1 applicable check to avoid divide by zero if empty
    if (applicableCount === 0) {
      applicableCount = 1;
      passedCount = blockerFindingIds.length === 0 ? 1 : 0;
    }

    const rawScore = new Decimal(passedCount).dividedBy(applicableCount).times(100);
    const weightedScore = rawScore.times(def.weight).dividedBy(100);
    totalWeightedScore = totalWeightedScore.plus(weightedScore);

    dimensions.push({
      dimensionId: dimId,
      weight: def.weight.toString(),
      rawScore: rawScore.toDecimalPlaces(2).toString(),
      weightedScore: weightedScore.toDecimalPlaces(2).toString(),
      passedRequirementCount: dimSufficiency.filter(row => row.state === "SUPPORTED").length,
      applicableRequirementCount: dimSufficiency.length,
      blockerFindingIds,
      materialFindingIds,
    });
  }

  const finalScore = totalWeightedScore.toDecimalPlaces(2);

  // 3. Count gates & indicators
  const criticalBlockerCount = findings.filter(f => f.severity === "CRITICAL" && f.status === "OPEN").length;
  const materialFindingCount = findings.filter(f => f.severity === "MATERIAL" && f.status === "OPEN").length;
  const openFindingCount = findings.filter(f => f.status === "OPEN").length;
  const missingMaterialEvidenceCount = sufficiency.filter(r => r.blocksSealing && r.state !== "SUPPORTED").length;
  const unresolvedCalculationExceptionCount = findings.filter(f => f.category === "CALCULATION_EXCEPTION" && f.status === "OPEN").length;

  const hasCriticalBlocker = criticalBlockerCount > 0;
  const hasMaterialOperatorBlocker = materialFindingCount > 0;
  const hasUnsupportedMaterialEvidence = missingMaterialEvidenceCount > 0;
  const hasIntegrityFailure = findings.some(f => f.category === "EVIDENCE_INTEGRITY" && f.status === "OPEN");

  // Derive operator status
  let operatorStatus: OperatorReadinessStatus = "DRAFT";
  if (!isDraft) {
    if (hasCriticalBlocker || hasMaterialOperatorBlocker || hasUnsupportedMaterialEvidence || hasIntegrityFailure) {
      operatorStatus = "NOT_READY";
    } else if (finalScore.lessThan(90) || openFindingCount > 0) {
      operatorStatus = "CONDITIONAL";
    } else {
      operatorStatus = "READY_FOR_VERIFIER_REVIEW";
    }
  }

  // Recommended Decision
  let recommendedDecision: ReadinessAssessment["recommendedDecision"] = "READY_TO_HAND_OVER";
  const decisionReasonCodes: string[] = [];

  if (hasCriticalBlocker || hasIntegrityFailure) {
    recommendedDecision = "DO_NOT_SUBMIT";
    decisionReasonCodes.push("CRITICAL_BLOCKERS_PRESENT");
  } else if (hasMaterialOperatorBlocker || hasUnsupportedMaterialEvidence || finalScore.lessThan(90)) {
    recommendedDecision = "REMEDIATE_BEFORE_REVIEW";
    decisionReasonCodes.push("MATERIAL_GAPS_OR_LOW_SCORE");
  } else {
    decisionReasonCodes.push("READINESS_THRESHOLD_MET");
  }

  return {
    operatorStatus,
    independentVerifierStatus: "NOT_REVIEWED",
    score: finalScore.toString(),
    scoreScale: "0-100",
    dimensions: dimensions as any,
    criticalBlockerCount,
    materialFindingCount,
    openFindingCount,
    missingMaterialEvidenceCount,
    unresolvedCalculationExceptionCount,
    recommendedDecision,
    decisionReasonCodes,
  };
}
