import { z } from "zod";
import { CaseIdSchema } from "./case-id";

export const DecimalStringSchema = z.string().regex(/^-?(?:\d+\.?\d*|\.\d+)$/, "Must be a valid decimal string");

export const UnitCodeSchema = z.enum([
  "t",
  "kg",
  "tCO2e",
  "tCO2e/t",
  "MWh",
  "EUR",
  "USD",
  "GBP",
  "TRY",
  "tCO2e/MWh",
  "fraction",
]);

export type UnitCode = z.infer<typeof UnitCodeSchema>;

export const InputDatumSchema = z.object({
  id: z.string().uuid().optional(),
  value: z.union([z.number().finite(), z.string(), z.null()]),
  rawUnit: z.string().optional(),
  canonicalUnit: z.string().optional(),
  unit: z.string().optional(),
  reportingPeriod: z.string().optional(),
  sourceType: z.enum(["PRIMARY", "DEFAULT", "SECONDARY", "ESTIMATED", "REGULATORY"]),
  evidenceId: z.string().uuid().optional(),
  documentReference: z.string().optional(),
  measurementMethod: z.string().optional(),
  confidenceStatus: z.enum([
    "HIGH_VERIFIED",
    "MEDIUM_DOCUMENTED",
    "LOW_ESTIMATE",
    "DEFAULT",
    "DEFAULT_ASSIGNED",
  ]),
  responsiblePerson: z.string().optional(),
  reviewerNote: z.string().optional(),
});

export type InputDatum = z.infer<typeof InputDatumSchema>;

export const EvidenceReviewStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const EvidenceSupportStatusSchema = z.enum([
  "PENDING",
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "UNSUPPORTED",
  "NOT_REQUIRED",
]);

export const IssuerCategorySchema = z.enum([
  "GOVERNMENT_AUTHORITY",
  "CUSTOMS_AUTHORITY",
  "NATIONAL_REGISTRY",
  "GRID_OPERATOR",
  "REGULATED_UTILITY",
  "ACCREDITED_LAB",
  "ACCREDITED_VERIFICATION_BODY",
  "INDEPENDENT_AUDITOR",
  "OPERATOR_CONTROLLED",
  "SUPPLIER",
  "SECONDARY_SOURCE",
]);
export type IssuerCategory = z.infer<typeof IssuerCategorySchema>;

export const DocumentAuthoritySchema = z.enum([
  "OFFICIAL",
  "INDEPENDENT",
  "OPERATOR",
  "SUPPLIER",
  "SECONDARY",
]);
export type DocumentAuthority = z.infer<typeof DocumentAuthoritySchema>;

export const QualityGradeSchema = z.enum(["A", "B", "C", "D", "E", "PENDING"]);
export type QualityGrade = z.infer<typeof QualityGradeSchema>;

