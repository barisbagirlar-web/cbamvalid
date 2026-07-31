/**
 * WP-10 — Verifier preparation modules (FAZ 6).
 *
 * Deterministic, fail-closed derivations:
 *   1. Inherent risk register
 *   2. Control risk register
 *   3. Detection risk assessment
 *   4. Misstatement susceptibility
 *   5. Non-conformity risk
 *   6. Data-flow control matrix
 *   7. Sampling population
 *   8. Sampling rationale
 *   9. Sample selection
 *   10. Site-visit readiness
 *   11. Corrective action closure
 *   12. Independent review handover
 *
 * Materiality is always recorded per good as a full workpaper with
 * regulatory basis, calculation basis, expert judgement and verifier
 * status. Until an independent verifier confirms it, every workpaper is
 * PROVISIONAL_FOR_VERIFIER_PLANNING — never a bare hardcoded percentage.
 */
import { Decimal } from "decimal.js";
import type { AuditReadyCase, EvidenceRecord } from "../../cbam/schema";
import type { DossierCalculationResult } from "../../cbam/calculator";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "NOT_ASSESSED";
export type AssessmentState = "ASSESSED" | "NOT_ASSESSED";
export type MaterialityVerifierStatus =
  | "PROVISIONAL_FOR_VERIFIER_PLANNING"
  | "VERIFIER_APPROVED"
  | "NOT_ASSESSED";

export interface RiskRegisterEntry {
  readonly riskId: string;
  readonly register: "INHERENT" | "CONTROL" | "DETECTION";
  readonly riskDescription: string;
  readonly affectedDataDomain: string;
  readonly likelihood: RiskLevel;
  readonly impact: RiskLevel;
  readonly combined: RiskLevel;
  readonly mitigatingControl: string;
  readonly assessmentState: AssessmentState;
}

export interface MisstatementSusceptibilityEntry {
  readonly domain: string;
  readonly susceptibility: RiskLevel;
  readonly basis: string;
}

export interface NonConformityRiskEntry {
  readonly requirementArea: string;
  readonly risk: RiskLevel;
  readonly basis: string;
}

export interface DataFlowControlMatrixRow {
  readonly controlPoint: string;
  readonly dataFlowStep: string;
  readonly mitigatedRisk: string;
  readonly evidenceId: string | null;
  readonly state: "CONTROL_IDENTIFIED" | "NOT_ASSESSED";
}

export interface SamplingEntry {
  readonly populationDomain: string;
  readonly populationSize: number;
  readonly sampleSize: number;
  readonly selectionMethod: string;
  readonly selectedItemIds: readonly string[];
  readonly rationale: string;
  readonly state: "OPERATOR_PROPOSED" | "NOT_ASSESSED";
}

export interface SiteVisitReadiness {
  readonly state: "OPERATOR_READY_FOR_SITE_VISIT" | "INCOMPLETE" | "NOT_ASSESSED";
  readonly missingItems: readonly string[];
}

export interface CorrectiveActionClosureRow {
  readonly actionId: string;
  readonly reference: string;
  readonly state: "OPEN" | "IN_PROGRESS" | "CLOSED" | "PENDING_EXTERNAL";
  readonly basis: string;
}

export interface IndependentReviewHandover {
  readonly state: "READY_FOR_VERIFIER_HANDOVER" | "NOT_READY" | "NOT_ASSESSED";
  readonly items: ReadonlyArray<{ readonly item: string; readonly ready: boolean }>;
}

export interface MaterialityWorkpaper {
  readonly goodIndex: number;
  readonly cnCode: string;
  readonly specificEmbeddedEmissions: string;
  readonly planningThresholdRate: string;
  readonly threshold: string;
  readonly regulatoryBasis: string;
  readonly calculationBasis: string;
  readonly expertJudgement: string;
  readonly verifierStatus: MaterialityVerifierStatus;
}

