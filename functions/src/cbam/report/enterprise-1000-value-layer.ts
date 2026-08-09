import crypto from "node:crypto";
import { Decimal } from "decimal.js";
import type { AuditReadyCase, EvidenceRecord } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import { assessEvidenceQuality } from "../validation/evidence-quality";
import { generateFindingsAndActions } from "../validation/findings-engine";
import { assessReadiness, getReportingPeriodAssessment } from "../validation/readiness-score";
import { buildRegistryTemplateMapping } from "../registry/registry-template-mapping";
import { VERIFICATION_MATERIALITY_RATE } from "../registry/rulesets";
import { getComplianceCalendarState } from "../compliance/compliance-calendar";
import { buildVerifierPackageModel } from "./verifier-model";
import { buildEnterprisePdf, type EnterprisePdfSection, type EnterpriseReadinessStatus } from "./enterprise-pdf";
import type { PackageArtifact } from "./verifier-package-builder";

export type EvidenceVerifiabilityState =
  | "INDEPENDENTLY_VERIFIABLE"
  | "STRUCTURALLY_VERIFIABLE"
  | "WEAK"
  | "UNVERIFIABLE";

export interface EvidenceVerifiabilityRow {
  evidenceId: string;
  fileName: string;
  grade: string;
  gradeBasis: string;
  verifiabilityState: EvidenceVerifiabilityState;
  verifiabilityBasis: string;
  metadataIntegrity: "PASS" | "FAIL";
  authorityTrace: string;
  externalCredentialReference: string;
  warning: string;
}

export interface EnterpriseScenarioRow {
  scenarioId: string;
  label: string;
  totalEmbeddedEmissions: string;
  aggregateIntensity: string;
  intensityDelta: string;
  intensityDeltaPercent: string;
}

export interface MaterialitySimulationRow {
  goodIndex: number;
  cnCode: string;
  specificEmbeddedEmissions: string;
  planningThresholdRate: string;
  planningThreshold: string;
  gridFactorPlus10DeltaSpecific: string;
  gridFactorThresholdUtilizationPercent: string;
  productionMinus10DeltaSpecific: string;
  productionThresholdUtilizationPercent: string;
  proximityState: "BELOW_PLANNING_THRESHOLD" | "NEAR_PLANNING_THRESHOLD" | "ABOVE_PLANNING_THRESHOLD";
}

export interface HandoverDraft {
  draftId: string;
  title: string;
  purpose: string;
  preparedText: string;
  completionState: "PREPARED" | "NEEDS_INPUT";
  missingInputs: string[];
}

export interface Enterprise1000Model {
  status: EnterpriseReadinessStatus;
  preparationScore: string;
  scoreFormula: string;
  statusReasons: string[];
  reportingPeriod: ReturnType<typeof getReportingPeriodAssessment>;
  findings: ReturnType<typeof generateFindingsAndActions>["findings"];
  correctiveActions: ReturnType<typeof generateFindingsAndActions>["correctiveActions"];
  evidenceVerifiability: EvidenceVerifiabilityRow[];
  scenarios: EnterpriseScenarioRow[];
  materialitySimulation: MaterialitySimulationRow[];
  handoverDrafts: HandoverDraft[];
  openQuestions: string[];
  closureConditions: string[];
  primaryDocumentRoles: Array<{ fileName: string; uniqueRole: string }>;
}

const PRIMARY_DOCUMENT_ROLES = [
  {
    fileName: "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf",
    uniqueRole: "Executive verifier-preparation decision dossier. It is the single source for enterprise readiness status, preparation score, evidence assurance conclusion and open closure conditions; it does not repeat the full calculation trace.",
  },
  {
    fileName: "Verifier First Meeting & Handover Pack.pdf",
    uniqueRole: "Practical independent-verifier handover pack containing the first-meeting brief, seven prepared handover drafts, open questions and closure conditions. It does not repeat the emissions report.",
  },
  {
    fileName: "Product Scope Assessment.pdf",
    uniqueRole: "Scope-only document covering parties, installation, reporting-period boundary and goods population. Calculation and evidence detail are intentionally excluded.",
  },
  {
    fileName: "CN Code Reasoning.pdf",
    uniqueRole: "Customs classification workpaper limited to CN-code reasoning, linked classification evidence and the customs-decision boundary.",
  },
  {
    fileName: "Required Data Checklist.pdf",
    uniqueRole: "Gap-closure workpaper showing weak or missing evidence, required corrective actions, owners and closure conditions. It is the operational remediation list.",
  },
  {
    fileName: "Installation Monitoring Plan.pdf",
    uniqueRole: "Monitoring-plan workpaper covering source streams, measurement controls, monitoring requirements and evidence basis only.",
  },
  {
    fileName: "Production Process Map.pdf",
    uniqueRole: "End-to-end process and data-flow control map from operator input through evidence, calculation, package sealing and independent review.",
  },
  {
    fileName: "System Boundary Register.pdf",
    uniqueRole: "Boundary workpaper documenting included processes, declared exclusions, functional units and sector-specific verification focus.",
  },
  {
    fileName: "Methodology Decision Log.pdf",
    uniqueRole: "Method-selection record containing selected methods, rejected alternatives, legal or technical basis, evidence and review provenance.",
  },
  {
    fileName: "Embedded Emissions Calculation Annex.pdf",
    uniqueRole: "Reperformance annex containing formulas, trace hashes, deterministic sensitivity scenarios and per-good 5% planning-materiality simulation.",
  },
  {
    fileName: "Operator Emissions Report.pdf",
    uniqueRole: "Operator-prepared emissions statement containing reported totals, per-good emissions, operator sign-offs and carbon-price treatment without duplicating the full formula trace.",
  },
] as const;

const INDEPENDENT_CATEGORIES = new Set([
  "GOVERNMENT_AUTHORITY",
  "CUSTOMS_AUTHORITY",
  "NATIONAL_REGISTRY",
  "GRID_OPERATOR",
  "REGULATED_UTILITY",
  "ACCREDITED_LAB",
  "ACCREDITED_VERIFICATION_BODY",
  "INDEPENDENT_AUDITOR",
]);

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]): Buffer {
  return Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
}

