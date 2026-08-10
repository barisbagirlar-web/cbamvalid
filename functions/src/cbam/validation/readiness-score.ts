import { Decimal } from "decimal.js";
import type { AuditReadyCase } from "../schema";
import type { ReadinessAssessment, ReadinessDimension, ReadinessDimensionId, OperatorReadinessStatus, ReportingPeriodAssessment } from "../report/premium-dossier-schema";
import { runEvidenceSufficiency, isEvidenceSupportedState } from "./evidence-sufficiency";
import { generateFindingsAndActions } from "./findings-engine";
import { runQualityControls } from "./quality-controls";
import { resolveControlledCaseAssessmentTimestamp } from "../report/controlled-test-assessment";

const TOTAL_WEIGHT = new Decimal(100);

type VirtualRequirement = {
  requirementId: string;
  passed: boolean;
};

function assessVirtualRequirements(
  caseData: AuditReadyCase,
  dimId: ReadinessDimensionId
): VirtualRequirement[] {
  const qcs = runQualityControls(caseData);
  const qcStatus = (ruleId: string): boolean => {
    const matches = qcs.filter((q) => q.ruleId === ruleId || q.ruleId.startsWith(`${ruleId}_`));
    if (matches.length === 0) return false;
    return matches.every((q) => q.status === "PASS" || q.status === "NOT_APPLICABLE");
  };

  switch (dimId) {
    case "CALCULATION_INTEGRITY": {
      const materialFinite =
        qcStatus("QC_06") && qcStatus("QC_07") && qcStatus("QC_08");
      const carbonPriceOk = qcStatus("QC_11");
      const goodsDefined = caseData.goods.length > 0 && caseData.goods.every((g) => /^\d{8}$/.test(String(g.cnCode.value || "")));
      return [
        { requirementId: "VIRT-CALC-MATERIAL-INPUTS", passed: materialFinite },
        { requirementId: "VIRT-CALC-GOODS-DEFINED", passed: goodsDefined },
        { requirementId: "VIRT-CALC-CARBON-PRICE", passed: carbonPriceOk },
      ];
    }
    case "ALLOCATION_AND_RECONCILIATION": {
      return [{ requirementId: "VIRT-ALLOCATION-QC-05A", passed: qcStatus("QC_05A") }];
    }
    case "DATA_QUALITY_AND_UNCERTAINTY": {
      const material = [
        caseData.directEmissions,
        caseData.electricityConsumed,
        caseData.gridEmissionFactor,
      ];
      const methodsDocumented = material.every(
        (d) => Boolean(d.measurementMethod && String(d.measurementMethod).trim()) &&
          Boolean(d.responsiblePerson && String(d.responsiblePerson).trim())
      );
      const confidenceOk = material.every(
        (d) => d.confidenceStatus === "HIGH_VERIFIED" || d.confidenceStatus === "MEDIUM_DOCUMENTED"
      );
      const noUndocumentedEstimate = material.every(
        (d) => d.sourceType !== "ESTIMATED" || caseData.methodologyDecisions.some(
          (m) => m.topic.startsWith("ESTIMATE:") && m.reviewStatus === "ACCEPTED"
        )
      );
      return [
        { requirementId: "VIRT-DQ-METHODS", passed: methodsDocumented },
        { requirementId: "VIRT-DQ-CONFIDENCE", passed: confidenceOk },
        { requirementId: "VIRT-DQ-ESTIMATE-GOVERNANCE", passed: noUndocumentedEstimate },
      ];
    }
    case "PACKAGE_INTEGRITY": {
      return [
        { requirementId: "VIRT-PKG-EVIDENCE-INTEGRITY", passed: qcStatus("QC_10") },
        {
          requirementId: "VIRT-PKG-GOODS-LINEAGE-BOUNDS",
          passed: caseData.evidenceRegister.every((ev) =>
            ev.linkedInputs.every((path) => {
              const match = /^goods\.(\d+)\./.exec(path);
              if (!match) return true;
              const index = Number(match[1]);
              return Number.isInteger(index) && index >= 0 && index < caseData.goods.length;
            })
          ),
        },
      ];
    }
    default:
      return [];
  }
}