export interface VerifierPreparationModel {
  readonly inherentRiskRegister: readonly RiskRegisterEntry[];
  readonly controlRiskRegister: readonly RiskRegisterEntry[];
  readonly detectionRiskAssessment: readonly RiskRegisterEntry[];
  readonly misstatementSusceptibility: readonly MisstatementSusceptibilityEntry[];
  readonly nonConformityRisk: readonly NonConformityRiskEntry[];
  readonly dataFlowControlMatrix: readonly DataFlowControlMatrixRow[];
  readonly samplingPopulation: readonly SamplingEntry[];
  readonly samplingRationale: string;
  readonly sampleSelection: readonly SamplingEntry[];
  readonly siteVisitReadiness: SiteVisitReadiness;
  readonly correctiveActionClosure: readonly CorrectiveActionClosureRow[];
  readonly independentReviewHandover: IndependentReviewHandover;
  readonly materialityWorkpapers: readonly MaterialityWorkpaper[];
  readonly assessmentTimestamp: string;
}

const REGULATORY_BASIS_MATERIALITY =
  "Commission Implementing Regulation (EU) 2025/2547 Annex IV planning requirements; ISO 14064-3:2019 section 5.3 (planning materiality).";

function gradeOf(record: EvidenceRecord | undefined): "A" | "B" | "C" | "D" | "E" {
  if (!record || record.supportStatus === "UNSUPPORTED" || record.supportStatus === "PENDING" || record.reviewStatus !== "APPROVED") return "E";
  const issuer = record.issuer.toLowerCase();
  const docType = record.documentType.toLowerCase();
  if (docType.includes("estimate") || docType.includes("estimation") || docType.includes("assumption")) return "D";
  const independentMarkers = [
    "accredited", "laborator", "authority", "inspectorate", "notary",
    "certification body", "verification body", "utility", "grid operator", "chamber", "registry", "independent",
  ];
  if (independentMarkers.some((marker) => issuer.includes(marker))) return "A";
  if (issuer.includes("supplier")) return "C";
  if (["operator", "plant", "site", "internal", "self"].some((marker) => issuer.includes(marker))) return "B";
  return "D";
}

function highestRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const rank: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, NOT_ASSESSED: -1 };
  const merged = [left, right].filter((level) => level !== "NOT_ASSESSED") as RiskLevel[];
  if (merged.length === 0) return "NOT_ASSESSED";
  return merged.reduce((worst, level) => (rank[level] > rank[worst] ? level : worst));
}

function findEvidence(caseData: AuditReadyCase, evidenceId: string | null | undefined): EvidenceRecord | undefined {
  if (!evidenceId) return undefined;
  return caseData.evidenceRegister.find((record) => record.evidenceId === evidenceId);
}

function evidenceIdFor(caseData: AuditReadyCase, path: string): string | null {
  const datum = getValueAtPath(caseData, path) as { evidenceId?: string } | null | undefined;
  return datum && typeof datum === "object" && datum.evidenceId ? datum.evidenceId : null;
}

function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const record = current as Record<string, unknown>;
      const arr = record[match[1]!];
      current = Array.isArray(arr) ? arr[parseInt(match[2]!, 10)] : undefined;
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

const SOURCE_TYPE_TO_RISK: Record<string, RiskLevel> = {
  PRIMARY: "LOW",
  ESTIMATED: "HIGH",
  DEFAULT: "HIGH",
  SECONDARY: "MODERATE",
};

