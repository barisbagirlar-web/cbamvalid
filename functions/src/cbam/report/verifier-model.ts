import { Decimal } from "decimal.js";
import type { AuditReadyCase, EvidenceRecord, InputDatum } from "../schema";
import type { DossierCalculationResult, GoodCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import { getDefinitiveLegalSources, type LegalSourceRecord } from "../registry/legal-sources";
import { getActiveRuleset, VERIFICATION_MATERIALITY_RATE } from "../registry/rulesets";
import { assertSectorSealable, type CbamSector, type SectorConfig } from "../sectors/sector-adapter";

export type AutomatedReadinessStatus =
  | "READY_FOR_INDEPENDENT_VERIFICATION"
  | "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION";

export type VerifierReviewStatus = "NOT_REVIEWED" | "IN_REVIEW" | "ACCEPTED" | "REJECTED";

export interface VerifierGoodRow {
  goodIndex: number;
  cnCode: string;
  sector: string;
  productionVolume: string;
  productionUnit: string;
  allocationShare: string;
  allocatedEmbeddedEmissions: string;
  specificEmbeddedEmissions: string;
  materialityRate: string;
  materialityThresholdSpecific: string;
  traceCalculationId: string;
}

export interface EvidenceCoverageSummary {
  totalEvidenceFiles: number;
  approvedCleanEvidenceFiles: number;
  linkedInputCount: number;
  linkedCalculationCount: number;
  uniqueFileHashes: number;
  duplicateHashCount: number;
  coverageRate: string;
}

export interface QualityControlSummary {
  total: number;
  passed: number;
  warnings: number;
  blockers: number;
  notApplicable: number;
}

export interface MonitoringPlanRequirement {
  requirementId: string;
  requirement: string;
  status: "DOCUMENTED" | "GAP";
  evidence: string;
}

export interface VerifierPackageModel {
  reportId: string;
  caseId: string;
  releaseVersion: number;
  generatedAt: string;
  documentClassification: "CONFIDENTIAL - VERIFIER PREPARATION WORKSPACE";
  automatedReadiness: AutomatedReadinessStatus;
  independentVerifierStatus: VerifierReviewStatus;
  disclaimer: string;
  ruleset: {
    version: string;
    name: string;
    sourceRegistryVersion: string;
    sourceHash: string;
    materialityRate: string;
  };
  identity: {
    importer: string;
    eori: string;
    exporterOperator: string;
    installation: string;
    country: string;
    productionRoute: string;
    reportingPeriod: string;
    systemBoundary: string;
  };
  totals: {
    installationDirectEmissions: string;
    electricityIndirectEmissions: string;
    precursorDirectEmissions: string;
    precursorIndirectEmissions: string;
    totalDirectEmissions: string;
    totalIndirectEmissions: string;
    totalEmbeddedEmissions: string;
    productionVolume: string;
    aggregateSpecificEmbeddedEmissions: string;
    allocationShareTotal: string;
    allocationReconciliationDelta: string;
    eligibleCertificateReduction: string;
  };
  goods: VerifierGoodRow[];
  qualitySummary: QualityControlSummary;
  qualityControls: QualityControlResult[];
  evidenceSummary: EvidenceCoverageSummary;
  monitoringPlan: MonitoringPlanRequirement[];
  legalSources: readonly LegalSourceRecord[];
  sectorMethodologies: SectorConfig[];
  methodologyDecisionCount: number;
  acceptedMethodologyDecisionCount: number;
  calculationTraceCount: number;
  calculationRootHash: string;
}

function decimal(value: string, field: string): Decimal {
  try {
    const result = new Decimal(value);
    if (!result.isFinite()) throw new Error("not finite");
    return result;
  } catch {
    throw new Error(`VERIFIER_MODEL_DECIMAL_INVALID:${field}`);
  }
}

function datumDocumented(datum: InputDatum): boolean {
  return datum.value !== null && datum.value !== "" && datum.value !== undefined;
}

function evidenceApprovedClean(evidence: EvidenceRecord): boolean {
  return (
    evidence.reviewStatus === "APPROVED" &&
    evidence.malwareScanStatus === "CLEAN" &&
    ["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_REQUIRED"].includes(evidence.supportStatus)
  );
}

function qualitySummary(controls: QualityControlResult[]): QualityControlSummary {
  return {
    total: controls.length,
    passed: controls.filter((item) => item.status === "PASS").length,
    warnings: controls.filter((item) => item.status === "WARNING").length,
    blockers: controls.filter((item) => item.status === "BLOCKER").length,
    notApplicable: controls.filter((item) => item.status === "NOT_APPLICABLE").length,
  };
}

function evidenceSummary(caseData: AuditReadyCase): EvidenceCoverageSummary {
  const approved = caseData.evidenceRegister.filter(evidenceApprovedClean);
  const hashes = approved.map((item) => item.fileHash.toLowerCase());
  const uniqueHashes = new Set(hashes);
  const linkedInputs = new Set(approved.flatMap((item) => item.linkedInputs));
  const linkedCalculations = new Set(approved.flatMap((item) => item.linkedCalculations));

  const requiredInputCount =
    3 +
    caseData.goods.length * 2 +
    (caseData.goods.length > 1 ? caseData.goods.length : 0) +
    caseData.precursors.length * 3;
  const coverage = requiredInputCount === 0
    ? new Decimal(0)
    : Decimal.min(new Decimal(1), new Decimal(linkedInputs.size).dividedBy(requiredInputCount));

  return {
    totalEvidenceFiles: caseData.evidenceRegister.length,
    approvedCleanEvidenceFiles: approved.length,
    linkedInputCount: linkedInputs.size,
    linkedCalculationCount: linkedCalculations.size,
    uniqueFileHashes: uniqueHashes.size,
    duplicateHashCount: hashes.length - uniqueHashes.size,
    coverageRate: coverage.times(100).toDecimalPlaces(2).toString(),
  };
}

function goodRow(good: GoodCalculationResult): VerifierGoodRow {
  const specific = decimal(good.specificEmbeddedEmissions, `goods.${good.goodIndex}.specificEmbeddedEmissions`);
  const threshold = specific.times(VERIFICATION_MATERIALITY_RATE).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
  return {
    goodIndex: good.goodIndex,
    cnCode: good.cnCode,
    sector: good.sector,
    productionVolume: good.productionVolume,
    productionUnit: good.productionUnit,
    allocationShare: good.allocationShare,
    allocatedEmbeddedEmissions: good.allocatedEmbeddedEmissions,
    specificEmbeddedEmissions: good.specificEmbeddedEmissions,
    materialityRate: new Decimal(VERIFICATION_MATERIALITY_RATE).times(100).toString(),
    materialityThresholdSpecific: threshold.toString(),
    traceCalculationId: good.traceCalculationId,
  };
}

function monitoringPlan(caseData: AuditReadyCase, calculation: DossierCalculationResult): MonitoringPlanRequirement[] {
  const acceptedMethodology = caseData.methodologyDecisions.filter((item) => item.reviewStatus === "ACCEPTED");
  const approvedEvidence = caseData.evidenceRegister.filter(evidenceApprovedClean);
  const requirements: Array<[string, string, boolean, string]> = [
    ["MP-01", "Monitoring-plan date, version and responsible operator identity", caseData.version > 0 && Boolean(caseData.ownerId), `Case version ${caseData.version}; owner recorded`],
    ["MP-02", "Installation description and production processes", datumDocumented(caseData.installation.name) && datumDocumented(caseData.installation.productionRoute), String(caseData.installation.productionRoute.value || "Not documented")],
    ["MP-03", "CN-coded goods and functional production units", caseData.goods.length > 0 && caseData.goods.every((item) => /^\d{8}$/.test(String(item.cnCode.value || "")) && datumDocumented(item.productionVolume)), `${caseData.goods.length} good(s) recorded`],
    ["MP-04", "System boundaries and directly connected processes", Boolean(caseData.installation.systemBoundaries?.trim()), caseData.installation.systemBoundaries || "Not documented"],
    ["MP-05", "Source streams, emission sources and measurement methods", datumDocumented(caseData.directEmissions) && datumDocumented(caseData.electricityConsumed), `${caseData.precursors.length} precursor(s); direct and electricity inputs recorded`],
    ["MP-06", "Data-source hierarchy, corroboration and control activities", approvedEvidence.length > 0 && approvedEvidence.every((item) => item.linkedInputs.length > 0), `${approvedEvidence.length} approved and clean evidence file(s)`],
    ["MP-07", "Calculation methods, conversions and rounding", calculation.trace.length > 0 && calculation.trace.every((item) => /^[a-f0-9]{64}$/i.test(item.calculationHash)), `${calculation.trace.length} hashed trace node(s)`],
    ["MP-08", "Goods allocation method and reconciliation", decimal(calculation.allocationReconciliationDelta, "allocationReconciliationDelta").lte("0.000001"), `Allocation delta ${calculation.allocationReconciliationDelta}`],
    ["MP-09", "Precursor scope and embedded emissions treatment", caseData.precursors.length > 0 || acceptedMethodology.some((item) => item.topic === "PRECURSOR_SCOPE"), caseData.precursors.length > 0 ? `${caseData.precursors.length} precursor(s)` : "Accepted no-precursor decision"],
    ["MP-10", "Methodology deviations, estimates and technical justifications", acceptedMethodology.length === caseData.methodologyDecisions.length, `${acceptedMethodology.length}/${caseData.methodologyDecisions.length} methodology decision(s) accepted`],
    ["MP-11", "Per-good materiality assessment", calculation.goods.length > 0, `${VERIFICATION_MATERIALITY_RATE * 100}% per-good specific-emissions threshold`],
    ["MP-12", "Evidence integrity and immutable calculation provenance", approvedEvidence.length > 0 && /^[a-f0-9]{64}$/i.test(calculation.calculationRootHash), `Calculation root ${calculation.calculationRootHash}`],
  ];

  return requirements.map(([requirementId, requirement, documented, evidence]) => ({
    requirementId,
    requirement,
    status: documented ? "DOCUMENTED" : "GAP",
    evidence,
  }));
}

function sectorMethodologies(caseData: AuditReadyCase): SectorConfig[] {
  const unique = new Set(caseData.goods.map((item) => item.sector));
  return [...unique].map((sector) => assertSectorSealable(sector as CbamSector));
}

export function buildVerifierPackageModel(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
}): VerifierPackageModel {
  const year = Number(params.caseData.reportingPeriod.year.value);
  if (!Number.isInteger(year) || year < 2026) throw new Error("VERIFIER_MODEL_REPORTING_YEAR_INVALID");
  const ruleset = getActiveRuleset(new Date(Date.UTC(year, 0, 1)));
  const summary = qualitySummary(params.controls);
  const plan = monitoringPlan(params.caseData, params.calculation);
  const planGaps = plan.filter((item) => item.status === "GAP").length;
  const automatedReadiness: AutomatedReadinessStatus =
    summary.blockers === 0 && planGaps === 0
      ? "READY_FOR_INDEPENDENT_VERIFICATION"
      : "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION";

  return {
    reportId: params.reportId,
    caseId: params.caseData.caseId || "",
    releaseVersion: params.releaseVersion,
    generatedAt: params.generatedAt,
    documentClassification: "CONFIDENTIAL - VERIFIER PREPARATION WORKSPACE",
    automatedReadiness,
    independentVerifierStatus: "NOT_REVIEWED",
    disclaimer:
      "This package supports preparation for independent accredited verification. It is not a verification opinion, accreditation decision, customs decision, CBAM Registry submission or acceptance guarantee.",
    ruleset: {
      version: ruleset.version,
      name: ruleset.name,
      sourceRegistryVersion: ruleset.sourceRegistryVersion,
      sourceHash: ruleset.sourceHash,
      materialityRate: new Decimal(VERIFICATION_MATERIALITY_RATE).times(100).toString(),
    },
    identity: {
      importer: String(params.caseData.importerIdentity.legalName.value || ""),
      eori: String(params.caseData.importerIdentity.eoriNumber.value || ""),
      exporterOperator: String(params.caseData.exporterIdentity.legalName.value || ""),
      installation: String(params.caseData.installation.name.value || ""),
      country: String(params.caseData.installation.country.value || ""),
      productionRoute: String(params.caseData.installation.productionRoute.value || ""),
      reportingPeriod: `${params.caseData.reportingPeriod.year.value}-${params.caseData.reportingPeriod.quarter.value || "ANNUAL"}`,
      systemBoundary: params.caseData.installation.systemBoundaries || "",
    },
    totals: {
      installationDirectEmissions: params.calculation.installationDirectEmissions,
      electricityIndirectEmissions: params.calculation.electricityIndirectEmissions,
      precursorDirectEmissions: params.calculation.precursorDirectEmissions,
      precursorIndirectEmissions: params.calculation.precursorIndirectEmissions,
      totalDirectEmissions: params.calculation.totalDirectEmissions,
      totalIndirectEmissions: params.calculation.totalIndirectEmissions,
      totalEmbeddedEmissions: params.calculation.totalEmbeddedEmissions,
      productionVolume: params.calculation.productionVolume,
      aggregateSpecificEmbeddedEmissions: params.calculation.specificEmbeddedEmissions,
      allocationShareTotal: params.calculation.allocationShareTotal,
      allocationReconciliationDelta: params.calculation.allocationReconciliationDelta,
      eligibleCertificateReduction: params.calculation.eligibleCertificateReduction,
    },
    goods: params.calculation.goods.map(goodRow),
    qualitySummary: summary,
    qualityControls: params.controls,
    evidenceSummary: evidenceSummary(params.caseData),
    monitoringPlan: plan,
    legalSources: getDefinitiveLegalSources(),
    sectorMethodologies: sectorMethodologies(params.caseData),
    methodologyDecisionCount: params.caseData.methodologyDecisions.length,
    acceptedMethodologyDecisionCount: params.caseData.methodologyDecisions.filter((item) => item.reviewStatus === "ACCEPTED").length,
    calculationTraceCount: params.calculation.trace.length,
    calculationRootHash: params.calculation.calculationRootHash,
  };
}