export const EvidenceRecordSchema = z.object({
  evidenceId: z.string().uuid(),
  documentType: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(240),
  storagePath: z.string().trim().min(1).max(1024),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  issuer: z.string().trim().min(1).max(240),
  issueDate: z.string().trim().min(1).max(40),
  reportingPeriod: z.string().trim().max(80),
  pageReference: z.string().trim().max(160).optional(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  uploadTimestamp: z.string().datetime(),
  uploader: z.string().min(1),
  reviewStatus: EvidenceReviewStatusSchema.default("PENDING"),
  supportStatus: EvidenceSupportStatusSchema.default("PENDING"),
  malwareScanStatus: z.enum(["CLEAN", "INFECTED", "PENDING"]).default("PENDING"),
  confidentiality: z.enum(["CONFIDENTIAL", "INTERNAL", "PUBLIC"]).default("CONFIDENTIAL"),
  linkedInputs: z.array(z.string().min(1)).min(1),
  linkedCalculations: z.array(z.string()),
  reviewerNotes: z.string().trim().min(5).max(2000).optional(),
  evidencePeriodStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  evidencePeriodEnd: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  issuerCategory: IssuerCategorySchema.nullable().optional(),
  documentAuthority: DocumentAuthoritySchema.nullable().optional(),
  qualityGrade: QualityGradeSchema.nullable().optional(),
  qualityAssessmentBasis: z.string().trim().max(400).optional(),
  qualityAssessedBy: z.string().trim().max(200).optional(),
  qualityAssessedAt: z.string().datetime().optional(),
  officialReference: z.string().trim().max(240).optional(),
  accreditationReference: z.string().trim().max(240).optional(),
  // Sandbox QA reviewer provenance (set only in the isolated QA sandbox;
  // production evidence records never carry these fields).
  reviewerId: z.string().trim().max(200).optional(),
  reviewerRole: z.string().trim().max(200).optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewRulesetVersion: z.string().trim().max(120).optional(),
  reviewEnvironment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceReviewStatus = z.infer<typeof EvidenceReviewStatusSchema>;
export type EvidenceSupportStatus = z.infer<typeof EvidenceSupportStatusSchema>;

export const CarbonPricePaidSchema = z.object({
  id: z.string().uuid(),
  amountPaid: z.union([z.number().finite().nonnegative(), DecimalStringSchema]),
  applicableEmissions: z.union([z.number().finite().nonnegative(), DecimalStringSchema]),
  currency: z.enum(["EUR", "USD", "GBP", "TRY"]),
  paymentPeriod: z.string().trim().min(1),
  legislationReference: z.string().trim().min(1),
  proofOfPaymentEvidenceId: z.string().uuid().optional(),
  rebateInformation: z.string().optional(),
  independentCertificationEvidenceId: z.string().uuid().optional(),
  conversionMethod: z.string().optional(),
  eligibleCertificateReduction: z.union([z.number().finite().nonnegative(), DecimalStringSchema]),
});

export type CarbonPricePaidRecord = z.infer<typeof CarbonPricePaidSchema>;

export const CalculationTraceNodeSchema = z.object({
  calculationId: z.string().min(1),
  formulaId: z.string().min(1),
  formulaVersion: z.string().min(1),
  officialSource: z.string().min(1),
  sourceVersion: z.string().min(1),
  effectiveDate: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
  conversions: z.record(z.string(), z.unknown()).optional(),
  intermediateCalculations: z.record(z.string(), z.unknown()).optional(),
  roundingApplied: z.record(z.string(), z.unknown()).optional(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  outputValue: z.union([z.number().finite(), DecimalStringSchema, z.literal("NOT_CALCULATED")]),
  outputUnit: z.string().min(1),
  calculationHash: z.string().min(1),
});

export type CalculationTraceNode = z.infer<typeof CalculationTraceNodeSchema>;

export const GapSeveritySchema = z.enum(["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "ADVISORY"]);
export type GapSeverity = z.infer<typeof GapSeveritySchema>;

export const GapRecordSchema = z.object({
  gapId: z.string().min(1),
  issueType: z.enum([
    "missing evidence",
    "data inconsistency",
    "misstatement",
    "non-conformity",
    "methodology deviation",
    "materiality risk",
    "unresolved assumption",
    "calculation blocker",
  ]).optional(),
  requirement: z.string(),
  severity: GapSeveritySchema,
  affectedResult: z.string().optional(),
  whyItMatters: z.string(),
  requiredEvidence: z.string(),
  suggestedAction: z.string(),
  responsibleParty: z.string().optional(),
  deadline: z.string().optional(),
  isBlocking: z.boolean(),
  resolutionStatus: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "EVIDENCE_REQUESTED",
    "CORRECTED",
    "RECALCULATED",
    "REVIEWED",
    "RESOLVED",
  ]),
  resolutionEvidenceIds: z.array(z.string()).optional(),
  closureNote: z.string().optional(),
});

export type GapRecord = z.infer<typeof GapRecordSchema>;

export const MethodologyDecisionSchema = z
  .object({
    decisionId: z.string().uuid(),
    topic: z.string().trim().min(1),
    selectedMethod: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    legalOrTechnicalBasis: z.string().trim().min(1),
    evidenceIds: z.array(z.string().uuid()),
    rejectedAlternativeReason: z.string().optional(),
    reviewStatus: z.enum(["PENDING", "ACCEPTED", "REVIEW_REQUIRED"]),
    rulesetVersion: z.string().min(1),
    approverName: z.string().trim().min(1).optional(),
    approverRole: z.string().trim().min(1).optional(),
    approvedAt: z.string().datetime().optional(),
    decisionEnvironment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  })
  .superRefine((decision, context) => {
    // ACCEPTED is a server-controlled review outcome only. A record that
    // claims acceptance must carry full approval provenance; client-created
    // records default to REVIEW_REQUIRED and therefore never reach this path.
    if (decision.reviewStatus !== "ACCEPTED") return;
    if (!decision.approverName?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["approverName"],
        message: "An accepted methodology decision requires approverName.",
      });
    }
    if (!decision.approverRole?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["approverRole"],
        message: "An accepted methodology decision requires approverRole.",
      });
    }
    if (!decision.approvedAt) {
      context.addIssue({
        code: "custom",
        path: ["approvedAt"],
        message: "An accepted methodology decision requires approvedAt.",
      });
    }
  });

