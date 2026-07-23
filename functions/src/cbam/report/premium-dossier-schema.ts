import { z } from "zod";
import { CalculationTraceNodeSchema } from "../schema";

export const FindingSeveritySchema = z.enum([
  "CRITICAL_BLOCKER", "CRITICAL", "MATERIAL", "MAJOR", "MINOR", "ADVISORY",
]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingCategorySchema = z.enum([
  "REPORTING_PERIOD",
  "IDENTITY_GAP",
  "SCOPE_GAP",
  "METHODOLOGY_GAP",
  "EVIDENCE_GAP",
  "EVIDENCE_INTEGRITY",
  "PERIOD_MISMATCH",
  "UNIT_MISMATCH",
  "INPUT_PLAUSIBILITY",
  "CALCULATION_EXCEPTION",
  "RECONCILIATION_EXCEPTION",
  "ALLOCATION_EXCEPTION",
  "PRECURSOR_EXCEPTION",
  "DATA_QUALITY",
  "UNCERTAINTY",
  "LEGAL_SOURCE",
  "PACKAGE_INTEGRITY",
  "EXTERNAL_VERIFIER_PENDING",
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const FindingStatusSchema = z.enum([
  "OPEN",
  "IN_REMEDIATION",
  "RESOLVED",
  "ACCEPTED_OPERATOR_RISK",
  "PENDING_EXTERNAL_VERIFIER",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const CorrectiveActionSchema = z.object({
  actionId: z.string().min(1),
  findingId: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  requiredAction: z.string().min(1),
  responsibleRole: z.enum([
    "OPERATOR_ADMIN",
    "DATA_PREPARER",
    "INTERNAL_REVIEWER",
    "ENERGY_MANAGER",
    "PRODUCTION_MANAGER",
    "FINANCE",
    "PROCUREMENT",
    "CUSTOMS",
    "EXTERNAL_VERIFIER",
  ]),
  targetDate: z.string().date().nullable(),
  closureCondition: z.string().min(1),
  closureEvidenceIds: z.array(z.string().min(1)),
  state: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "PENDING_EXTERNAL"]),
});
export type CorrectiveAction = z.infer<typeof CorrectiveActionSchema>;

export const FindingSchema = z.object({
  findingId: z.string().min(1),
  ruleId: z.string().min(1),
  severity: FindingSeveritySchema,
  category: FindingCategorySchema,
  status: FindingStatusSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  regulatoryOrTechnicalBasis: z.string().min(1),
  affectedInputIds: z.array(z.string().min(1)),
  affectedCalculationIds: z.array(z.string().min(1)),
  affectedEvidenceIds: z.array(z.string().min(1)),
  affectedReportSectionIds: z.array(z.string().min(1)),
  impactStatement: z.string().min(1),
  remediationRequirement: z.string().min(1),
  blocksOperatorReadiness: z.boolean(),
  blocksSealing: z.boolean(),
  blocksVerifierHandover: z.boolean().optional(),
  createdDeterministicallyFrom: z.string().min(1),
  action: CorrectiveActionSchema.nullable(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const EvidenceSupportStateSchema = z.enum([
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "MISSING",
  "OUT_OF_PERIOD",
  "UNAPPROVED",
  "MALWARE_UNCLEARED",
  "HASH_MISMATCH",
  "BYTE_SIZE_MISMATCH",
  "UNLINKED",
  "NOT_APPLICABLE",
]);
export type EvidenceSupportState = z.infer<typeof EvidenceSupportStateSchema>;

export const MaterialInputRequirementSchema = z.object({
  requirementId: z.string().min(1),
  inputPath: z.string().min(1),
  displayName: z.string().min(1),
  responsibleParty: z.enum(["OPERATOR", "SYSTEM", "EXTERNAL_VERIFIER"]),
  requirementLevel: z.enum([
    "MATERIAL_REQUIRED", "REQUIRED", "CONDITIONAL", "OPTIONAL",
  ]),
  conditionCode: z.string().nullable(),
  expectedDimension: z.string().nullable(),
  acceptedCanonicalUnits: z.array(z.string().min(1)),
  reportingPeriodRequired: z.boolean(),
  minimumEvidenceCount: z.number().int().nonnegative(),
  ruleSourceId: z.string().min(1),
});
export type MaterialInputRequirement = z.infer<typeof MaterialInputRequirementSchema>;

export const EvidenceIntervalSchema = z.object({
  start: z.string(),
  end: z.string(),
  evidenceIds: z.array(z.string()),
});
export type EvidenceInterval = z.infer<typeof EvidenceIntervalSchema>;

export const UncoveredIntervalSchema = z.object({
  start: z.string(),
  end: z.string(),
  missingDays: z.number().int().nonnegative(),
});
export type UncoveredInterval = z.infer<typeof UncoveredIntervalSchema>;

export const EvidenceCoverageAssessmentSchema = z.object({
  inputPath: z.string(),
  requiredPeriodStart: z.string(),
  requiredPeriodEnd: z.string(),
  requiredDays: z.number().int().nonnegative(),
  coveredDays: z.number().int().nonnegative(),
  coveragePercent: z.string(),
  mergedIntervals: z.array(EvidenceIntervalSchema),
  uncoveredIntervals: z.array(UncoveredIntervalSchema),
  supportingEvidenceIds: z.array(z.string()),
  complete: z.boolean(),
});
export type EvidenceCoverageAssessment = z.infer<typeof EvidenceCoverageAssessmentSchema>;

export const EvidenceSufficiencyRowSchema = z.object({
  requirementId: z.string().min(1),
  inputPath: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  state: EvidenceSupportStateSchema,
  coverageNumerator: z.string().regex(/^-?\d+(\.\d+)?$/),
  coverageDenominator: z.string().regex(/^\d+(\.\d+)?$/),
  blocksOperatorReadiness: z.boolean(),
  blocksSealing: z.boolean(),
  reasonCodes: z.array(z.string().min(1)),
  evidencePeriodStart: z.string().nullable().optional(),
  evidencePeriodEnd: z.string().nullable().optional(),
  coverageDays: z.number().int().nonnegative().nullable().optional(),
  requiredPeriodStart: z.string().nullable().optional(),
  requiredPeriodEnd: z.string().nullable().optional(),
  coveragePercent: z.string().nullable().optional(),
  coverageAssessment: EvidenceCoverageAssessmentSchema.nullable().optional(),
});
export type EvidenceSufficiencyRow = z.infer<typeof EvidenceSufficiencyRowSchema>;

export const ReadinessDimensionIdSchema = z.enum([
  "IDENTITY",
  "SCOPE_AND_METHODOLOGY",
  "ACTIVITY_DATA",
  "EVIDENCE",
  "CALCULATION_INTEGRITY",
  "ALLOCATION_AND_RECONCILIATION",
  "DATA_QUALITY_AND_UNCERTAINTY",
  "PACKAGE_INTEGRITY",
]);
export type ReadinessDimensionId = z.infer<typeof ReadinessDimensionIdSchema>;

export const ReadinessDimensionSchema = z.object({
  dimensionId: ReadinessDimensionIdSchema,
  weight: z.string(),
  rawScore: z.string(),
  weightedScore: z.string(),
  passedRequirementCount: z.number().int().nonnegative(),
  applicableRequirementCount: z.number().int().nonnegative(),
  blockerFindingIds: z.array(z.string()),
  materialFindingIds: z.array(z.string()),
});
export type ReadinessDimension = z.infer<typeof ReadinessDimensionSchema>;

export const OperatorReadinessStatusSchema = z.enum([
  "DRAFT",
  "NOT_READY",
  "CONDITIONAL",
  "READY_FOR_VERIFIER_REVIEW",
]);
export type OperatorReadinessStatus = z.infer<typeof OperatorReadinessStatusSchema>;

export const IndependentVerifierStatusSchema = z.enum([
  "NOT_REVIEWED",
  "IN_REVIEW",
  "OPINION_ISSUED_EXTERNAL",
  "REJECTED_EXTERNAL",
]);
export type IndependentVerifierStatus = z.infer<typeof IndependentVerifierStatusSchema>;

export const ReadinessAssessmentSchema = z.object({
  operatorStatus: OperatorReadinessStatusSchema,
  independentVerifierStatus: IndependentVerifierStatusSchema,
  score: z.string(),
  scoreScale: z.literal("0-100"),
  dimensions: z.array(ReadinessDimensionSchema).length(8),
  criticalBlockerCount: z.number().int().nonnegative(),
  materialFindingCount: z.number().int().nonnegative(),
  openFindingCount: z.number().int().nonnegative(),
  missingMaterialEvidenceCount: z.number().int().nonnegative(),
  unresolvedCalculationExceptionCount: z.number().int().nonnegative(),
  recommendedDecision: z.enum([
    "DO_NOT_SUBMIT", "REMEDIATE_BEFORE_REVIEW", "READY_TO_HAND_OVER",
  ]),
  canSeal: z.boolean(),
  decisionReasonCodes: z.array(z.string().min(1)),
});
export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;

export const RequirementOwnerSchema = z.enum([
  "OPERATOR", "CBAMVALID_SYSTEM", "INDEPENDENT_VERIFIER",
]);
export type RequirementOwner = z.infer<typeof RequirementOwnerSchema>;

export const RequirementCrosswalkStatusSchema = z.enum([
  "COMPLETE",
  "PARTIAL",
  "MISSING",
  "NOT_APPLICABLE",
  "PENDING_EXTERNAL_VERIFIER",
]);
export type RequirementCrosswalkStatus = z.infer<typeof RequirementCrosswalkStatusSchema>;

export const VerificationRequirementCrosswalkRowSchema = z.object({
  requirementId: z.string().min(1),
  legalSourceId: z.string().min(1),
  legalLocation: z.string().min(1),
  requirementText: z.string().min(1),
  owner: RequirementOwnerSchema,
  reportSectionIds: z.array(z.string().min(1)),
  inputPaths: z.array(z.string().min(1)),
  evidenceIds: z.array(z.string().min(1)),
  calculationIds: z.array(z.string().min(1)),
  status: RequirementCrosswalkStatusSchema,
  reasonCodes: z.array(z.string().min(1)),
});
export type VerificationRequirementCrosswalkRow = z.infer<typeof VerificationRequirementCrosswalkRowSchema>;

export const ReportingPeriodTypeSchema = z.enum([
  "DEFINITIVE_ANNUAL",
  "INTERIM_QUARTERLY",
  "INTERIM_MONTHLY",
  "CUSTOM_INTERNAL",
]);
export type ReportingPeriodType = z.infer<typeof ReportingPeriodTypeSchema>;

export const ReportingPeriodAssessmentSchema = z.object({
  type: ReportingPeriodTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reportingYear: z.number().int(),
  coveredDays: z.number().int(),
  expectedDays: z.number().int(),
  completenessPercent: z.string(),
  definitiveAnnualEligible: z.boolean(),
  hardBlockerFindingIds: z.array(z.string()),
});
export type ReportingPeriodAssessment = z.infer<typeof ReportingPeriodAssessmentSchema>;

export const PreviousReleaseSchema = z.object({
  version: z.number().int(),
  reportId: z.string(),
  sealedAt: z.string(),
  status: z.string(),
  correctionReason: z.string().nullable().optional(),
});
export type PreviousRelease = z.infer<typeof PreviousReleaseSchema>;

export const PremiumDossierViewModelSchema = z.object({
  schemaVersion: z.literal("CBAMVALID-DOSSIER-5.0"),
  reportingPeriodAssessment: ReportingPeriodAssessmentSchema,
  reportId: z.string().min(1),
  caseId: z.string().min(1),
  releaseVersion: z.number().int().min(1),
  generatedAt: z.string().datetime(),
  documentTitle: z.string().min(1),
  legalBoundary: z.string().min(1),
  caseDataHash: z.string().optional(),
  calculationRootHash: z.string().optional(),
  identity: z.object({
    importer: z.string(),
    eori: z.string(),
    exporterOperator: z.string(),
    installation: z.string(),
    country: z.string(),
    productionRoute: z.string(),
    reportingPeriod: z.string(),
    systemBoundary: z.string(),
  }),
  scope: z.object({
    sector: z.string(),
    processes: z.array(z.string()),
    cnCodes: z.array(z.string()),
  }),
  totals: z.object({
    installationDirectEmissions: z.string(),
    electricityIndirectEmissions: z.string(),
    precursorDirectEmissions: z.string(),
    precursorIndirectEmissions: z.string(),
    totalDirectEmissions: z.string(),
    totalIndirectEmissions: z.string(),
    totalEmbeddedEmissions: z.string(),
    productionVolume: z.string(),
    aggregateSpecificEmbeddedEmissions: z.string(),
    allocationShareTotal: z.string(),
    allocationReconciliationDelta: z.string(),
    eligibleCertificateReduction: z.string(),
  }),
  goods: z.array(z.object({
    goodIndex: z.number().int(),
    cnCode: z.string(),
    sector: z.string(),
    productionVolume: z.string(),
    productionUnit: z.string(),
    allocationShare: z.string(),
    allocatedEmbeddedEmissions: z.string(),
    specificEmbeddedEmissions: z.string(),
    materialityThresholdSpecific: z.string(),
    traceCalculationId: z.string(),
  })),
  precursors: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
    directEmissions: z.string(),
    indirectEmissions: z.string(),
    countryOfOrigin: z.string(),
  })),
  readiness: ReadinessAssessmentSchema,
  findings: z.array(FindingSchema),
  correctiveActions: z.array(CorrectiveActionSchema),
  evidenceSufficiency: z.array(EvidenceSufficiencyRowSchema),
  requirementCrosswalk: z.array(VerificationRequirementCrosswalkRowSchema),
  calculationTrace: z.array(CalculationTraceNodeSchema),
  manifestSummary: z.object({
    totalFiles: z.number().int(),
    manifestHash: z.string(),
    packageHash: z.string(),
  }),
  previousReleases: z.array(PreviousReleaseSchema).optional(),
});

export type PremiumDossierViewModel = z.infer<typeof PremiumDossierViewModelSchema>;

export const PremiumDossierViewModelV2Schema = PremiumDossierViewModelSchema.extend({
  productCode: z.literal("pack_premium_dossier_v5"),
  releaseContractVersion: z.literal(5),
  dossierSchemaVersion: z.literal("CBAMVALID-DOSSIER-5.0"),
  manifestSummary: z.object({
    totalFiles: z.number().int(),
    manifestHash: z.string(),
    packageHash: z.string(),
    requiredTopLevelComponentCount: z.number().int(),
    actualTopLevelComponentCount: z.number().int(),
    manifestFileCount: z.number().int(),
    evidenceFileCount: z.number().int(),
    kmsKeyVersion: z.string(),
    kmsAlgorithm: z.string(),
    signatureBase64: z.string(),
    publicVerificationState: z.string(),
  }),
});

export type PremiumDossierViewModelV2 = z.infer<typeof PremiumDossierViewModelV2Schema>;

export const SealAssessmentContextSchema = z.object({
  generatedAt: z.string(),
  assessmentTimestamp: z.string(),
  reportId: z.string(),
  releaseVersion: z.number().int().positive(),
  rulesetVersion: z.string(),
  /** Server-trusted product code from reserved entitlement — never client-supplied. */
  productCode: z.string().optional(),
  /** Explicit V5 contract marker derived from entitlement.productCode only. */
  releaseContractVersion: z.literal(5).optional(),
  previousReleases: z.array(PreviousReleaseSchema).optional(),
});
export type SealAssessmentContext = z.infer<typeof SealAssessmentContextSchema>;

/** Explicit V5 gate — productCode or releaseContractVersion from server assessment context only. */
export function isExplicitV5Contract(ctx?: {
  productCode?: string;
  releaseContractVersion?: number;
}): boolean {
  return ctx?.productCode === "pack_premium_dossier_v5" || ctx?.releaseContractVersion === 5;
}