function artifact(path: string, bytes: Buffer, mediaType: string): PackageArtifact {
  return { path, bytes, mediaType };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function dateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calendarClosurePercent(caseData: AuditReadyCase, generatedAt: string): number {
  const start = dateMs(String(caseData.reportingPeriod.startDate?.value || ""));
  const end = dateMs(String(caseData.reportingPeriod.endDate?.value || ""));
  const generated = dateMs(generatedAt);
  if (start === null || end === null || generated === null || end < start) return 0;
  const day = 86_400_000;
  const expected = Math.floor((end - start) / day) + 1;
  const elapsed = Math.floor((Math.min(end, Math.max(start - day, generated)) - start) / day) + 1;
  return clampPercent((Math.max(0, elapsed) / expected) * 100);
}

function deriveEnterpriseStatus(params: {
  caseData: AuditReadyCase;
  generatedAt: string;
}): Pick<Enterprise1000Model, "status" | "preparationScore" | "scoreFormula" | "statusReasons" | "reportingPeriod" | "findings" | "correctiveActions"> {
  const reportingPeriod = getReportingPeriodAssessment(params.caseData, params.generatedAt);
  const readiness = assessReadiness({
    caseData: params.caseData,
    isDraft: false,
    assessmentTimestamp: params.generatedAt,
  });
  const { findings, correctiveActions } = generateFindingsAndActions(
    params.caseData,
    params.generatedAt,
    "PREVIEW"
  );

  const unresolved = findings.filter((finding) => finding.status !== "RESOLVED");
  const blockers = unresolved.filter(
    (finding) =>
      finding.severity === "CRITICAL_BLOCKER" ||
      finding.blocksSealing ||
      finding.blocksVerifierHandover === true
  );
  const conditionalFindings = unresolved.filter(
    (finding) => ["CRITICAL", "MATERIAL", "MAJOR"].includes(finding.severity)
  );

  let status: EnterpriseReadinessStatus;
  if (!reportingPeriod.definitiveAnnualEligible || blockers.length > 0) {
    status = "NOT_READY";
  } else if (conditionalFindings.length > 0 || correctiveActions.some((action) => action.state !== "CLOSED" && action.state !== "PENDING_EXTERNAL")) {
    status = "CONDITIONAL";
  } else {
    status = "READY_FOR_VERIFICATION";
  }

  const canonicalScore = clampPercent(Number(readiness.score));
  const calendarPercent = calendarClosurePercent(params.caseData, params.generatedAt);
  let score = canonicalScore;
  const reasons: string[] = [];

  if (!reportingPeriod.definitiveAnnualEligible) {
    score = Math.min(score, calendarPercent);
    reasons.push(`Reporting period is not definitively eligible as of ${params.generatedAt}; calendar closure is ${calendarPercent.toFixed(2)}%.`);
  }
  if (blockers.length > 0) {
    score = Math.min(score, 69);
    reasons.push(`${blockers.length} unresolved blocker(s) prevent verifier-ready status.`);
  }
  if (status === "CONDITIONAL") {
    score = Math.min(score, 89);
    reasons.push(`${conditionalFindings.length} material or major unresolved finding(s) require closure or verifier challenge.`);
  }
  if (status === "READY_FOR_VERIFICATION") {
    reasons.push("Definitive reporting-period eligibility and all operator-controlled closure gates are satisfied.");
  }

  return {
    status,
    preparationScore: new Decimal(score).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
    scoreFormula: "min(canonical automated score, calendar-period closure when period is still open, blocker cap 69, conditional cap 89). This is a preparation score, not a verification opinion.",
    statusReasons: reasons,
    reportingPeriod,
    findings,
    correctiveActions,
  };
}

export function assessEvidenceVerifiability(record: EvidenceRecord): EvidenceVerifiabilityRow {
  const quality = assessEvidenceQuality(record);
  const metadataIntegrity =
    /^[a-f0-9]{64}$/i.test(record.fileHash) &&
    record.sizeBytes > 0 &&
    Boolean(record.mimeType.trim()) &&
    Boolean(record.issuer.trim()) &&
    Boolean(record.issueDate.trim()) &&
    Number.isFinite(Date.parse(record.uploadTimestamp));
  const authorityTrace = [record.issuerCategory || "NOT_RECORDED", record.documentAuthority || "NOT_RECORDED"].join(" / ");
  const externalCredentialReference = record.accreditationReference?.trim() || record.officialReference?.trim() || "NOT_RECORDED";
  const independentCategory = Boolean(record.issuerCategory && INDEPENDENT_CATEGORIES.has(record.issuerCategory));
  const structuredAuthority = Boolean(record.issuerCategory && record.documentAuthority);
  const serverAssessment = Boolean(record.qualityAssessedBy && record.qualityAssessedAt && record.qualityGrade);

  let verifiabilityState: EvidenceVerifiabilityState;
  if (metadataIntegrity && independentCategory && externalCredentialReference !== "NOT_RECORDED") {
    verifiabilityState = "INDEPENDENTLY_VERIFIABLE";
  } else if (metadataIntegrity && structuredAuthority && serverAssessment) {
    verifiabilityState = "STRUCTURALLY_VERIFIABLE";
  } else if (metadataIntegrity) {
    verifiabilityState = "WEAK";
  } else {
    verifiabilityState = "UNVERIFIABLE";
  }

  const verifiabilityBasis = [
    `SHA256=${metadataIntegrity ? "CHECKED" : "FAILED"}`,
    `bytes=${record.sizeBytes > 0 ? "RECORDED" : "MISSING"}`,
    `issuerAuthority=${authorityTrace}`,
    `externalCredential=${externalCredentialReference}`,
    `serverAssessment=${serverAssessment ? `${record.qualityAssessedBy}@${record.qualityAssessedAt}` : "NOT_RECORDED"}`,
  ].join("; ");

  const warning =
    quality.grade === "PENDING" || ["D", "E"].includes(quality.grade) || ["WEAK", "UNVERIFIABLE"].includes(verifiabilityState)
      ? `WEAK_OR_INCOMPLETE_EVIDENCE: grade=${quality.grade}; verifiability=${verifiabilityState}; complete structured authority metadata and independent reference where available.`
      : "NONE";

  return {
    evidenceId: record.evidenceId,
    fileName: record.fileName,
    grade: quality.grade,
    gradeBasis: quality.basis,
    verifiabilityState,
    verifiabilityBasis,
    metadataIntegrity: metadataIntegrity ? "PASS" : "FAIL",
    authorityTrace,
    externalCredentialReference,
    warning,
  };
}

export function deriveScenarioAnalysis(calculation: DossierCalculationResult): EnterpriseScenarioRow[] {
  const total = new Decimal(calculation.totalEmbeddedEmissions);
  const electricity = new Decimal(calculation.electricityIndirectEmissions);
  const production = new Decimal(calculation.productionVolume);
  if (production.lte(0)) throw new Error("ENTERPRISE_1000_SCENARIO_PRODUCTION_ZERO");
  const baseIntensity = total.dividedBy(production);
  const gridDelta = electricity.times("0.10");
  const rows: Array<{ id: string; label: string; total: Decimal; production: Decimal }> = [
    { id: "GRID_MINUS_10", label: "Grid emission factor -10%", total: total.minus(gridDelta), production },
    { id: "BASE", label: "Base case", total, production },
    { id: "GRID_PLUS_10", label: "Grid emission factor +10%", total: total.plus(gridDelta), production },
    { id: "PRODUCTION_MINUS_10", label: "Production volume -10%", total, production: production.times("0.90") },
    { id: "PRODUCTION_PLUS_10", label: "Production volume +10%", total, production: production.times("1.10") },
  ];

  return rows.map((row) => {
    const intensity = row.total.dividedBy(row.production);
    const delta = intensity.minus(baseIntensity);
    return {
      scenarioId: row.id,
      label: row.label,
      totalEmbeddedEmissions: row.total.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      aggregateIntensity: intensity.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      intensityDelta: delta.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      intensityDeltaPercent: baseIntensity.eq(0)
        ? "0"
        : delta.dividedBy(baseIntensity).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
    };
  });
}

export function deriveMaterialitySimulation(calculation: DossierCalculationResult): MaterialitySimulationRow[] {
  const rate = new Decimal(String(VERIFICATION_MATERIALITY_RATE));
  const gridDeltaTotal = new Decimal(calculation.electricityIndirectEmissions).times("0.10");
  return calculation.goods.map((good) => {
    const specific = new Decimal(good.specificEmbeddedEmissions);
    const threshold = specific.times(rate);
    const production = new Decimal(good.productionVolume);
    const share = new Decimal(good.allocationShare);
    const gridDeltaSpecific = production.gt(0) ? gridDeltaTotal.times(share).dividedBy(production) : new Decimal(0);
    const productionMinus10Specific = production.gt(0)
      ? new Decimal(good.allocatedEmbeddedEmissions).dividedBy(production.times("0.90"))
      : specific;
    const productionDelta = productionMinus10Specific.minus(specific);
    const gridUtilization = threshold.eq(0) ? new Decimal(0) : gridDeltaSpecific.abs().dividedBy(threshold).times(100);
    const productionUtilization = threshold.eq(0) ? new Decimal(0) : productionDelta.abs().dividedBy(threshold).times(100);
    const maxUtilization = Decimal.max(gridUtilization, productionUtilization);
    const proximityState = maxUtilization.gte(100)
      ? "ABOVE_PLANNING_THRESHOLD"
      : maxUtilization.gte(75)
        ? "NEAR_PLANNING_THRESHOLD"
        : "BELOW_PLANNING_THRESHOLD";
    return {
      goodIndex: good.goodIndex,
      cnCode: good.cnCode,
      specificEmbeddedEmissions: specific.toString(),
      planningThresholdRate: rate.times(100).toString(),
      planningThreshold: threshold.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      gridFactorPlus10DeltaSpecific: gridDeltaSpecific.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      gridFactorThresholdUtilizationPercent: gridUtilization.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      productionMinus10DeltaSpecific: productionDelta.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString(),
      productionThresholdUtilizationPercent: productionUtilization.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      proximityState,
    };
  });
}

function deriveHandoverDrafts(params: {
  caseData: AuditReadyCase;
  enterprise: Pick<Enterprise1000Model, "status" | "findings" | "correctiveActions" | "materialitySimulation">;
}): HandoverDraft[] {
  const openFindings = params.enterprise.findings.filter((finding) => finding.status !== "RESOLVED");
  const evidenceCount = params.caseData.evidenceRegister.length;
  const materiality = params.enterprise.materialitySimulation.map((row) => `Good ${row.goodIndex} (${row.cnCode}) threshold ${row.planningThreshold} tCO2e/t`).join("; ") || "No goods available";
  const boundary = params.caseData.installation.systemBoundaries?.trim() || "System boundary requires confirmation";
  const reportingPeriod = `${params.caseData.reportingPeriod.startDate?.value || "not supplied"} to ${params.caseData.reportingPeriod.endDate?.value || "not supplied"}`;

  return [
    {
      draftId: "HANDOVER-01",
      title: "Scope & criteria draft",
      purpose: "Give the verifier a challenge-ready starting scope without presenting it as the verifier's conclusion.",
      preparedText: `Proposed scope: installation ${String(params.caseData.installation.name.value || "not supplied")}; reporting period ${reportingPeriod}; boundary: ${boundary}. Proposed criteria: applicable CBAM definitive-period ruleset, evidence traceability, calculation reperformance and per-good planning materiality. Enterprise status at handover: ${params.enterprise.status}.`,
      completionState: "PREPARED",
      missingInputs: [],
    },
    {
      draftId: "HANDOVER-02",
      title: "Site visit invitation draft",
      purpose: "Provide an immediately usable invitation and evidence-access agenda.",
      preparedText: `We invite the independent verifier to review the installation, production route, meters/source records, evidence register and calculation reperformance package. Proposed agenda includes system-boundary walkthrough, source-stream trace, sample evidence retrieval and reconciliation to the sealed calculation root.`,
      completionState: params.caseData.installation.address?.value ? "PREPARED" : "NEEDS_INPUT",
      missingInputs: params.caseData.installation.address?.value ? [] : ["Installation address / visit logistics"],
    },
    {
      draftId: "HANDOVER-03",
      title: "Evidence request agenda",
      purpose: "Turn the evidence register into an actionable first-meeting retrieval plan.",
      preparedText: `${evidenceCount} registered evidence file(s) are indexed by input and calculation lineage. Priority discussion: records carrying weak verifiability warnings, open support review and any out-of-period evidence.`,
      completionState: evidenceCount > 0 ? "PREPARED" : "NEEDS_INPUT",
      missingInputs: evidenceCount > 0 ? [] : ["Evidence files"],
    },
    {
      draftId: "HANDOVER-04",
      title: "Calculation reperformance plan",
      purpose: "Define how the verifier can independently reproduce the reported numbers.",
      preparedText: `Reperform Calculation Trace and Calculation Graph node values, reconcile per-good allocation to the priced embedded-emissions total, compare Verifier Workspace formula results to canonical outputs, and confirm the root/hash chain before relying on reported totals.`,
      completionState: params.caseData.calculationTrace.length > 0 ? "PREPARED" : "NEEDS_INPUT",
      missingInputs: params.caseData.calculationTrace.length > 0 ? [] : ["Persisted calculation trace"],
    },
    {
      draftId: "HANDOVER-05",
      title: "Materiality discussion note",
      purpose: "Provide a planning simulation while preserving the verifier's expert judgement.",
      preparedText: `Operator planning reference uses ${VERIFICATION_MATERIALITY_RATE * 100}% of specific embedded emissions per good. Scenario proximity: ${materiality}. These values are planning simulations only; the independent verifier confirms or revises materiality.`,
      completionState: params.enterprise.materialitySimulation.length > 0 ? "PREPARED" : "NEEDS_INPUT",
      missingInputs: params.enterprise.materialitySimulation.length > 0 ? [] : ["Per-good calculation outputs"],
    },
    {
      draftId: "HANDOVER-06",
      title: "Open findings agenda",
      purpose: "Start the meeting with explicit unresolved items rather than an empty findings table.",
      preparedText: openFindings.length > 0
        ? openFindings.map((finding) => `${finding.findingId}: ${finding.title} — ${finding.remediationRequirement}`).join(" | ")
        : "No unresolved operator-controlled findings at package generation time; verifier challenge points remain open by professional judgement.",
      completionState: "PREPARED",
      missingInputs: [],
    },
    {
      draftId: "HANDOVER-07",
      title: "Sign-off & closure checklist",
      purpose: "Define closure evidence and ownership for every open action before final independent opinion.",
      preparedText: params.enterprise.correctiveActions.length > 0
        ? params.enterprise.correctiveActions.map((action) => `${action.actionId}: ${action.responsibleRole}; ${action.closureCondition}; state ${action.state}`).join(" | ")
        : "No operator corrective actions remain open; independent-verifier sign-off fields remain verifier-reserved.",
      completionState: "PREPARED",
      missingInputs: [],
    },
  ];
}

export function deriveEnterprise1000Model(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  generatedAt: string;
}): Enterprise1000Model {
  const statusLayer = deriveEnterpriseStatus({ caseData: params.caseData, generatedAt: params.generatedAt });
  const evidenceVerifiability = params.caseData.evidenceRegister.map(assessEvidenceVerifiability);
  const scenarios = deriveScenarioAnalysis(params.calculation);
  const materialitySimulation = deriveMaterialitySimulation(params.calculation);
  const enterpriseBase = {
    ...statusLayer,
    evidenceVerifiability,
    scenarios,
    materialitySimulation,
    primaryDocumentRoles: PRIMARY_DOCUMENT_ROLES.map((entry) => ({ ...entry })),
  };
  const handoverDrafts = deriveHandoverDrafts({
    caseData: params.caseData,
    enterprise: enterpriseBase,
  });
  const openQuestions = [
    ...statusLayer.findings.filter((finding) => finding.status !== "RESOLVED").map((finding) => `${finding.findingId}: ${finding.title}?`),
    ...evidenceVerifiability.filter((row) => row.warning !== "NONE").map((row) => `${row.evidenceId}: Can the verifier independently corroborate ${row.fileName} beyond the recorded metadata?`),
  ];
  const closureConditions = statusLayer.correctiveActions.map((action) => `${action.actionId}: ${action.closureCondition}`);
  return {
    ...enterpriseBase,
    handoverDrafts,
    openQuestions: openQuestions.length > 0 ? openQuestions : ["No operator-controlled open questions; independent verifier challenge questions remain external."],
    closureConditions: closureConditions.length > 0 ? closureConditions : ["No open operator corrective-action closure conditions."],
  };
}