/** 1-5. Risk registers. Every domain is assessed or explicitly NOT_ASSESSED. */
function deriveRiskRegisters(caseData: AuditReadyCase): {
  inherent: RiskRegisterEntry[];
  control: RiskRegisterEntry[];
  detection: RiskRegisterEntry[];
  misstatement: MisstatementSusceptibilityEntry[];
  nonConformity: NonConformityRiskEntry[];
} {
  const domains: Array<{ id: string; path: string; description: string }> = [
    { id: "DOM_DIRECT_EMISSIONS", path: "directEmissions", description: "Installation direct emissions activity data" },
    { id: "DOM_ELECTRICITY", path: "electricityConsumed", description: "Electricity consumption activity data" },
    { id: "DOM_GRID_FACTOR", path: "gridEmissionFactor", description: "Grid emission factor selection" },
    { id: "DOM_GOODS", path: "goods", description: "CN-coded goods population, production volumes and allocation shares" },
    { id: "DOM_PRECURSORS", path: "precursors", description: "Precursor quantities and embedded emissions" },
    { id: "DOM_CARBON_PRICE", path: "carbonPriceRecords", description: "Carbon price paid records (Article 9)" },
    { id: "DOM_EVIDENCE", path: "evidenceRegister", description: "Evidence register integrity and linkage" },
  ];

  const inherent: RiskRegisterEntry[] = [];
  const control: RiskRegisterEntry[] = [];
  const detection: RiskRegisterEntry[] = [];
  const misstatement: MisstatementSusceptibilityEntry[] = [];

  for (const domain of domains) {
    const datumValue = getValueAtPath(caseData, domain.path);

    const sourceType = Array.isArray(datumValue)
      ? Array.isArray(datumValue) && datumValue.length > 0
        ? (datumValue[0] as { sourceType?: string } | undefined)?.sourceType
        : undefined
      : (datumValue as { sourceType?: string } | undefined)?.sourceType;

    const evidenceId = evidenceIdFor(caseData, domain.path);
    const evidence = findEvidence(caseData, evidenceId);
    const grade = gradeOf(evidence);

    const inherentLevel: RiskLevel = sourceType
      ? (SOURCE_TYPE_TO_RISK[sourceType] ?? "MODERATE")
      : grade === "A" || grade === "B"
        ? "LOW"
        : grade === "C"
          ? "MODERATE"
          : grade === "D" || grade === "E"
            ? "HIGH"
            : "NOT_ASSESSED";
    const controlLevel: RiskLevel = !evidence
      ? "HIGH"
      : evidence.reviewStatus !== "APPROVED"
        ? "HIGH"
        : evidence.supportStatus === "PARTIALLY_SUPPORTED"
          ? "MODERATE"
          : evidence.malwareScanStatus !== "CLEAN"
            ? "HIGH"
            : "LOW";

    inherent.push({
      riskId: `IR-${domain.id}`,
      register: "INHERENT",
      riskDescription: `Inherent risk of material misstatement in ${domain.description}`,
      affectedDataDomain: domain.id,
      likelihood: inherentLevel,
      impact: domain.id === "DOM_GOODS" || domain.id === "DOM_DIRECT_EMISSIONS" ? "HIGH" : "MODERATE",
      combined: inherentLevel,
      mitigatingControl: sourceType === "ESTIMATED" ? "Estimate requires accepted methodology decision" : "Primary measured data with documentary evidence",
      assessmentState: inherentLevel === "NOT_ASSESSED" ? "NOT_ASSESSED" : "ASSESSED",
    });

    control.push({
      riskId: `CR-${domain.id}`,
      register: "CONTROL",
      riskDescription: `Operator control over ${domain.description}`,
      affectedDataDomain: domain.id,
      likelihood: controlLevel,
      impact: domain.id === "DOM_EVIDENCE" ? "HIGH" : "MODERATE",
      combined: controlLevel,
      mitigatingControl: "Evidence review gate: APPROVED + SUPPORTED + CLEAN + hashed linkage",
      assessmentState: "ASSESSED",
    });

    const detectionLevel = highestRisk(inherentLevel, controlLevel);
    detection.push({
      riskId: `DR-${domain.id}`,
      register: "DETECTION",
      riskDescription: `Residual detection risk for ${domain.description}`,
      affectedDataDomain: domain.id,
      likelihood: detectionLevel,
      impact: domain.id === "DOM_GOODS" || domain.id === "DOM_DIRECT_EMISSIONS" ? "HIGH" : "MODERATE",
      combined: detectionLevel,
      mitigatingControl: detectionLevel === "HIGH" ? "Escalate to verifier planning: sampling, recalculation or physical inspection" : "Routine verifier planning",
      assessmentState: detectionLevel === "NOT_ASSESSED" ? "NOT_ASSESSED" : "ASSESSED",
    });

    misstatement.push({
      domain: domain.id,
      susceptibility: detectionLevel,
      basis: detectionLevel === "HIGH"
        ? "High residual detection risk — misstatement susceptibility elevated; verifier sampling required."
        : detectionLevel === "MODERATE"
          ? "Moderate residual detection risk — corroborative evidence recommended."
          : "Low residual detection risk — corroborated by primary measured data.",
    });
  }

  // Non-conformity risk per requirement area.
  const approvedEvidenceCount = caseData.evidenceRegister.filter(
    (record) => record.reviewStatus === "APPROVED" && record.supportStatus === "SUPPORTED" && record.malwareScanStatus === "CLEAN"
  ).length;
  const acceptedDecisions = caseData.methodologyDecisions.filter((decision) => decision.reviewStatus === "ACCEPTED").length;
  const nonConformity: NonConformityRiskEntry[] = [
    {
      requirementArea: "MONITORING_PLAN",
      risk: acceptedDecisions === caseData.methodologyDecisions.length && caseData.methodologyDecisions.length > 0 ? "LOW" : caseData.methodologyDecisions.some((d) => d.reviewStatus === "REVIEW_REQUIRED") ? "HIGH" : "MODERATE",
      basis: caseData.methodologyDecisions.length > 0 ? `${acceptedDecisions}/${caseData.methodologyDecisions.length} methodology decision(s) accepted` : "No methodology decisions recorded — monitoring-plan conformance not assessable",
    },
    {
      requirementArea: "EVIDENCE",
      risk: caseData.evidenceRegister.length === 0
        ? "HIGH"
        : approvedEvidenceCount === caseData.evidenceRegister.length && caseData.evidenceRegister.length > 0
          ? "LOW"
          : caseData.evidenceRegister.some((e) => e.malwareScanStatus === "INFECTED" || e.reviewStatus === "REJECTED")
            ? "HIGH"
            : "MODERATE",
      basis: `${approvedEvidenceCount}/${caseData.evidenceRegister.length} approved, supported and clean evidence record(s)`,
    },
    {
      requirementArea: "CALCULATION",
      risk: caseData.calculationTrace.length > 0 ? "LOW" : "MODERATE",
      basis: caseData.calculationTrace.length > 0 ? `${caseData.calculationTrace.length} trace node(s) recorded` : "Calculation trace not yet recorded",
    },
    {
      requirementArea: "ALLOCATION",
      risk: caseData.goods.length <= 1 ? "LOW" : caseData.goods.every((good) => good.allocationShare?.value) ? "LOW" : "HIGH",
      basis: caseData.goods.length <= 1 ? "Single good — no allocation split" : caseData.goods.length > 1 && caseData.goods.every((good) => good.allocationShare?.value) ? "Per-good allocation shares recorded" : "Allocation shares missing for multi-good case",
    },
  ];

  return { inherent, control, detection, misstatement, nonConformity };
}

