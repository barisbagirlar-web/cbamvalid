import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { VerifierPackageModel } from "./verifier-model";

/**
 * FAZ 13 — Premium tier chapter contract.
 *
 * Premium chapters E-01..E-16 must never be collectively NOT_APPLICABLE on a
 * premium product. Each chapter resolves to exactly one of the four mandated
 * statuses, and the premium product name on the cover is shown only when the
 * premium component contract is complete, workpapers exist, all applicable
 * chapters are rendered, every DATA GAP is visible, and no chapter is padded
 * with placeholder prose.
 */
export const PremiumChapterStatus = {
  APPLICABLE_COMPLETE: "APPLICABLE_COMPLETE",
  APPLICABLE_DATA_GAP: "APPLICABLE_DATA_GAP",
  NOT_APPLICABLE_WITH_LEGAL_BASIS: "NOT_APPLICABLE_WITH_LEGAL_BASIS",
  VERIFIER_RESERVED: "VERIFIER_RESERVED",
} as const;
export type PremiumChapterStatus = (typeof PremiumChapterStatus)[keyof typeof PremiumChapterStatus];

export interface PremiumChapterEvaluation {
  readonly chapterId: string;
  readonly title: string;
  readonly status: PremiumChapterStatus;
  readonly basis: string;
}

export interface PremiumChapterContractResult {
  readonly evaluations: readonly PremiumChapterEvaluation[];
  readonly applicableCount: number;
  readonly completeCount: number;
  readonly dataGapCount: number;
  readonly reservedCount: number;
  readonly notApplicableCount: number;
  readonly contractState: "COMPLETE" | "GAP" | "NOT_ASSESSED";
  readonly premiumNameVisible: boolean;
}

const complete = (chapterId: string, title: string, basis: string): PremiumChapterEvaluation => ({
  chapterId, title, status: PremiumChapterStatus.APPLICABLE_COMPLETE, basis,
});
const gap = (chapterId: string, title: string, basis: string): PremiumChapterEvaluation => ({
  chapterId, title, status: PremiumChapterStatus.APPLICABLE_DATA_GAP, basis,
});
const notApplicable = (chapterId: string, title: string, basis: string): PremiumChapterEvaluation => ({
  chapterId, title, status: PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS, basis,
});