function evidenceRegisterCsv(model: Enterprise1000Model, caseData: AuditReadyCase): Buffer {
  const byId = new Map(model.evidenceVerifiability.map((row) => [row.evidenceId, row]));
  return csv([
    ["Evidence ID", "Type", "File", "Issuer", "Issue date", "SHA-256", "Bytes", "Review", "Support", "A-E grade", "Grade basis", "Independent verifiability", "Verifiability basis", "Metadata integrity", "External credential/reference", "Automatic warning"],
    ...caseData.evidenceRegister.map((record) => {
      const assurance = byId.get(record.evidenceId)!;
      return [record.evidenceId, record.documentType, record.fileName, record.issuer, record.issueDate, record.fileHash, record.sizeBytes, record.reviewStatus, record.supportStatus, assurance.grade, assurance.gradeBasis, assurance.verifiabilityState, assurance.verifiabilityBasis, assurance.metadataIntegrity, assurance.externalCredentialReference, assurance.warning];
    }),
  ]);
}

function correctiveActionCsv(model: Enterprise1000Model): Buffer {
  return csv([
    ["Finding ID", "Finding", "Severity", "Action", "Priority", "Responsible role", "State", "Target date", "Closure condition", "Closure evidence"],
    ...model.findings.map((finding) => {
      const action = finding.action;
      if (!action) throw new Error(`ENTERPRISE_1000_CORRECTIVE_ACTION_MISSING:${finding.findingId}`);
      return [finding.findingId, finding.title, finding.severity, action.requiredAction, action.priority, action.responsibleRole, action.state, action.targetDate || "NOT_YET_SET", action.closureCondition, action.closureEvidenceIds.length > 0 ? action.closureEvidenceIds.join(" | ") : "NONE_LINKED_YET"];
    }),
  ]);
}