/** 6. Data-flow control matrix. */
function deriveDataFlowControls(caseData: AuditReadyCase): DataFlowControlMatrixRow[] {
  const rows: DataFlowControlMatrixRow[] = [
    {
      controlPoint: "INPUT_CAPTURE",
      dataFlowStep: "Operator activity data entry",
      mitigatedRisk: "Transcription and unit errors",
      evidenceId: evidenceIdFor(caseData, "directEmissions"),
      state: "CONTROL_IDENTIFIED",
    },
    {
      controlPoint: "EVIDENCE_LINKAGE",
      dataFlowStep: "Evidence registration and field linkage",
      mitigatedRisk: "Unlinked, unapproved or tampered evidence",
      evidenceId: caseData.evidenceRegister[0]?.evidenceId ?? null,
      state: "CONTROL_IDENTIFIED",
    },
    {
      controlPoint: "CALCULATION_GATE",
      dataFlowStep: "Server-side deterministic calculation",
      mitigatedRisk: "Formula drift, rounding or unit mismatch",
      evidenceId: null,
      state: "CONTROL_IDENTIFIED",
    },
    {
      controlPoint: "QUALITY_CONTROL",
      dataFlowStep: "Automated QC and seal preconditions",
      mitigatedRisk: "Silent gate bypass or partial support",
      evidenceId: null,
      state: "CONTROL_IDENTIFIED",
    },
  ];
  return rows.map((row) => ({ ...row, evidenceId: row.evidenceId ?? null }));
}

