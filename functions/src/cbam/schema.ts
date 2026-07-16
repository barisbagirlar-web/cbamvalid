import { z } from "zod";
import { CaseIdSchema } from "./case-id";

export const InputDatumSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === "object") {
      const copy = { ...val };
      for (const k of [
        "id",
        "rawUnit",
        "canonicalUnit",
        "unit",
        "reportingPeriod",
        "evidenceId",
        "documentReference",
        "measurementMethod",
        "responsiblePerson",
        "reviewerNote",
      ]) {
        if (copy[k] === null) {
          delete copy[k];
        }
      }
      return copy;
    }
    return val;
  },
  z.object({
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
  })
);

export type InputDatum = z.infer<typeof InputDatumSchema>;

export const EvidenceReviewStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const EvidenceSupportStatusSchema = z.enum([
  "PENDING",
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "UNSUPPORTED",
  "NOT_REQUIRED",
]);

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
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceReviewStatus = z.infer<typeof EvidenceReviewStatusSchema>;
export type EvidenceSupportStatus = z.infer<typeof EvidenceSupportStatusSchema>;

export const CarbonPricePaidSchema = z.object({
  id: z.string().uuid(),
  amountPaid: z.union([z.number().finite().nonnegative(), z.string()]),
  applicableEmissions: z.union([z.number().finite().nonnegative(), z.string()]),
  currency: z.enum(["EUR", "USD", "GBP", "TRY"]),
  paymentPeriod: z.string().trim().min(1),
  legislationReference: z.string().trim().min(1),
  proofOfPaymentEvidenceId: z.string().uuid().optional(),
  rebateInformation: z.string().optional(),
  independentCertificationEvidenceId: z.string().uuid().optional(),
  conversionMethod: z.string().optional(),
  eligibleCertificateReduction: z.union([z.number().finite().nonnegative(), z.string()]),
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
  outputValue: z.union([z.number().finite(), z.string()]),
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

export const MethodologyDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  topic: z.string().trim().min(1),
  selectedMethod: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  legalOrTechnicalBasis: z.string().trim().min(1),
  evidenceIds: z.array(z.string().uuid()),
  rejectedAlternativeReason: z.string().optional(),
  reviewStatus: z.enum(["PENDING", "ACCEPTED", "REVIEW_REQUIRED"]),
  rulesetVersion: z.string().min(1),
});

export type MethodologyDecision = z.infer<typeof MethodologyDecisionSchema>;

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
    address: InputDatumSchema.optional(),
  }),
  exporterIdentity: z.object({
    legalName: InputDatumSchema,
    address: InputDatumSchema.optional(),
  }),
  reportingPeriod: z.object({
    year: InputDatumSchema,
    quarter: InputDatumSchema,
  }),
  goods: z.array(z.object({
    cnCode: InputDatumSchema,
    sector: z.string().min(1),
    productionVolume: InputDatumSchema,
    shipmentRecords: InputDatumSchema,
    allocationShare: InputDatumSchema.optional(),
  })),
  installation: z.object({
    name: InputDatumSchema,
    unloCode: InputDatumSchema.optional(),
    country: InputDatumSchema,
    productionRoute: InputDatumSchema,
    systemBoundaries: z.string().optional(),
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
  })),
  carbonPriceRecords: z.array(CarbonPricePaidSchema),
  evidenceRegister: z.array(EvidenceRecordSchema),
  calculationTrace: z.array(CalculationTraceNodeSchema),
  gapAssessment: z.array(GapRecordSchema),
  methodologyDecisions: z.array(MethodologyDecisionSchema).default([]),
  auditEvents: z.array(z.object({
    eventId: z.string().uuid(),
    timestamp: z.string().datetime(),
    actor: z.string(),
    action: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
});

export type AuditReadyCase = z.infer<typeof AuditReadyCaseSchema>;