export function derivePremiumChapterEvaluations(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  model: VerifierPackageModel;
}): PremiumChapterEvaluation[] {
  const { caseData, calculation, model } = params;
  const out: PremiumChapterEvaluation[] = [];

  const planRows = model.monitoringPlan;
  const planGaps = planRows.filter((row) => row.status === "GAP");
  out.push(
    planGaps.length === 0
      ? complete("E-01", "Monitoring Plan Conformance Statement", `${planRows.length}/${planRows.length} monitoring-plan requirements documented (MP-01..MP-12)`)
      : gap("E-01", "Monitoring Plan Conformance Statement", `DATA GAP: ${planGaps.map((row) => row.requirementId).join(", ")}`)
  );

  const streamsDocumented =
    Boolean(caseData.directEmissions?.value) && Boolean(caseData.electricityConsumed?.value) && Boolean(caseData.gridEmissionFactor?.value);
  out.push(
    streamsDocumented
      ? complete("E-02", "Source Stream & Emission Source Register", "Direct, electricity and grid-factor source streams documented with evidence linkage")
      : gap("E-02", "Source Stream & Emission Source Register", "DATA GAP: direct emissions, electricity consumption or grid emission factor missing")
  );

  const calibrationEvidence = caseData.evidenceRegister.filter((item) =>
    String(item.documentType || "").toUpperCase().includes("CALIBRATION") && item.supportStatus === "SUPPORTED"
  );
  out.push(
    calibrationEvidence.length > 0
      ? complete("E-03", "Metering & Instrumentation Register", `${calibrationEvidence.length} calibration certificate(s) approved and supported`)
      : gap("E-03", "Metering & Instrumentation Register", "DATA GAP: no approved calibration certificate registered")
  );

  const acceptedDecisions = caseData.methodologyDecisions.filter((item) => item.reviewStatus === "ACCEPTED");
  out.push(
    acceptedDecisions.length > 0
      ? complete("E-04", "Tier & Uncertainty Assessment", `${acceptedDecisions.length} accepted methodology decision(s) governing tier and uncertainty`)
      : gap("E-04", "Tier & Uncertainty Assessment", "DATA GAP: no accepted methodology decision for tier / uncertainty method")
  );

  const reconciliationWithinTolerance = calculation.allocationReconciliationDelta === "0" || Number(calculation.allocationReconciliationDelta) <= 0.000001;
  out.push(
    reconciliationWithinTolerance
      ? complete("E-05", "Mass & Energy Balance Reconciliation", `Allocation reconciliation delta ${calculation.allocationReconciliationDelta} within tolerance`)
      : gap("E-05", "Mass & Energy Balance Reconciliation", `DATA GAP: reconciliation delta ${calculation.allocationReconciliationDelta} exceeds tolerance`)
  );

  const sharesReconcile = calculation.allocationShareTotal === "1" || Math.abs(Number(calculation.allocationShareTotal) - 1) <= 0.000001;
  out.push(
    sharesReconcile && model.goods.length > 0
      ? complete("E-06", "Process-Level Attribution & Non-Associated Flows", `Allocation shares total ${calculation.allocationShareTotal}; ${model.goods.length} good(s) attributed`)
      : gap("E-06", "Process-Level Attribution & Non-Associated Flows", "DATA GAP: allocation shares do not reconcile or no goods attributed")
  );

  const evidenceApprovedClean = caseData.evidenceRegister.filter((item) => item.reviewStatus === "APPROVED" && item.supportStatus === "SUPPORTED" && item.malwareScanStatus === "CLEAN");
  out.push(
    evidenceApprovedClean.length > 0 && /^[a-f0-9]{64}$/i.test(calculation.calculationRootHash)
      ? complete("E-07", "Evidence Integrity and Provenance", `${evidenceApprovedClean.length} approved clean evidence file(s); calculation root ${calculation.calculationRootHash}`)
      : gap("E-07", "Evidence Integrity and Provenance", "DATA GAP: no approved clean evidence or invalid calculation root hash")
  );

  out.push(
    model.calculationTraceCount > 0 && model.calculationTraceCount === calculation.trace.length
      ? complete("E-08", "Calculation Trace & Reproducibility", `${model.calculationTraceCount} hashed calculation trace node(s)`)
      : gap("E-08", "Calculation Trace & Reproducibility", "DATA GAP: calculation trace missing or truncated")
  );

  const noPrecursorDecision = caseData.methodologyDecisions.some((item) =>
    item.reviewStatus === "ACCEPTED" && item.topic === "PRECURSOR_SCOPE" && /none|no (qualifying )?precursor/i.test(String(item.selectedMethod))
  );
  if (caseData.precursors.length > 0) {
    const precursorComplete = caseData.precursors.every((item) => Boolean(item.quantity?.value) && Boolean(item.directEmissions?.value));
    out.push(
      precursorComplete
        ? complete("E-09", "Precursor Embedded Emissions", `${caseData.precursors.length} precursor(s) with quantity and direct emissions`)
        : gap("E-09", "Precursor Embedded Emissions", "DATA GAP: precursor quantity or direct emissions missing")
    );
  } else {
    out.push(
      noPrecursorDecision
        ? notApplicable("E-09", "Precursor Embedded Emissions", "Accepted PRECURSOR_SCOPE decision records no precursor use for this installation")
        : gap("E-09", "Precursor Embedded Emissions", "DATA GAP: precursor scope decision required but not accepted")
    );
  }

  const preparation = model.verifierPreparation;
  const riskRegistersPresent = preparation !== null && preparation !== undefined &&
    (preparation.inherentRiskRegister.length > 0 || preparation.controlRiskRegister.length > 0 || preparation.detectionRiskAssessment.length > 0);
  out.push(
    riskRegistersPresent
      ? complete("E-10", "Risk, Materiality and Sampling", `Risk register entries derived for inherent, control and detection risk`)
      : gap("E-10", "Risk, Materiality and Sampling", "DATA GAP: no risk register entries derived")
  );

  const samplingPresent = preparation !== null && preparation !== undefined && preparation.samplingPopulation.length > 0;
  out.push(
    samplingPresent
      ? complete("E-11", "Sampling Workpaper", `${preparation!.samplingPopulation.length} sampling population(s) with rationale and selection`)
      : gap("E-11", "Sampling Workpaper", "DATA GAP: sampling population not derived")
  );

  const materialityPresent = preparation !== null && preparation !== undefined && preparation.materialityWorkpapers.length > 0;
  out.push(
    materialityPresent
      ? complete("E-12", "Materiality Workpaper", `${preparation!.materialityWorkpapers.length} per-good materiality workpaper(s) (PROVISIONAL_FOR_VERIFIER_PLANNING)`)
      : gap("E-12", "Materiality Workpaper", "DATA GAP: per-good materiality workpapers not derived")
  );

  const siteVisitReady = preparation !== null && preparation !== undefined && preparation.siteVisitReadiness.state === "OPERATOR_READY_FOR_SITE_VISIT";
  out.push(
    siteVisitReady
      ? complete("E-13", "Site-Visit Readiness Pack", "Operator site-visit readiness pack complete (verifier execution remains VERIFIER_RESERVED)")
      : gap("E-13", "Site-Visit Readiness Pack", "DATA GAP: site-visit readiness pack incomplete")
  );

  out.push(
    model.goods.length > 1
      ? complete("E-14", "Sensitivity & Scenario Annex", "Multi-good allocation supports sensitivity and scenario illustration")
      : notApplicable("E-14", "Sensitivity & Scenario Annex", "Single-good case; scenario annex not required under the reporting template")
  );

  const mapping = model.registryTemplateMapping;
  const missingOperatorFields = mapping.filter((entry) => entry.status === "MISSING_OPERATOR");
  const completeOperatorFields = mapping.filter((entry) => entry.status === "COMPLETE_OPERATOR");
  out.push(
    missingOperatorFields.length === 0 && completeOperatorFields.length > 0
      ? complete("E-15", "Registry Submission Readiness", `Registry Template Mapping Dataset: ${completeOperatorFields.length} operator-complete field(s), zero MISSING_OPERATOR`)
      : gap("E-15", "Registry Submission Readiness", `DATA GAP: ${missingOperatorFields.length} Registry template field(s) missing operator value`)
  );

  const recomputationReady = model.calculationTraceCount > 0 && Boolean(calculation.calculationRootHash);
  out.push(
    recomputationReady
      ? complete("E-16", "Independent Recomputation Instructions", `Calculation Trace.json + Calculation Graph.json enable independent recomputation; root ${calculation.calculationRootHash}`)
      : gap("E-16", "Independent Recomputation Instructions", "DATA GAP: calculation trace or root hash unavailable")
  );

  return out;
}