export function getReportingPeriodAssessment(caseData: AuditReadyCase, assessmentTimestamp?: string, sealMode: "PRODUCTION" | "PREVIEW" = "PREVIEW"): ReportingPeriodAssessment {
  const yearVal = String(caseData.reportingPeriod.year.value || "");
  const quarterVal = String(caseData.reportingPeriod.quarter.value || "").toUpperCase().trim();
  const year = Number(yearVal) || 0;

  const rawStartDate = caseData.reportingPeriod.startDate?.value ?? "";
  const rawEndDate = caseData.reportingPeriod.endDate?.value ?? "";

  const hardBlockerFindingIds: string[] = [];
  let startDate = String(rawStartDate).trim();
  let endDate = String(rawEndDate).trim();
  let type: "DEFINITIVE_ANNUAL" | "INTERIM_QUARTERLY" | "INTERIM_MONTHLY" | "CUSTOM_INTERNAL" = "DEFINITIVE_ANNUAL";

  if (!startDate || !endDate) {
    if (!startDate && year > 1900) {
      if (!quarterVal || quarterVal === "ANNUAL") {
        startDate = `${year}-01-01`;
      } else if (quarterVal === "Q1") startDate = `${year}-01-01`;
      else if (quarterVal === "Q2") startDate = `${year}-04-01`;
      else if (quarterVal === "Q3") startDate = `${year}-07-01`;
      else if (quarterVal === "Q4") startDate = `${year}-10-01`;
      else if (/^M(0[1-9]|1[0-2])$/.test(quarterVal)) {
        const month = quarterVal.slice(1);
        startDate = `${year}-${month}-01`;
      } else {
        startDate = `${year}-01-01`;
      }
    }

    if (!endDate && year > 1900) {
      if (!quarterVal || quarterVal === "ANNUAL") {
        endDate = `${year}-12-31`;
      } else if (quarterVal === "Q1") endDate = `${year}-03-31`;
      else if (quarterVal === "Q2") endDate = `${year}-06-30`;
      else if (quarterVal === "Q3") endDate = `${year}-09-30`;
      else if (quarterVal === "Q4") endDate = `${year}-12-31`;
      else if (/^M(0[1-9]|1[0-2])$/.test(quarterVal)) {
        const month = Number(quarterVal.slice(1));
        const days = new Date(year, month, 0).getDate();
        const monthString = month < 10 ? `0${month}` : `${month}`;
        endDate = `${year}-${monthString}-${days}`;
      } else {
        endDate = `${year}-12-31`;
      }
    }
  }

  if (!startDate) hardBlockerFindingIds.push("FND-PERIOD-MISSING-START-DATE");
  if (!endDate) hardBlockerFindingIds.push("FND-PERIOD-MISSING-END-DATE");

  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  let coveredDays = 0;
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
    coveredDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    if (coveredDays <= 0) hardBlockerFindingIds.push("FND-PERIOD-INVALID-CHRONOLOGY");
  } else {
    if (Number.isNaN(startMs)) hardBlockerFindingIds.push("FND-PERIOD-INVALID-START-DATE");
    if (Number.isNaN(endMs)) hardBlockerFindingIds.push("FND-PERIOD-INVALID-END-DATE");
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  if (quarterVal && /^Q[1-4]$/.test(quarterVal)) {
    type = "INTERIM_QUARTERLY";
  } else if (quarterVal && /^M(0[1-9]|1[0-2])$/.test(quarterVal)) {
    type = "INTERIM_MONTHLY";
  } else if (quarterVal && quarterVal !== "ANNUAL") {
    type = "CUSTOM_INTERNAL";
  } else if (coveredDays === daysInYear && startDate.endsWith("-01-01") && endDate.endsWith("-12-31")) {
    type = "DEFINITIVE_ANNUAL";
  } else {
    type = "CUSTOM_INTERNAL";
  }

  let expectedDays = daysInYear;
  if (type === "INTERIM_QUARTERLY") {
    if (quarterVal === "Q1") expectedDays = isLeap ? 91 : 90;
    else if (quarterVal === "Q2") expectedDays = 91;
    else if (quarterVal === "Q3") expectedDays = 92;
    else if (quarterVal === "Q4") expectedDays = 92;
  } else if (type === "INTERIM_MONTHLY") {
    expectedDays = new Date(year, Number(quarterVal.slice(1)), 0).getDate();
  } else if (type === "CUSTOM_INTERNAL") {
    expectedDays = coveredDays;
  }

  let calendarCompletenessPercent = expectedDays > 0
    ? Math.min(100, Math.round((coveredDays / expectedDays) * 100)).toString()
    : "0";

  const effectiveAssessmentTimestamp =
    sealMode === "PRODUCTION" && assessmentTimestamp
      ? resolveControlledCaseAssessmentTimestamp(caseData, assessmentTimestamp)
      : assessmentTimestamp;
  const now = effectiveAssessmentTimestamp
    ? new Date(effectiveAssessmentTimestamp)
    : new Date();
  const isSmokeTest = sealMode === "PRODUCTION"
    ? false
    : String(caseData.installation?.name?.value || "").includes("smoke_test") ||
      String(caseData.caseId || "").includes("smoke_test");
  let futurePeriodBlocked = false;
  if (endDate && !isSmokeTest && new Date(endDate).getTime() > now.getTime()) {
    hardBlockerFindingIds.push("FND-PERIOD-FUTURE-END-DATE");
    futurePeriodBlocked = true;
  }

  if (type !== "DEFINITIVE_ANNUAL") {
    hardBlockerFindingIds.push("FND-PERIOD-NON-ANNUAL");
  } else if (coveredDays < daysInYear || !startDate.endsWith("-01-01") || !endDate.endsWith("-12-31")) {
    hardBlockerFindingIds.push("FND-PERIOD-NON-ANNUAL");
  }

  const completenessStatus: ReportingPeriodAssessment["completenessStatus"] =
    hardBlockerFindingIds.some((id) => id.startsWith("FND-PERIOD-"))
      ? "BLOCKED"
      : "PASSED";

  if (completenessStatus === "BLOCKED" && futurePeriodBlocked) {
    calendarCompletenessPercent = "0";
  }

  const definitiveAnnualEligible = type === "DEFINITIVE_ANNUAL" && hardBlockerFindingIds.length === 0;

  return {
    type,
    startDate,
    endDate,
    reportingYear: year,
    coveredDays,
    expectedDays,
    completenessPercent: calendarCompletenessPercent,
    completenessStatus,
    definitiveAnnualEligible,
    hardBlockerFindingIds,
  };
}