/** 7-9. Sampling population, rationale and selection. */
function deriveSampling(caseData: AuditReadyCase): {
  population: SamplingEntry[];
  rationale: string;
  selection: SamplingEntry[];
} {
  const goodsPopulation = caseData.goods.length;
  const evidencePopulation = caseData.evidenceRegister.length;
  const tracePopulation = caseData.calculationTrace.length;

  const sampleSizeFor = (population: number, minimum: number): number =>
    population <= minimum ? population : Math.min(population, Math.max(minimum, Math.ceil(population / 3)));

  const goodsSample = sampleSizeFor(goodsPopulation, 1);
  const evidenceSample = sampleSizeFor(evidencePopulation, Math.min(5, Math.max(1, evidencePopulation)));

  const population: SamplingEntry[] = [
    {
      populationDomain: "GOODS",
      populationSize: goodsPopulation,
      sampleSize: goodsSample,
      selectionMethod: goodsPopulation === 0 ? "NOT_ASSESSED" : "Every declared good plus all precursor-linked goods; stratify by production share",
      selectedItemIds: goodsPopulation === 0 ? [] : caseData.goods.map((good) => String(good.cnCode.value || "")).filter(Boolean),
      rationale: "Goods form the reporting unit for specific embedded emissions; population equals declared CN-coded goods.",
      state: goodsPopulation > 0 ? "OPERATOR_PROPOSED" : "NOT_ASSESSED",
    },
    {
      populationDomain: "EVIDENCE",
      populationSize: evidencePopulation,
      sampleSize: evidenceSample,
      selectionMethod: evidencePopulation === 0 ? "NOT_ASSESSED" : "All material-requirement evidence plus random corroboration sample",
      selectedItemIds: caseData.evidenceRegister.map((record) => record.evidenceId),
      rationale: "Evidence population covers every material requirement; sampling targets material rows and cross-cutting integrity checks.",
      state: evidencePopulation > 0 ? "OPERATOR_PROPOSED" : "NOT_ASSESSED",
    },
    {
      populationDomain: "CALCULATION_TRACE",
      populationSize: tracePopulation,
      sampleSize: tracePopulation,
      selectionMethod: tracePopulation === 0 ? "NOT_ASSESSED" : "100% recalculation replay",
      selectedItemIds: caseData.calculationTrace.map((node) => node.calculationHash),
      rationale: "The sealed calculation trace is deterministic and replayable; verifier recomputation covers 100% of nodes.",
      state: tracePopulation > 0 ? "OPERATOR_PROPOSED" : "NOT_ASSESSED",
    },
  ];

  const rationale =
    "Operator-proposed sampling for verifier planning. Population definitions, sample sizes and selection methods are documented per domain; " +
    "the verifier confirms, amends or replaces the operator proposal during planning. Sampling never substitutes for completeness of sealed artefacts.";

  return { population, rationale, selection: population };
}

/** 10. Site-visit readiness. */
function deriveSiteVisitReadiness(caseData: AuditReadyCase): SiteVisitReadiness {
  const items: Array<{ name: string; ready: boolean }> = [
    { name: "Monitoring plan and system boundary documented", ready: Boolean(caseData.installation.systemBoundaries?.trim()) },
    { name: "Installation diagram evidence", ready: Boolean(caseData.installation.installationDiagramEvidenceId) },
    { name: "Monitoring plan identifier and version", ready: Boolean(caseData.installation.monitoringPlanId?.value && caseData.installation.monitoringPlanVersion?.value) },
    { name: "Metering and calibration evidence", ready: caseData.evidenceRegister.some((record) => /calibration|meter/i.test(record.documentType)) },
    { name: "Interview and document pull list", ready: caseData.evidenceRegister.length > 0 },
  ];
  const missingItems = items.filter((item) => !item.ready).map((item) => item.name);
  const state = missingItems.length === 0 ? "OPERATOR_READY_FOR_SITE_VISIT" : "INCOMPLETE";
  return { state, missingItems };
}

/** 11. Corrective action closure status. */
function deriveCorrectiveActionClosure(caseData: AuditReadyCase): CorrectiveActionClosureRow[] {
  const rows: CorrectiveActionClosureRow[] = [];
  for (const gap of caseData.gapAssessment) {
    const state = gap.resolutionStatus === "RESOLVED" || gap.resolutionStatus === "CORRECTED" || gap.resolutionStatus === "RECALCULATED" || gap.resolutionStatus === "REVIEWED"
      ? "CLOSED"
      : gap.resolutionStatus === "IN_PROGRESS" || gap.resolutionStatus === "EVIDENCE_REQUESTED"
        ? "IN_PROGRESS"
        : "OPEN";
    rows.push({
      actionId: `CA-GAP-${gap.gapId}`,
      reference: gap.requirement || gap.issueType || "gap record",
      state,
      basis: gap.whyItMatters || "Gap registered without message",
    });
  }
  for (const decision of caseData.methodologyDecisions) {
    if (decision.reviewStatus === "REVIEW_REQUIRED") {
      rows.push({
        actionId: `CA-METHOD-${decision.decisionId}`,
        reference: decision.topic,
        state: "PENDING_EXTERNAL",
        basis: "Methodology decision requires internal review before acceptance",
      });
    }
  }
  return rows;
}