export function evaluatePremiumChapterContract(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  model: VerifierPackageModel;
}): PremiumChapterContractResult {
  const evaluations = derivePremiumChapterEvaluations(params);
  const applicableCount = evaluations.filter((entry) => entry.status === PremiumChapterStatus.APPLICABLE_COMPLETE || entry.status === PremiumChapterStatus.APPLICABLE_DATA_GAP).length;
  const completeCount = evaluations.filter((entry) => entry.status === PremiumChapterStatus.APPLICABLE_COMPLETE).length;
  const dataGapCount = evaluations.filter((entry) => entry.status === PremiumChapterStatus.APPLICABLE_DATA_GAP).length;
  const reservedCount = evaluations.filter((entry) => entry.status === PremiumChapterStatus.VERIFIER_RESERVED).length;
  const notApplicableCount = evaluations.filter((entry) => entry.status === PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS).length;

  const collectivelyNotApplicable = notApplicableCount === evaluations.length;
  const contractState: "COMPLETE" | "GAP" | "NOT_ASSESSED" =
    applicableCount === 0 || collectivelyNotApplicable
      ? "GAP"
      : dataGapCount === 0
        ? "COMPLETE"
        : "GAP";

  const premiumNameVisible = contractState === "COMPLETE" && completeCount > 0 && reservedCount < evaluations.length;

  return {
    evaluations,
    applicableCount,
    completeCount,
    dataGapCount,
    reservedCount,
    notApplicableCount,
    contractState,
    premiumNameVisible,
  };
}