export type MethodologyDecision = z.infer<typeof MethodologyDecisionSchema>;

export const VerifierReservedFieldsSchema = z.object({
  verifierLegalName: z.string().trim().min(1).optional(),
  verifierAddress: z.string().trim().min(1).optional(),
  accreditationNumber: z.string().trim().min(1).optional(),
  nationalAccreditationBody: z.string().trim().min(1).optional(),
  accreditationCountry: z.string().trim().min(1).optional(),
  accreditationExpiry: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accreditationScope: z.string().trim().min(1).optional(),
  teamLeader: z.string().trim().min(1).optional(),
  cbamLeadAuditor: z.string().trim().min(1).optional(),
  auditors: z.array(z.string().trim().min(1)).optional(),
  technicalExperts: z.array(z.string().trim().min(1)).optional(),
  independentReviewer: z.string().trim().min(1).optional(),
  siteVisitType: z.enum(["PHYSICAL", "VIRTUAL", "WAIVED", "NOT_ASSIGNED"]).optional(),
  siteVisitDates: z.string().trim().min(1).optional(),
  daysOnSite: z.number().int().nonnegative().optional(),
  virtualVisitJustification: z.string().trim().min(1).optional(),
  waiverJustification: z.string().trim().min(1).optional(),
  verificationObjectives: z.string().trim().min(1).optional(),
  verificationScope: z.string().trim().min(1).optional(),
  criteria: z.string().trim().min(1).optional(),
  materialityLevelPerGood: z.record(z.string(), z.number().min(0).max(1)).optional(),
  finalOpinion: z.enum(["NO_OPINION", "FAIR_PRESENTATION", "QUALIFIED", "ADVERSE", "WITHDRAWN"]).optional(),
  signature: z.string().trim().min(1).optional(),
  certificateReference: z.string().trim().min(1).optional(),
  // FAZ P0 — Operator preparation inputs handed to the independent verifier:
  // risk registers, per-good materiality workpapers and the sampling plan.
  // These are operator-entered preparation records, never verifier conclusions.
  preparationInputs: z
    .object({
      riskRegister: z
        .array(
          z.object({
            riskId: z.string().trim().min(1),
            riskCategory: z.enum(["INHERENT", "CONTROL", "DETECTION"]),
            description: z.string().trim().min(1),
            likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
            impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
            mitigation: z.string().trim().optional(),
          })
        )
        .optional(),
      materialityWorkpapers: z
        .array(
          z.object({
            goodIndex: z.number().int().nonnegative(),
            cnCode: z.string().trim().min(1),
            basis: z.enum(["REGULATORY", "CALCULATION", "EXPERT_JUDGEMENT"]),
            materialityRate: z.number().min(0).max(1),
            verifierStatus: z.string().trim().min(1),
          })
        )
        .optional(),
      samplingPlan: z
        .object({
          population: z.string().trim().min(1),
          rationale: z.string().trim().min(1),
          sampleSelection: z.string().trim().min(1),
          sampleSize: z.number().int().nonnegative(),
        })
        .optional(),
    })
    .optional(),
});

export type VerifierReservedFields = z.infer<typeof VerifierReservedFieldsSchema>;

