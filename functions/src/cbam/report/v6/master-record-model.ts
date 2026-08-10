/**
 * G-13 — Enterprise Compliance Master Record.
 *
 * The permanent corporate record for the operator (management, internal audit,
 * future staff, banks, customers, customs). It is NOT a copy of the verifier
 * dossier (INV-01), never implies a verification opinion (INV-02), carries a
 * mandated footer on every page and follows the binding section order A1-H4
 * (30 sections). Vector diagrams only; raster images are forbidden.
 */
import type { AuditReadyCase } from "../../schema";
import type { DossierCalculationResult } from "../../calculator";
import type { QualityControlResult } from "../../validation/quality-controls";
import type { VerifierPackageModel } from "../verifier-model";
import type { ReadinessAssessment } from "../premium-dossier-schema";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V6 } from "../package-components";
import type { PackageReadinessState, TwoAxisScores, ValueStatementRow } from "./types";
import { assessReadiness, getReportingPeriodAssessment } from "../../validation/readiness-score";
import { elapsedPeriodDays } from "./two-axis-score";
import { buildValueStatement } from "./value-statement";
import { buildHashArchitecture } from "./hash-architecture";
import { buildScenarioInterpretations } from "./scenario-interpretation";
import { findEvidenceGaps, validateNotApplicableBasis } from "./evidence-gap";
import { buildRegistryTemplateMapping } from "../../registry/registry-template-mapping";

export interface MasterRecordCalendar {
  readonly startDate: string;
  readonly endDate: string;
  readonly elapsedDays: number;
  readonly totalDays: number;
  readonly remainingDays: number;
  readonly periodEnded: boolean;
}

export const MASTER_RECORD_FOOTER =
  "Operator record. No independent verification opinion is implied.";
export const MASTER_RECORD_FILE_NAME = "Enterprise Compliance Master Record.pdf";
/**
 * Signed-record references for the control key. The manifest's own hash and
 * the KMS key version are only known after the manifest is signed, which
 * happens after this PDF is rendered — embedding the value would create a
 * self-referential cycle (manifest → PDF → manifest). The PDF therefore names
 * the signed manifest record; the hash is verified from the manifest file
 * inside the package (G-04 reproduction step).
 */
export const MASTER_RECORD_MANIFEST_REFERENCE =
  "Data Integrity Manifest.json — signed manifest record (verify via the manifest file inside the package)";
export const MASTER_RECORD_SIGNATURE_REFERENCE =
  "Manifest Signature.sig — signed manifest record (key version recorded at signing time)";

export interface MasterRecordControlKey {
  readonly reportId: string;
  readonly caseId: string;
  readonly packageCode: string;
  readonly releaseVersion: number;
  readonly schemaVersion: string;
  readonly engineVersion: string;
  readonly ruleset: string;
  readonly generatedAt: string;
  readonly calculationRootHash: string;
  /**
   * The manifest is sealed by the KMS signature and lists every component
   * (including this PDF) with its SHA-256. Its own hash cannot be embedded in
   * this PDF without a self-referential cycle (manifest → PDF → manifest), so
   * this record names the signed manifest file instead; the hash value is
   * verified from the manifest file inside the package (G-04 reproduction).
   */
  readonly manifestReference: string;
  readonly legalSourceRegistryHash: string;
  readonly signatureAlgorithm: string;
  /**
   * The KMS key version is chosen at signing time, after this PDF is rendered.
   * It is therefore recorded in the signed manifest record, not embedded here.
   */
  readonly signatureReference: string;
  readonly signatureProtectionLevel: string;
  readonly componentCount: number;
  readonly evidenceCount: number;
  readonly retentionUntil: string;
}

export interface MasterRecordModel {
  readonly fileRole: string;
  readonly operatorName: string;
  readonly installationName: string;
  readonly reportingPeriod: string;
  readonly controlKey: MasterRecordControlKey;
  readonly scores: TwoAxisScores;
  readonly state: PackageReadinessState;
  readonly stateReasonCodes: readonly string[];
  readonly readiness: ReadinessAssessment;
  readonly calendar: MasterRecordCalendar;
  readonly evidenceGaps: ReturnType<typeof findEvidenceGaps>;
  readonly notApplicableBasisErrors: readonly string[];
  readonly valueStatement: readonly ValueStatementRow[];
  readonly hashArchitecture: ReturnType<typeof buildHashArchitecture>["rows"];
  readonly hashInconsistencies: readonly string[];
  readonly scenarios: ReturnType<typeof buildScenarioInterpretations>;
  readonly model: VerifierPackageModel;
  readonly caseData: AuditReadyCase;
  readonly calculation: DossierCalculationResult;
  readonly controls: readonly QualityControlResult[];
}