function identityRows(caseData: AuditReadyCase): unknown[][] {
  return [
    ["Importer", String(caseData.importerIdentity.legalName.value || "Not supplied")],
    ["EORI", String(caseData.importerIdentity.eoriNumber.value || "Not supplied")],
    ["Exporter/operator", String(caseData.exporterIdentity.legalName.value || "Not supplied")],
    ["Installation", String(caseData.installation.name.value || "Not supplied")],
    ["Country", String(caseData.installation.country.value || "Not supplied")],
    ["Production route", String(caseData.installation.productionRoute.value || "Not supplied")],
    ["Reporting period", `${String(caseData.reportingPeriod.startDate?.value || "Not supplied")} to ${String(caseData.reportingPeriod.endDate?.value || "Not supplied")}`],
  ];
}

function enterprisePdfArtifacts(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  packageCode: string;
  releaseVersion: number;
  generatedAt: string;
  enterprise: Enterprise1000Model;
}): PackageArtifact[] {
  const model = buildVerifierPackageModel({
    caseData: params.caseData,
    calculation: params.calculation,
    controls: params.controls,
    reportId: params.reportId,
    packageCode: params.packageCode,
    releaseVersion: params.releaseVersion,
    generatedAt: params.generatedAt,
    assessmentTimestamp: params.generatedAt,
    productCode: "pack_premium_dossier_v5",
    releaseContractVersion: 5,
  });
  const role = (fileName: string) => params.enterprise.primaryDocumentRoles.find((entry) => entry.fileName === fileName)?.uniqueRole || "Unique enterprise verifier-preparation workpaper.";
  const pdf = (fileName: string, title: string, subtitle: string, sections: EnterprisePdfSection[]) => artifact(
    fileName,
    buildEnterprisePdf({ title, subtitle, uniqueRole: role(fileName), status: params.enterprise.status, preparationScore: params.enterprise.preparationScore, model, sections }),
    "application/pdf"
  );

  const statusTable = {
    headers: ["Control", "Result"],
    widths: [58, 122],
    rows: [
      ["Enterprise readiness", params.enterprise.status],
      ["Preparation score", `${params.enterprise.preparationScore}/100`],
      ["Definitive annual eligible", params.enterprise.reportingPeriod.definitiveAnnualEligible ? "YES" : "NO"],
      ["Reporting-period completeness", `${params.enterprise.reportingPeriod.completenessPercent}%`],
      ["Open findings", params.enterprise.findings.filter((finding) => finding.status !== "RESOLVED").length],
      ["Evidence files", params.caseData.evidenceRegister.length],
      ["Calculation root", params.calculation.calculationRootHash],
    ],
  };

  const documentRoleTable = {
    headers: ["Primary document", "Unique role"],
    widths: [62, 118],
    rows: params.enterprise.primaryDocumentRoles.map((entry) => [entry.fileName, entry.uniqueRole]),
  };

  const evidenceTable = {
    headers: ["Evidence", "Grade", "Independent verifiability", "Metadata", "Warning"],
    widths: [52, 16, 45, 22, 45],
    rows: params.enterprise.evidenceVerifiability.map((row) => [row.evidenceId, row.grade, row.verifiabilityState, row.metadataIntegrity, row.warning]),
  };

  const actionTable = {
    headers: ["Finding", "Action", "Priority", "Responsible", "State", "Closure condition"],
    widths: [28, 48, 18, 28, 22, 36],
    rows: params.enterprise.findings.map((finding) => {
      const action = finding.action;
      if (!action) throw new Error(`ENTERPRISE_1000_CORRECTIVE_ACTION_MISSING:${finding.findingId}`);
      return [finding.findingId, action.requiredAction, action.priority, action.responsibleRole, action.state, action.closureCondition];
    }),
  };

  const goodsTable = {
    headers: ["Good", "CN", "Production", "Allocation", "Allocated tCO2e", "Specific tCO2e/t"],
    widths: [18, 28, 30, 26, 38, 40],
    rows: params.calculation.goods.map((good) => [good.goodIndex, good.cnCode, good.productionVolume, good.allocationShare, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions]),
  };

  const scenarioTable = {
    headers: ["Scenario", "Total tCO2e", "Intensity tCO2e/t", "Delta", "Delta %"],
    widths: [58, 32, 38, 26, 26],
    rows: params.enterprise.scenarios.map((row) => [row.label, row.totalEmbeddedEmissions, row.aggregateIntensity, row.intensityDelta, `${row.intensityDeltaPercent}%`]),
  };

  const materialityTable = {
    headers: ["Good / CN", "5% threshold", "Grid +10% delta", "Grid utilization", "Production -10% delta", "Production utilization", "Proximity"],
    widths: [35, 27, 27, 25, 29, 27, 30],
    rows: params.enterprise.materialitySimulation.map((row) => [`${row.goodIndex} / ${row.cnCode}`, row.planningThreshold, row.gridFactorPlus10DeltaSpecific, `${row.gridFactorThresholdUtilizationPercent}%`, row.productionMinus10DeltaSpecific, `${row.productionThresholdUtilizationPercent}%`, row.proximityState]),
  };

  const calendarState = getComplianceCalendarState(new Date(params.generatedAt));
  const complianceTable = {
    headers: ["Milestone", "Date", "Kind", "State", "Days"],
    widths: [62, 24, 22, 22, 20],
    rows: calendarState.milestones.map((milestone) => [milestone.label, milestone.date, milestone.kind, milestone.state, milestone.daysUntil]),
  };

  const methodologyRows = params.caseData.methodologyDecisions.map((decision) => [decision.topic, decision.selectedMethod, decision.reason, decision.legalOrTechnicalBasis, decision.reviewStatus, decision.evidenceIds.join(" | ") || "NONE"]);
  const registryRows = buildRegistryTemplateMapping(params.caseData).map((entry) => [entry.registryFieldId, entry.section, entry.legalBasis, entry.sourcePath, entry.status, entry.owner, entry.evidenceIds.join(" | ") || "NONE"]);
  const handoverRows = params.enterprise.handoverDrafts.map((draft) => [draft.draftId, draft.title, draft.purpose, draft.completionState, draft.missingInputs.join(" | ") || "NONE"]);

  return [
    pdf("CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf", "CBAMValid Verification Readiness & Evidence Assurance Dossier", "Enterprise verifier-preparation decision dossier with one authoritative readiness state", [
      { heading: "Authoritative readiness state", callout: { label: "Single status field", value: `${params.enterprise.status} — ${params.enterprise.statusReasons.join(" ")}` } },
      { heading: "Preparation score", paragraphs: [params.enterprise.scoreFormula], table: statusTable },
      { heading: "Evidence assurance", paragraphs: ["A-E evidence grades are accompanied by a separate independent-verifiability field and a machine-checkable basis. A high grade does not by itself create an independent verification conclusion."], table: evidenceTable },
      { heading: "Findings and closure", table: actionTable },
      { heading: "Scenario analysis and materiality simulation", paragraphs: ["Deterministic scenarios isolate arithmetic sensitivity; they are not probability forecasts or verification opinions. Per-good threshold utilization compares deterministic scenario impact with the operator-prepared 5% planning threshold. Independent verifier judgement remains controlling."], table: scenarioTable, barChart: { unit: "% intensity delta", items: params.enterprise.scenarios.filter((row) => row.scenarioId !== "BASE").map((row) => ({ label: row.label, value: row.intensityDeltaPercent })) } },
      { heading: "Materiality proximity", paragraphs: ["Threshold utilization compares deterministic scenario impact with the operator-prepared 5% planning threshold."], table: materialityTable },
      { heading: "Compliance calendar", paragraphs: ["Definitive-period CBAM milestones derived from the regulation. The first annual declaration and certificate surrender deadline for 2026 imports is 2027-09-30."], table: complianceTable, callout: { label: "Calendar boundary", value: `${calendarState.daysUntilFirstDeclaration} days remain until the first annual declaration deadline (${calendarState.firstDeclarationDeadline}).` } },
      { heading: "Primary-document architecture", paragraphs: ["The sealed package contains 11 foregrounded human-review documents with non-overlapping roles. Remaining components are machine-readable registers, cryptographic trust files, the verifier workbook and immutable supporting evidence."], table: documentRoleTable },
      { heading: "Professional boundary", callout: { label: "No verification opinion", value: "CBAMValid prepares and structures the operator dossier. An appropriately accredited independent verifier remains responsible for independent verification work, materiality judgement, site-visit decisions and any final opinion." } },
    ]),

    pdf("Verifier First Meeting & Handover Pack.pdf", "Verifier First Meeting & Handover Pack", "Prepared first-meeting agenda, challenge questions, closure conditions and seven handover drafts", [
      { heading: "One-page first-meeting brief", table: statusTable, paragraphs: [`Objective: transfer a reproducible operator-prepared dossier to the independent verifier with explicit open issues, evidence weaknesses, scenario sensitivity and closure conditions. Current enterprise status is ${params.enterprise.status}.`] },
      { heading: "Open questions", table: { headers: ["#", "Question"], widths: [12, 168], rows: params.enterprise.openQuestions.map((question, index) => [index + 1, question]) } },
      { heading: "Closure conditions", table: { headers: ["#", "Condition"], widths: [12, 168], rows: params.enterprise.closureConditions.map((condition, index) => [index + 1, condition]) } },
      { heading: "Seven prepared handover drafts", table: handoverRows },
      ...params.enterprise.handoverDrafts.map((draft) => ({ heading: draft.title, paragraphs: [draft.purpose, draft.preparedText], callout: { label: "Draft completion", value: `${draft.completionState}; missing inputs: ${draft.missingInputs.join(", ") || "none"}` } } as EnterprisePdfSection)),
    ]),

    pdf("Product Scope Assessment.pdf", "Product Scope Assessment", "Parties, installation, reporting-period boundary and goods population only", [
      { heading: "Identity and reporting scope", table: { headers: ["Field", "Value"], widths: [55, 125], rows: identityRows(params.caseData) } },
      { heading: "Goods population", table: goodsTable },
      { heading: "Scope status", callout: { label: "Enterprise readiness", value: params.enterprise.status } },
    ]),

    pdf("CN Code Reasoning.pdf", "CN Code Reasoning", "CN-code classification workpaper and linked classification evidence", [
      { heading: "Classification register", table: { headers: ["Good", "CN code", "Sector", "CN evidence", "Production evidence"], widths: [16, 28, 38, 49, 49], rows: params.caseData.goods.map((good, index) => [index + 1, good.cnCode.value, good.sector, good.cnCode.evidenceId || "MISSING", good.productionVolume.evidenceId || "MISSING"]) } },
      { heading: "Classification boundary", paragraphs: ["This workpaper records operator-supplied CN classification and its evidence lineage. It does not replace a binding customs classification decision."] },
    ]),

    pdf("Required Data Checklist.pdf", "Required Data Checklist", "Operational evidence-remediation and corrective-action closure workpaper", [
      { heading: "Automatic weak-evidence warnings", table: evidenceTable },
      { heading: "Mandatory corrective-action closure fields", table: actionTable },
      { heading: "Closure rule", callout: { label: "No blank closure fields", value: "Every finding carries Action, Priority, Responsible role, State and Closure condition. Missing fields are a pre-signing contract failure." } },
    ]),

    pdf("Installation Monitoring Plan.pdf", "Installation Monitoring Plan", "Monitoring requirements, source controls and evidence basis", [
      { heading: "Installation", table: { headers: ["Field", "Value"], widths: [55, 125], rows: [["Installation", params.caseData.installation.name.value], ["Production route", params.caseData.installation.productionRoute.value], ["System boundary", params.caseData.installation.systemBoundaries || "NOT SUPPLIED"], ["Monitoring plan ID", params.caseData.installation.monitoringPlanId?.value || "NOT SUPPLIED"], ["Monitoring plan version", params.caseData.installation.monitoringPlanVersion?.value || "NOT SUPPLIED"]] } },
      { heading: "Monitoring-plan requirements", table: { headers: ["ID", "Requirement", "Status", "Evidence / basis"], widths: [18, 72, 25, 65], rows: model.monitoringPlan.map((item) => [item.requirementId, item.requirement, item.status, item.evidence]) } },
    ]),

    pdf("Production Process Map.pdf", "Production Process Map", "Controlled process and data-flow map from operator source to independent review", [
      { heading: "Controlled flow", table: { headers: ["Stage", "Controlled activity", "Output / control"], widths: [18, 92, 70], rows: [[1, "Define identity, installation, goods and reporting period", "Scope workpapers"], [2, "Capture source streams and measurement data", "Monitoring controls"], [3, "Register evidence and link it to inputs/calculations", "Evidence provenance"], [4, "Calculate and reconcile embedded emissions", "Trace, graph and workbook"], [5, "Run evidence, period, methodology and integrity gates", "Enterprise readiness"], [6, "Generate scenario and materiality planning simulations", "Calculation annex"], [7, "Prepare findings, handover drafts and closure agenda", "First meeting pack"], [8, "Hash, sign and seal immutable package", "Manifest and signature"], [9, "Independent verifier performs independent procedures", "Verifier-reserved external conclusion"]] } },
    ]),

    pdf("System Boundary Register.pdf", "System Boundary Register", "Declared installation boundary, exclusions, functional units and verification focus", [
      { heading: "Declared boundary", callout: { label: "System boundary", value: params.caseData.installation.systemBoundaries || "NOT SUPPLIED" } },
      { heading: "Boundary details", table: { headers: ["Control", "Value"], widths: [55, 125], rows: [["Excluded processes", params.caseData.installation.excludedProcesses || "NONE RECORDED"], ["Functional units", params.caseData.installation.functionalUnits || "NOT SUPPLIED"], ["Production route", params.caseData.installation.productionRoute.value], ["Country", params.caseData.installation.country.value]] } },
      { heading: "Sector verification focus", table: { headers: ["Sector", "Boundary", "Verification focus"], widths: [35, 65, 80], rows: model.sectorMethodologies.map((sector) => [sector.displayName, sector.defaultBoundaries, sector.verificationFocus.join("; ")]) } },
    ]),

    pdf("Methodology Decision Log.pdf", "Methodology Decision Log", "Method selection, rejected alternatives, legal basis, evidence and review provenance", [
      { heading: "Decision register", table: { headers: ["Topic", "Selected method", "Reason", "Legal / technical basis", "Review", "Evidence"], widths: [28, 38, 36, 42, 18, 18], rows: methodologyRows.length > 0 ? methodologyRows : [["NO DECISION", "NOT SUPPLIED", "No methodology decision recorded", "NOT SUPPLIED", "REVIEW_REQUIRED", "NONE"]] } },
      { heading: "Registry mapping", table: { headers: ["Field", "Section", "Legal basis", "Source path", "Status", "Owner", "Evidence"], widths: [27, 28, 34, 34, 22, 23, 32], rows: registryRows } },
    ]),

    pdf("Embedded Emissions Calculation Annex.pdf", "Embedded Emissions Calculation Annex", "Reperformance trace, deterministic scenarios and materiality-threshold simulation", [
      { heading: "Calculation provenance", table: { headers: ["Control", "Value"], widths: [55, 125], rows: [["Ruleset", params.calculation.ruleset], ["Engine version", params.calculation.engineVersion], ["Calculation root", params.calculation.calculationRootHash], ["Allocation share total", params.calculation.allocationShareTotal], ["Allocation reconciliation delta", params.calculation.allocationReconciliationDelta]] } },
      { heading: "Formula trace", table: { headers: ["Formula", "Output", "Unit", "Hash"], widths: [55, 28, 22, 75], rows: params.calculation.trace.map((node) => [node.formulaId, node.outputValue, node.outputUnit, node.calculationHash]) } },
      { heading: "Sensitivity / scenario analysis", paragraphs: ["Mechanical scenarios isolate arithmetic sensitivity; they are not probability forecasts or verification opinions."], table: scenarioTable, barChart: { unit: "% intensity delta", items: params.enterprise.scenarios.filter((row) => row.scenarioId !== "BASE").map((row) => ({ label: row.label, value: row.intensityDeltaPercent })) } },
      { heading: "Per-good 5% materiality simulation", paragraphs: ["Threshold utilization compares deterministic scenario impact with the operator-prepared 5% planning threshold. Independent verifier judgement remains controlling."], table: materialityTable },
    ]),

    pdf("Operator Emissions Report.pdf", "Operator Emissions Report", "Operator-prepared emissions statement, per-good results, carbon-price treatment and sign-offs", [
      { heading: "Operator and installation", table: { headers: ["Field", "Value"], widths: [55, 125], rows: identityRows(params.caseData) } },
      { heading: "Reported emissions", table: { headers: ["Metric", "Value", "Unit"], widths: [90, 45, 45], rows: [["Installation direct emissions", params.calculation.installationDirectEmissions, "tCO2e"], ["Electricity indirect emissions", params.calculation.electricityIndirectEmissions, "tCO2e"], ["Precursor direct emissions", params.calculation.precursorDirectEmissions, "tCO2e"], ["Precursor indirect emissions", params.calculation.precursorIndirectEmissions, "tCO2e"], ["Total embedded emissions", params.calculation.totalEmbeddedEmissions, "tCO2e"], ["Production volume", params.calculation.productionVolume, "t"], ["Aggregate specific embedded emissions", params.calculation.specificEmbeddedEmissions, "tCO2e/t"], ["Eligible certificate reduction", params.calculation.eligibleCertificateReduction, "tCO2e"]] } },
      { heading: "Per-good results", table: goodsTable },
      { heading: "Operator sign-offs", table: { headers: ["Role", "Name", "Title", "Signed at"], widths: [42, 45, 45, 48], rows: params.caseData.operatorSignOffs.length > 0 ? params.caseData.operatorSignOffs.map((signoff) => [signoff.role, signoff.name, signoff.title, signoff.signedAt]) : [["NOT SUPPLIED", "NOT SUPPLIED", "NOT SUPPLIED", "NOT SUPPLIED"]] } },
      { heading: "Enterprise readiness", callout: { label: "Single status field", value: params.enterprise.status } },
    ]),
  ];
}