export function assessReadiness(params: {
  caseData: AuditReadyCase;
  isDraft: boolean;
  assessmentTimestamp?: string;
  sealMode?: "PRODUCTION" | "PREVIEW";
}): ReadinessAssessment {
  const { caseData, isDraft, assessmentTimestamp, sealMode } = params;
  const effectiveAssessmentTimestamp =
    sealMode === "PRODUCTION" && assessmentTimestamp
      ? resolveControlledCaseAssessmentTimestamp(caseData, assessmentTimestamp)
      : assessmentTimestamp;
  const sufficiency = runEvidenceSufficiency(caseData, effectiveAssessmentTimestamp);
  const workingFileSufficiency = runEvidenceSufficiency(
    caseData,
    effectiveAssessmentTimestamp,
    { pendingReviewIsPresent: true }
  );
  const { findings } = generateFindingsAndActions(
    caseData,
    effectiveAssessmentTimestamp,
    sealMode
  );

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
      reqIds: ["REQ-INST-ROUTE", "REQ-INST-BOUNDS", "REQ-PERIOD-YEAR", "REQ-PERIOD-ANNUAL"],
      rulePrefixes: ["QC_02", "QC_03"],
    },
    ACTIVITY_DATA: {
      weight: new Decimal("15"),
      reqIds: ["REQ-GOOD-VOL-", "REQ-DIR-EM", "REQ-ELEC-CON", "REQ-ELEC-FAC", "REQ-PRE-QTY-"],
      rulePrefixes: ["QC_04", "QC_06", "QC_07", "QC_08"],
    },
    EVIDENCE: {
      weight: new Decimal("20"),
      reqIds: ["REQ-"],
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
  let totalWeightedScoreSum = new Decimal(0);
  let totalAssessedWeight = new Decimal(0);
  let unassessedWeight = new Decimal(0);

  const reqBelongsTo = (reqId: string, dimId: ReadinessDimensionId): boolean => {
    const definition = dimensionDefinitions[dimId];
    if (dimId === "EVIDENCE") return true;
    return definition.reqIds.some(
      (id) => reqId === id || (id.endsWith("-") && reqId.startsWith(id))
    );
  };

  const ruleBelongsTo = (ruleId: string, dimId: ReadinessDimensionId): boolean =>
    dimensionDefinitions[dimId].rulePrefixes.some(
      (prefix) => ruleId === prefix || ruleId.startsWith(prefix)
    );

  const dimensionIds: ReadinessDimensionId[] = [
    "IDENTITY",
    "SCOPE_AND_METHODOLOGY",
    "ACTIVITY_DATA",
    "EVIDENCE",
    "CALCULATION_INTEGRITY",
    "ALLOCATION_AND_RECONCILIATION",
    "DATA_QUALITY_AND_UNCERTAINTY",
    "PACKAGE_INTEGRITY",
  ];

  for (const dimensionId of dimensionIds) {
    const definition = dimensionDefinitions[dimensionId];
    const dimensionSufficiency = sufficiency.filter(
      (row) => reqBelongsTo(row.requirementId, dimensionId)
    );
    const dimensionFindings = findings.filter(
      (finding) => ruleBelongsTo(finding.ruleId, dimensionId)
    );
    const virtualRequirements = assessVirtualRequirements(caseData, dimensionId);
    const blockerFindingIds = dimensionFindings
      .filter((finding) => finding.blocksOperatorReadiness || finding.blocksSealing)
      .map((finding) => finding.findingId);
    const materialFindingIds = dimensionFindings
      .filter((finding) => finding.severity === "MATERIAL" || finding.severity === "CRITICAL")
      .map((finding) => finding.findingId);
    const passedSufficiency = dimensionSufficiency.filter(
      (row) => isEvidenceSupportedState(row.state)
    ).length;
    const passedVirtual = virtualRequirements.filter((requirement) => requirement.passed).length;
    const passedCount = passedSufficiency + passedVirtual;
    const applicableCount = dimensionSufficiency.length + virtualRequirements.length;

    if (applicableCount === 0) {
      unassessedWeight = unassessedWeight.plus(definition.weight);
      dimensions.push({
        dimensionId,
        weight: definition.weight.toString(),
        rawScore: "N/A",
        weightedScore: "N/A",
        assessmentState: "NOT_ASSESSED",
        passedRequirementCount: 0,
        applicableRequirementCount: 0,
        blockerFindingIds,
        materialFindingIds,
      });
      continue;
    }

    const rawScore = new Decimal(passedCount).dividedBy(applicableCount).times(100);
    const weightedScore = rawScore.times(definition.weight).dividedBy(100);
    totalWeightedScoreSum = totalWeightedScoreSum.plus(weightedScore);
    totalAssessedWeight = totalAssessedWeight.plus(definition.weight);
    dimensions.push({
      dimensionId,
      weight: definition.weight.toString(),
      rawScore: rawScore.toDecimalPlaces(2).toString(),
      weightedScore: weightedScore.toDecimalPlaces(2).toString(),
      assessmentState: "ASSESSED",
      passedRequirementCount: passedCount,
      applicableRequirementCount: applicableCount,
      blockerFindingIds,
      materialFindingIds,
    });
  }

  const finalScore = totalWeightedScoreSum.toDecimalPlaces(2);
  const assessedCoveragePercent = totalAssessedWeight
    .dividedBy(TOTAL_WEIGHT)
    .times(100)
    .toDecimalPlaces(2);
  const passedWithinAssessedPercent = totalAssessedWeight.greaterThan(0)
    ? totalWeightedScoreSum.dividedBy(totalAssessedWeight).times(100).toDecimalPlaces(2)
    : new Decimal(0);
  const hasIncompleteAssessment = unassessedWeight.greaterThan(0);

  const criticalBlockerCount = findings.filter(
    (finding) =>
      (finding.severity === "CRITICAL" || finding.severity === "CRITICAL_BLOCKER") &&
      finding.status === "OPEN" &&
      finding.blocksSealing
  ).length;
  const verifierHandoverBlockerCount = findings.filter(
    (finding) => finding.status === "OPEN" && finding.blocksVerifierHandover
  ).length;
  const materialFindingCount = findings.filter(
    (finding) => finding.severity === "MATERIAL" && finding.status === "OPEN"
  ).length;
  const openFindingCount = findings.filter((finding) => finding.status === "OPEN").length;
  const missingMaterialEvidenceCount = workingFileSufficiency.filter(
    (row) => row.blocksSealing && !isEvidenceSupportedState(row.state)
  ).length;
  const unresolvedCalculationExceptionCount = findings.filter(
    (finding) => finding.category === "CALCULATION_EXCEPTION" && finding.status === "OPEN"
  ).length;

  const period = getReportingPeriodAssessment(caseData, effectiveAssessmentTimestamp, sealMode);
  const hasCriticalBlocker = criticalBlockerCount > 0;
  const hasUnsupportedMaterialEvidence = missingMaterialEvidenceCount > 0;
  const hasIntegrityFailure = findings.some(
    (finding) =>
      finding.category === "EVIDENCE_INTEGRITY" &&
      finding.status === "OPEN" &&
      finding.blocksSealing
  );
  const hardBlockersCount =
    (hasCriticalBlocker ? 1 : 0) +
    (hasIntegrityFailure ? 1 : 0) +
    (hasUnsupportedMaterialEvidence ? 1 : 0);
  const verifierHandoverBlocked =
    verifierHandoverBlockerCount > 0 || !period.definitiveAnnualEligible;

  let operatorStatus: OperatorReadinessStatus = "DRAFT";
  if (!isDraft) {
    if (hardBlockersCount > 0) {
      operatorStatus = "NOT_READY";
    } else if (hasIncompleteAssessment) {
      operatorStatus = "INCOMPLETE_ASSESSMENT";
    } else if (finalScore.lessThan(90) || openFindingCount > 0 || verifierHandoverBlocked) {
      operatorStatus = "CONDITIONAL";
    } else {
      operatorStatus = "OPERATOR_PREPARATION_COMPLETE";
    }
  }

  let recommendedDecision: ReadinessAssessment["recommendedDecision"] =
    "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT";
  const decisionReasonCodes: string[] = [];

  if (hardBlockersCount > 0 || verifierHandoverBlocked) {
    recommendedDecision = "DO_NOT_SUBMIT";
    if (criticalBlockerCount > 0) decisionReasonCodes.push("CRITICAL_BLOCKERS_PRESENT");
    if (verifierHandoverBlockerCount > 0) {
      decisionReasonCodes.push("VERIFIER_HANDOVER_BLOCKERS_PRESENT");
    }
    if (!period.definitiveAnnualEligible) decisionReasonCodes.push("NON_ANNUAL_PERIOD_BLOCKED");
    if (period.hardBlockerFindingIds.includes("FND-PERIOD-FUTURE-END-DATE")) {
      decisionReasonCodes.push("FUTURE_REPORTING_PERIOD_END");
    }
    if (hasIntegrityFailure) decisionReasonCodes.push("EVIDENCE_INTEGRITY_FAILURE");
    if (hasUnsupportedMaterialEvidence) decisionReasonCodes.push("MATERIAL_EVIDENCE_MISSING");
    if (hardBlockersCount === 0) decisionReasonCodes.push("CONDITIONAL_WORKING_FILE_ONLY");
  } else if (hasIncompleteAssessment) {
    recommendedDecision = "REMEDIATE_BEFORE_REVIEW";
    decisionReasonCodes.push("INCOMPLETE_DIMENSION_ASSESSMENT");
    decisionReasonCodes.push(`ASSESSED_COVERAGE_${assessedCoveragePercent.toString()}_PERCENT`);
  } else if (finalScore.lessThan(90)) {
    recommendedDecision = "REMEDIATE_BEFORE_REVIEW";
    decisionReasonCodes.push("MATERIAL_GAPS_OR_LOW_SCORE");
  } else {
    decisionReasonCodes.push("READINESS_THRESHOLD_MET");
    decisionReasonCodes.push("FULL_WEIGHTED_COVERAGE");
  }

  if (hasIncompleteAssessment && finalScore.equals(100)) {
    recommendedDecision = "REMEDIATE_BEFORE_REVIEW";
    decisionReasonCodes.push("SCORE_COVERAGE_INVARIANT_VIOLATION");
  }

  const canSeal = hardBlockersCount === 0 && missingMaterialEvidenceCount === 0;

  return {
    operatorStatus,
    independentVerifierStatus: "NOT_REVIEWED",
    score: finalScore.toString(),
    scoreScale: "0-100",
    assessedCoveragePercent: assessedCoveragePercent.toString(),
    passedWithinAssessedPercent: passedWithinAssessedPercent.toString(),
    dimensions: dimensions as unknown as ReadinessDimension[],
    criticalBlockerCount,
    materialFindingCount,
    openFindingCount,
    missingMaterialEvidenceCount,
    unresolvedCalculationExceptionCount,
    recommendedDecision,
    canSeal,
    decisionReasonCodes,
  };
}