export function retentionUntil(generatedAt: string): string {
  const date = new Date(generatedAt);
  date.setUTCFullYear(date.getUTCFullYear() + 4);
  return date.toISOString().slice(0, 10);
}

export function buildMasterRecordModel(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  model: VerifierPackageModel;
  reportId: string;
  packageCode: string;
  releaseVersion: number;
  schemaVersion: string;
  engineVersion: string;
  generatedAt: string;
  manifestReference: string;
  signatureAlgorithm: string;
  signatureReference: string;
  signatureProtectionLevel: string;
  scores: TwoAxisScores;
  state: PackageReadinessState;
  stateReasonCodes: readonly string[];
  graphRootHash?: string;
  graphNodeHashes?: ReadonlyArray<{ formulaId: string; hash: string }>;
}): MasterRecordModel {
  const {
    caseData, calculation, controls, model, reportId, packageCode, releaseVersion,
    schemaVersion, engineVersion, generatedAt, manifestReference, signatureAlgorithm,
    signatureReference, signatureProtectionLevel, scores, state, stateReasonCodes,
    graphRootHash, graphNodeHashes,
  } = params;

  const mapping = buildRegistryTemplateMapping(caseData);
  const evidenceGaps = findEvidenceGaps(mapping);
  const notApplicableBasisErrors = validateNotApplicableBasis(mapping);
  const readiness = assessReadiness({
    caseData,
    isDraft: false,
    assessmentTimestamp: generatedAt,
    sealMode: "PREVIEW",
  });
  const period = getReportingPeriodAssessment(caseData, generatedAt);
  const elapsed = elapsedPeriodDays({ caseData, assessmentTimestamp: generatedAt });
  const valueStatement = buildValueStatement({ caseData, calculation, controls, model, evidenceCount: model.evidenceSummary.totalEvidenceFiles });
  const { rows: hashArchitecture, inconsistencies: hashInconsistencies } = buildHashArchitecture({
    calculationRootHash: calculation.calculationRootHash,
    graphRootHash,
    legalSourceRegistryHash: model.ruleset.sourceHash,
    traceCalculationHashes: calculation.trace.map((item) => ({ formulaId: item.formulaId, hash: item.calculationHash })),
    graphNodeHashes: graphNodeHashes ?? [],
  });
  const scenarios = buildScenarioInterpretations({
    calculation,
    baseIntensity: model.totals.aggregateSpecificEmbeddedEmissions,
  });

  return {
    fileRole:
      "Permanent operator record covering the full engagement: scope, results, rationale, evidence chain and reproduction instructions. Addressed to the operator and its long-term records; the verifier dossier is the independent-verification handover counterpart.",
    operatorName: model.identity.exporterOperator,
    installationName: model.identity.installation,
    reportingPeriod: model.identity.reportingPeriod,
    controlKey: {
      reportId,
      caseId: model.caseId,
      packageCode,
      releaseVersion,
      schemaVersion,
      engineVersion,
      ruleset: model.ruleset.version,
      generatedAt,
      calculationRootHash: calculation.calculationRootHash,
      manifestReference,
      legalSourceRegistryHash: model.ruleset.sourceHash,
      signatureAlgorithm,
      signatureReference,
      signatureProtectionLevel,
      componentCount: REQUIRED_TOP_LEVEL_COMPONENTS_V6.length,
      evidenceCount: model.evidenceSummary.totalEvidenceFiles,
      retentionUntil: retentionUntil(generatedAt),
    },
    scores,
    state,
    stateReasonCodes,
    readiness,
    calendar: {
      startDate: period.startDate,
      endDate: period.endDate,
      elapsedDays: elapsed.elapsedDays,
      totalDays: elapsed.totalDays,
      remainingDays: Math.max(0, elapsed.totalDays - elapsed.elapsedDays),
      periodEnded: elapsed.periodEnded,
    },
    evidenceGaps,
    notApplicableBasisErrors,
    valueStatement,
    hashArchitecture,
    hashInconsistencies,
    scenarios,
    model,
    caseData,
    calculation,
    controls,
  };
}