const LEGACY_PRIMARY_PDFS = new Set([
  "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf",
  "Complete Dossier Compilation.pdf",
  "Product Scope Assessment.pdf",
  "CN Code Reasoning.pdf",
  "Required Data Checklist.pdf",
  "Installation Monitoring Plan.pdf",
  "Production Process Map.pdf",
  "System Boundary Register.pdf",
  "Methodology Decision Log.pdf",
  "Embedded Emissions Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
]);

export function assertEnterprise1000Contract(params: {
  enterprise: Enterprise1000Model;
  artifacts: readonly PackageArtifact[];
  goodsCount: number;
}): void {
  const expectedPdfs = new Set(PRIMARY_DOCUMENT_ROLES.map((entry) => entry.fileName));
  // Primary human-review documents live at the package root. Supporting_Evidence
  // contains immutable copies of operator files whose format is not controlled by
  // the product (PDFs there are evidence, not primary documents), so the 11-document
  // contract must only count root-level PDFs.
  const pdfs = params.artifacts.filter((item) => item.path.endsWith(".pdf") && !item.path.includes("/"));
  const actualPdfPaths = new Set(pdfs.map((item) => item.path));
  if (expectedPdfs.size !== 11 || actualPdfPaths.size !== 11) {
    throw new Error(`ENTERPRISE_1000_PRIMARY_DOCUMENT_COUNT_INVALID:${actualPdfPaths.size}`);
  }
  for (const expected of expectedPdfs) {
    if (!actualPdfPaths.has(expected)) throw new Error(`ENTERPRISE_1000_PRIMARY_DOCUMENT_MISSING:${expected}`);
  }
  if (actualPdfPaths.has("Complete Dossier Compilation.pdf")) {
    throw new Error("ENTERPRISE_1000_DUPLICATE_COMPILATION_FORBIDDEN");
  }
  const pdfHashes = pdfs.map((item) => crypto.createHash("sha256").update(item.bytes).digest("hex"));
  if (new Set(pdfHashes).size !== pdfHashes.length) throw new Error("ENTERPRISE_1000_DUPLICATE_PDF_CONTENT");
  if (pdfs.some((item) => item.bytes.byteLength < 5000)) throw new Error("ENTERPRISE_1000_TRIVIAL_PDF");

  if (!(["READY_FOR_VERIFICATION", "CONDITIONAL", "NOT_READY"] as string[]).includes(params.enterprise.status)) {
    throw new Error("ENTERPRISE_1000_STATUS_INVALID");
  }
  if (!params.enterprise.reportingPeriod.definitiveAnnualEligible && params.enterprise.status === "READY_FOR_VERIFICATION") {
    throw new Error("ENTERPRISE_1000_FUTURE_PERIOD_READY_CONTRADICTION");
  }
  if (params.enterprise.status !== "READY_FOR_VERIFICATION" && Number(params.enterprise.preparationScore) >= 100) {
    throw new Error("ENTERPRISE_1000_BLOCKED_SCORE_NOT_REDUCED");
  }

  for (const row of params.enterprise.evidenceVerifiability) {
    if (!row.verifiabilityBasis.trim() || !row.verifiabilityState.trim()) {
      throw new Error(`ENTERPRISE_1000_EVIDENCE_VERIFIABILITY_MISSING:${row.evidenceId}`);
    }
  }
  for (const finding of params.enterprise.findings) {
    const action = finding.action;
    if (!action || !action.requiredAction.trim() || !action.priority || !action.responsibleRole || !action.state || !action.closureCondition.trim()) {
      throw new Error(`ENTERPRISE_1000_CORRECTIVE_ACTION_INCOMPLETE:${finding.findingId}`);
    }
  }
  if (params.enterprise.scenarios.length < 3) throw new Error("ENTERPRISE_1000_SCENARIO_LAYER_MISSING");
  if (params.enterprise.materialitySimulation.length !== params.goodsCount) throw new Error("ENTERPRISE_1000_MATERIALITY_SIMULATION_INCOMPLETE");
  if (params.enterprise.handoverDrafts.length !== 7 || params.enterprise.handoverDrafts.some((draft) => !draft.preparedText.trim())) {
    throw new Error("ENTERPRISE_1000_HANDOVER_DRAFTS_INCOMPLETE");
  }
  if (params.enterprise.openQuestions.length === 0 || params.enterprise.closureConditions.length === 0) {
    throw new Error("ENTERPRISE_1000_FIRST_MEETING_PACK_INCOMPLETE");
  }
  const evidenceCsv = params.artifacts.find((item) => item.path === "Evidence Register.csv")?.bytes.toString("utf8") || "";
  if (!evidenceCsv.includes("Independent verifiability") || !evidenceCsv.includes("Verifiability basis") || !evidenceCsv.includes("Automatic warning")) {
    throw new Error("ENTERPRISE_1000_EVIDENCE_REGISTER_CONTRACT_FAILED");
  }
  const correctiveCsv = params.artifacts.find((item) => item.path === "Corrective Action Log.csv")?.bytes.toString("utf8") || "";
  for (const header of ["Action", "Priority", "Responsible role", "State", "Closure condition"]) {
    if (!correctiveCsv.includes(header)) throw new Error(`ENTERPRISE_1000_CORRECTIVE_REGISTER_HEADER_MISSING:${header}`);
  }
}

