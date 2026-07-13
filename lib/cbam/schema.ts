import { z } from "zod";

export const DecimalStringSchema = z.string().regex(/^-?\d*\.?\d+$/, "Must be a valid decimal string");

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
  "fraction"
]);

export type UnitCode = z.infer<typeof UnitCodeSchema>;

export const InputDatumSchema = z.object({
  id: z.string().uuid().optional(),
  value: z.union([DecimalStringSchema, z.string(), z.null()]),
  rawUnit: z.string().optional(),
  canonicalUnit: UnitCodeSchema.optional(),
  reportingPeriod: z.string().optional(),
  sourceType: z.enum(["PRIMARY", "DEFAULT", "SECONDARY", "ESTIMATED", "REGULATORY"]),
  evidenceId: z.string().optional(),
  documentReference: z.string().optional(),
  measurementMethod: z.string().optional(),
  confidenceStatus: z.enum(["HIGH_VERIFIED", "MEDIUM_DOCUMENTED", "LOW_ESTIMATE", "DEFAULT_ASSIGNED"]),
  responsiblePerson: z.string().optional(),
  reviewerNote: z.string().optional(),
});

export type InputDatum = z.infer<typeof InputDatumSchema>;

export const EvidenceRecordSchema = z.object({
  evidenceId: z.string().uuid(),
  documentType: z.string().min(1),
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  issuer: z.string(),
  issueDate: z.string(),
  reportingPeriod: z.string(),
  pageReference: z.string().optional(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  uploadTimestamp: z.string().datetime(),
  uploader: z.string(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  supportStatus: z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "UNSUPPORTED", "NOT_REQUIRED"]).default("UNSUPPORTED"),
  confidentiality: z.enum(["CONFIDENTIAL", "INTERNAL", "PUBLIC"]).default("CONFIDENTIAL"),
  linkedInputs: z.array(z.string()),
  linkedCalculations: z.array(z.string()),
  reviewerNotes: z.string().optional()
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const CarbonPricePaidSchema = z.object({
  id: z.string().uuid(),
  amountPaid: DecimalStringSchema,
  applicableEmissions: DecimalStringSchema,
  currency: UnitCodeSchema,
  paymentPeriod: z.string(),
  legislationReference: z.string(),
  proofOfPaymentEvidenceId: z.string().uuid().optional(),
  rebateInformation: z.string().optional(),
  independentCertificationEvidenceId: z.string().uuid().optional(),
  conversionMethod: z.string().optional(),
  eligibleCertificateReduction: DecimalStringSchema
});

export type CarbonPricePaidRecord = z.infer<typeof CarbonPricePaidSchema>;

export const CalculationTraceNodeSchema = z.object({
  calculationId: z.string(),
  formulaId: z.string(),
  formulaVersion: z.string(),
  officialSource: z.string(),
  sourceVersion: z.string(),
  effectiveDate: z.string(),
  inputs: z.record(z.string(), z.any()),
  conversions: z.record(z.string(), z.any()).optional(),
  intermediateCalculations: z.record(z.string(), z.any()).optional(),
  roundingApplied: z.record(z.string(), z.any()).optional(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  outputValue: z.union([DecimalStringSchema, z.literal("NOT_CALCULATED")]),
  outputUnit: z.string(),
  calculationHash: z.string()
});

export type CalculationTraceNode = z.infer<typeof CalculationTraceNodeSchema>;

export const GapSeveritySchema = z.enum([
  "BLOCKER",
  "CRITICAL",
  "MAJOR",
  "MINOR",
  "ADVISORY"
]);

export type GapSeverity = z.infer<typeof GapSeveritySchema>;

export const GapRecordSchema = z.object({
  gapId: z.string(),
  issueType: z.enum([
    "missing evidence",
    "data inconsistency",
    "misstatement",
    "non-conformity",
    "methodology deviation",
    "materiality risk",
    "unresolved assumption",
    "calculation blocker"
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
  resolutionStatus: z.enum(["OPEN", "IN_PROGRESS", "EVIDENCE_REQUESTED", "CORRECTED", "RECALCULATED", "REVIEWED", "RESOLVED"]),
  resolutionEvidenceIds: z.array(z.string()).optional(),
  closureNote: z.string().optional()
});

export type GapRecord = z.infer<typeof GapRecordSchema>;

export const CaseStatusSchema = z.enum([
  "DRAFT",
  "REVIEW_REQUIRED",
  "VERIFICATION_READY",
  "SEALED",
  "SUPERSEDED",
  "REVOKED"
]);

export const AuditReadyCaseSchema = z.object({
  caseId: z.string().min(1).optional(),
  status: CaseStatusSchema.default("DRAFT"),
  version: z.number().int().positive().default(1),
  ownerId: z.string().min(1),
  importerIdentity: z.object({
    legalName: InputDatumSchema,
    eoriNumber: InputDatumSchema,
    address: InputDatumSchema.optional()
  }),
  exporterIdentity: z.object({
    legalName: InputDatumSchema,
    address: InputDatumSchema.optional()
  }),
  reportingPeriod: z.object({
    year: InputDatumSchema,
    quarter: InputDatumSchema,
  }),
  goods: z.array(z.object({
    cnCode: InputDatumSchema,
    sector: z.string(),
    productionVolume: InputDatumSchema,
    shipmentRecords: InputDatumSchema,
    allocationShare: InputDatumSchema.optional()
  })),
  installation: z.object({
    name: InputDatumSchema,
    unloCode: InputDatumSchema.optional(),
    country: InputDatumSchema,
    productionRoute: InputDatumSchema,
    systemBoundaries: z.string().optional()
  }),
  directEmissions: InputDatumSchema,
  electricityConsumed: InputDatumSchema,
  gridEmissionFactor: InputDatumSchema,
  precursors: z.array(z.object({
    name: InputDatumSchema,
    quantity: InputDatumSchema,
    directEmissions: InputDatumSchema,
    indirectEmissions: InputDatumSchema,
    countryOfOrigin: InputDatumSchema
  })),
  carbonPriceRecords: z.array(CarbonPricePaidSchema),
  evidenceRegister: z.array(EvidenceRecordSchema),
  calculationTrace: z.array(CalculationTraceNodeSchema),
  gapAssessment: z.array(GapRecordSchema),
  methodologyDecisions: z.array(z.object({
    decisionId: z.string(),
    topic: z.string(),
    selectedMethod: z.string(),
    reason: z.string(),
    legalOrTechnicalBasis: z.string(),
    evidenceIds: z.array(z.string()),
    rejectedAlternativeReason: z.string().optional(),
    reviewStatus: z.enum(["PENDING", "ACCEPTED", "REVIEW_REQUIRED"]),
    rulesetVersion: z.string()
  })).default([]),
  auditEvents: z.array(z.object({
    eventId: z.string(),
    timestamp: z.string().datetime(),
    actor: z.string(),
    action: z.string(),
    metadata: z.record(z.string(), z.any()).optional()
  }))
});

export type AuditReadyCase = z.infer<typeof AuditReadyCaseSchema>;

export const createEmptyInput = (canonicalUnit?: UnitCode): InputDatum => ({
  value: null,
  canonicalUnit,
  sourceType: "ESTIMATED",
  confidenceStatus: "LOW_ESTIMATE"
});