/** 12. Independent review handover. */
function deriveIndependentReviewHandover(caseData: AuditReadyCase): IndependentReviewHandover {
  const verifierReserved = caseData.verifierReserved;
  const verifierFieldsEmpty =
    !verifierReserved || Object.keys(verifierReserved).every((key) => {
      const value = (verifierReserved as Record<string, unknown>)[key];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
  const items: Array<{ item: string; ready: boolean }> = [
    { item: "Case identity and scope complete", ready: Boolean(caseData.caseId && caseData.ownerId) },
    { item: "Reporting period within definitive eligibility", ready: Boolean(caseData.reportingPeriod?.year?.value) },
    { item: "Operator and preparer sign-offs", ready: caseData.operatorSignOffs.length > 0 },
    { item: "Calculation root hash present", ready: caseData.calculationTrace.length > 0 },
    { item: "Evidence register populated", ready: caseData.evidenceRegister.length > 0 },
    { item: "Verifier-reserved fields empty (verifier to complete)", ready: verifierFieldsEmpty },
  ];
  const readyCount = items.filter((item) => item.ready).length;
  return {
    state: readyCount === items.length ? "READY_FOR_VERIFIER_HANDOVER" : "NOT_READY",
    items,
  };
}

/** Per-good materiality workpapers (FAZ 6). */
function deriveMaterialityWorkpapers(
  caseData: AuditReadyCase,
  calculation: DossierCalculationResult | undefined,
  planningRate: number
): MaterialityWorkpaper[] {
  if (!calculation || calculation.goods.length === 0) return [];
  const rate = new Decimal(String(planningRate));
  return calculation.goods.map((good) => {
    const specific = new Decimal(good.specificEmbeddedEmissions);
    const threshold = specific.times(rate).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const verifierApproved = Boolean(
      caseData.verifierReserved?.materialityLevelPerGood?.[String(good.goodIndex)] !== undefined
    );
    return {
      goodIndex: good.goodIndex,
      cnCode: good.cnCode,
      specificEmbeddedEmissions: good.specificEmbeddedEmissions,
      planningThresholdRate: rate.times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString(),
      threshold: threshold.toString(),
      regulatoryBasis: REGULATORY_BASIS_MATERIALITY,
      calculationBasis: `Specific embedded emissions × documented planning threshold rate (${rate.times(100).toString()}%), rounded to 6 decimal places.`,
      expertJudgement:
        "Operator-prepared planning materiality for verifier planning only. The verifier confirms, revises or replaces the threshold during planning; no assurance conclusion is implied.",
      verifierStatus: verifierApproved
        ? "VERIFIER_APPROVED"
        : "PROVISIONAL_FOR_VERIFIER_PLANNING",
    };
  });
}

export function buildVerifierPreparationModel(params: {
  caseData: AuditReadyCase;
  calculation?: DossierCalculationResult;
  planningRate?: number;
  assessmentTimestamp?: string;
}): VerifierPreparationModel {
  const { caseData, calculation, assessmentTimestamp } = params;
  const planningRate = params.planningRate ?? 0.05;
  if (!Number.isFinite(planningRate) || planningRate <= 0 || planningRate >= 1) {
    throw new Error("VERIFIER_PREPARATION_INVALID_PLANNING_RATE");
  }
  const risk = deriveRiskRegisters(caseData);
  const sampling = deriveSampling(caseData);

  return {
    inherentRiskRegister: risk.inherent,
    controlRiskRegister: risk.control,
    detectionRiskAssessment: risk.detection,
    misstatementSusceptibility: risk.misstatement,
    nonConformityRisk: risk.nonConformity,
    dataFlowControlMatrix: deriveDataFlowControls(caseData),
    samplingPopulation: sampling.population,
    samplingRationale: sampling.rationale,
    sampleSelection: sampling.selection,
    siteVisitReadiness: deriveSiteVisitReadiness(caseData),
    correctiveActionClosure: deriveCorrectiveActionClosure(caseData),
    independentReviewHandover: deriveIndependentReviewHandover(caseData),
    materialityWorkpapers: deriveMaterialityWorkpapers(caseData, calculation, planningRate),
    assessmentTimestamp: assessmentTimestamp ?? new Date().toISOString(),
  };
}