export const CaseStatusSchema = z.enum([
  "DRAFT",
  "REVIEW_REQUIRED",
  "VERIFICATION_READY",
  "SEALED",
  "SUPERSEDED",
  "REVOKED",
]);

export const AuditReadyCaseSchema = z.object({
  caseId: CaseIdSchema.optional(),
  status: CaseStatusSchema.default("DRAFT"),
  version: z.number().int().positive().default(1),
  ownerId: z.string().min(1),
  importerIdentity: z.object({
    legalName: InputDatumSchema,
    eoriNumber: InputDatumSchema,
    address: InputDatumSchema.nullable().optional(),
  }),
  exporterIdentity: z.object({
    legalName: InputDatumSchema,
    address: InputDatumSchema.nullable().optional(),
    registrationNumber: InputDatumSchema.optional(),
    contactPerson: InputDatumSchema.optional(),
    contactRole: InputDatumSchema.optional(),
    contactEmail: InputDatumSchema.optional(),
    exporterCountry: InputDatumSchema.optional(),
    operatorDeclaration: InputDatumSchema.optional(),
    preparerSignOff: InputDatumSchema.optional(),
    internalReviewerSignOff: InputDatumSchema.optional(),
  }),
  reportingPeriod: z.object({
    year: InputDatumSchema,
    quarter: InputDatumSchema,
    startDate: InputDatumSchema.nullable().optional(),
    endDate: InputDatumSchema.nullable().optional(),
  }),
  goods: z.array(z.object({
    cnCode: InputDatumSchema,
    sector: z.string().min(1),
    productionVolume: InputDatumSchema,
    shipmentRecords: InputDatumSchema,
    allocationShare: InputDatumSchema.nullable().optional(),
  })).default([]),
  installation: z.object({
    name: InputDatumSchema,
    registryInstallationId: InputDatumSchema.optional(),
    unloCode: InputDatumSchema.nullable().optional(),
    address: InputDatumSchema.optional(),
    latitude: InputDatumSchema.optional(),
    longitude: InputDatumSchema.optional(),
    country: InputDatumSchema,
    productionRoute: InputDatumSchema,
    systemBoundaries: z.string().nullable().optional(),
    excludedProcesses: z.string().nullable().optional(),
    functionalUnits: z.string().nullable().optional(),
    installationDiagramEvidenceId: z.string().uuid().optional(),
    monitoringPlanId: InputDatumSchema.optional(),
    monitoringPlanVersion: InputDatumSchema.optional(),
    monitoringPlanEffectiveDate: InputDatumSchema.optional(),
  }),
  directEmissions: InputDatumSchema,
  electricityConsumed: InputDatumSchema,
  gridEmissionFactor: InputDatumSchema,
  precursors: z.array(z.object({
    name: InputDatumSchema,
    quantity: InputDatumSchema,
    directEmissions: InputDatumSchema,
    indirectEmissions: InputDatumSchema,
    countryOfOrigin: InputDatumSchema,
  })).default([]),
  carbonPriceRecords: z.array(CarbonPricePaidSchema).default([]),
  evidenceRegister: z.array(EvidenceRecordSchema).default([]),
  calculationTrace: z.array(CalculationTraceNodeSchema).default([]),
  gapAssessment: z.array(GapRecordSchema).default([]),
  methodologyDecisions: z.array(MethodologyDecisionSchema).default([]),
  verifierReserved: VerifierReservedFieldsSchema.optional(),
  operatorSignOffs: z
    .array(
      z.object({
        role: z.enum(["OPERATOR_PREPARER", "INTERNAL_REVIEWER", "DATA_OWNER"]),
        name: z.string().min(1),
        title: z.string().min(1),
        signedAt: z.string().min(1),
      })
    )
    .default([]),
  auditEvents: z.array(z.object({
    eventId: z.string().uuid(),
    timestamp: z.string().datetime(),
    actor: z.string(),
    action: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
});

export type AuditReadyCase = z.infer<typeof AuditReadyCaseSchema>;

export const createEmptyInput = (canonicalUnit?: string): InputDatum => ({
  value: null,
  ...(canonicalUnit ? { canonicalUnit } : {}),
  sourceType: "ESTIMATED",
  confidenceStatus: "LOW_ESTIMATE",
});
