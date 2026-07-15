import { z } from "zod";
import { CaseIdSchema } from "./case-id";

// Decimal-Safe Strings
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
  "tCO2e/MWh"
]);

export type UnitCode = z.infer<typeof UnitCodeSchema>;

// Base Input Standard
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

// Evidence Record System
export const EvidenceRecordSchema = z.object({
  evidenceId: z.string().uuid(),
  documentType: z.string(),
  fileName: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  reportingPeriod: z.string(),
  pageReference: z.string().optional(),
  fileHash: z.string(),
  uploadTimestamp: z.string().datetime(),
  uploader: z.string().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  supportStatus: z.enum(["PENDING", "SUPPORTED", "UNSUPPORTED", "PARTIALLY_SUPPORTED"]).default("PENDING"),
  malwareScanStatus: z.enum(["CLEAN", "INFECTED", "PENDING"]).default("CLEAN"),
  linkedInputs: z.array(z.string()),
  linkedCalculations: z.array(z.string()),
  reviewerNotes: z.string().optional()
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

// Carbon Price Paid Module
export const CarbonPricePaidSchema = z.object({
  id: z.string().uuid(),
  amountPaid: DecimalStringSchema,
  applicableEmissions: DecimalStringSchema,
  currency: UnitCodeSchema,
  paymentPeriod: z.string(),
  legislationReference: z.string(),
  proofOfPaymentEvidenceId: z.string().uuid(),
  rebateInformation: z.string().optional(),
  independentCertificationEvidenceId: z.string().uuid().optional(),
  conversionMethod: z.string().optional(),
  eligibleCertificateReduction: DecimalStringSchema
});

export type CarbonPricePaidRecord = z.infer<typeof CarbonPricePaidSchema>;

// Calculation Trace Node
export const CalculationTraceNodeSchema = z.object({
  calculationId: z.string().uuid(),
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
  outputValue: DecimalStringSchema,
  outputUnit: UnitCodeSchema,
  calculationHash: z.string()
});

export type CalculationTraceNode = z.infer<typeof CalculationTraceNodeSchema>;

// Gap Assessment Severity
export const GapSeveritySchema = z.enum([
  "BLOCKER",
  "CRITICAL",
  "MAJOR",
  "MINOR",
  "ADVISORY"
]);

export type GapSeverity = z.infer<typeof GapSeveritySchema>;

export const GapRecordSchema = z.object({
  gapId: z.string().uuid(),
  requirement: z.string(),
  severity: GapSeveritySchema,
  affectedResult: z.string().optional(),
  whyItMatters: z.string(),
  requiredEvidence: z.string(),
  suggestedAction: z.string(),
  responsibleParty: z.string().optional(),
  deadline: z.string().optional(),
  isBlocking: z.boolean(),
  resolutionStatus: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"])
});

export type GapRecord = z.infer<typeof GapRecordSchema>;

// Global Case Status
export const CaseStatusSchema = z.enum([
  "DRAFT",
  "REVIEW_REQUIRED",
  "VERIFICATION_READY",
  "SEALED",
  "SUPERSEDED",
  "REVOKED"
]);

// Main Case Payload
export const AuditReadyCaseSchema = z.object({
  caseId: CaseIdSchema.optional(),
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
    shipmentRecords: InputDatumSchema
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
  auditEvents: z.array(z.object({
    eventId: z.string().uuid(),
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