export function upgradeArtifactsToEnterprise1000(params: {
  artifacts: PackageArtifact[];
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  packageCode: string;
  releaseVersion: number;
  generatedAt: string;
}): { artifacts: PackageArtifact[]; enterprise: Enterprise1000Model } {
  const enterprise = deriveEnterprise1000Model({
    caseData: params.caseData,
    calculation: params.calculation,
    generatedAt: params.generatedAt,
  });
  const replacementPdfs = enterprisePdfArtifacts({ ...params, enterprise });
  const replacementPaths = new Set(replacementPdfs.map((item) => item.path));

  const filtered = params.artifacts.filter((item) => {
    if (LEGACY_PRIMARY_PDFS.has(item.path)) return false;
    if (replacementPaths.has(item.path)) return false;
    if (item.path === "Evidence Register.csv" || item.path === "Corrective Action Log.csv") return false;
    return true;
  });

  const traceArtifact = filtered.find((item) => item.path === "Calculation Trace.json");
  if (!traceArtifact) throw new Error("ENTERPRISE_1000_CALCULATION_TRACE_MISSING");
  const oldTrace = JSON.parse(traceArtifact.bytes.toString("utf8")) as { calculation?: DossierCalculationResult };
  if (!oldTrace.calculation) throw new Error("ENTERPRISE_1000_CALCULATION_TRACE_INVALID");
  traceArtifact.bytes = Buffer.from(JSON.stringify({
    reportId: params.reportId,
    packageCode: params.packageCode,
    caseId: params.caseData.caseId,
    generatedAt: params.generatedAt,
    enterpriseReadiness: {
      status: enterprise.status,
      preparationScore: enterprise.preparationScore,
      scoreFormula: enterprise.scoreFormula,
      statusReasons: enterprise.statusReasons,
      definitiveAnnualEligible: enterprise.reportingPeriod.definitiveAnnualEligible,
    },
    calculation: oldTrace.calculation,
  }), "utf8");

  const supportingReadme = filtered.find((item) => item.path === "Supporting_Evidence/README.txt");
  if (supportingReadme) {
    supportingReadme.bytes = Buffer.from([
      "CBAMValid immutable evidence copies",
      `Package ID: ${params.packageCode}`,
      `Report: ${params.reportId}`,
      `Case: ${params.caseData.caseId}`,
      `Evidence count: ${params.caseData.evidenceRegister.length}`,
      "Evidence assurance is recorded in Evidence Register.csv with A-E grade, independent-verifiability state, SHA-256/byte metadata checks and automatic weak-evidence warnings.",
      "Each binary remains independently hash-verifiable against Data Integrity Manifest.json.",
      "",
    ].join("\r\n"), "utf8");
  }

  const upgraded = [
    ...filtered,
    ...replacementPdfs,
    artifact("Evidence Register.csv", evidenceRegisterCsv(enterprise, params.caseData), "text/csv"),
    artifact("Corrective Action Log.csv", correctiveActionCsv(enterprise), "text/csv"),
  ].sort((left, right) => left.path.localeCompare(right.path));

  const paths = upgraded.map((item) => item.path);
  if (new Set(paths).size !== paths.length) throw new Error("ENTERPRISE_1000_DUPLICATE_ARTIFACT_PATH");
  assertEnterprise1000Contract({ enterprise, artifacts: upgraded, goodsCount: params.caseData.goods.length });
  return { artifacts: upgraded, enterprise };
}
