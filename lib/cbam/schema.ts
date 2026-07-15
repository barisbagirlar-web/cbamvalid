import { z } from "zod";

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
  evidenceId: z.string().optional(), // Links to EvidenceRegister
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
  documentType: z.string(), // e.g. "CUSTOMS_DECLARATION", "SUPPLIER_INVOICE", "LAB_REPORT"
  fileName: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  reportingPeriod: z.string(),
  pageReference: z.string().optional(),
  fileHash: z.string(),
  uploadTimestamp: z.string().datetime(),
  uploader: z.string(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  linkedInputs: z.array(z.string()), // IDs of InputDatum
  linkedCalculations: z.array(z.string()), // IDs of Calculation traces
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
  inputs: z.record(z.string(), z.any()), // Raw inputs mapped
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
  caseId: z.string().uuid().optional(),
  status: CaseStatusSchema.default("DRAFT"),
  version: z.number().default(1),
  
  // 1. Case Identity
  ownerId: z.string(),
  importerIdentity: z.object({
    legalName: InputDatumSchema,
    eoriNumber: InputDatumSchema,
    address: InputDatumSchema.optional()
  }),
  exporterIdentity: z.object({
    legalName: InputDatumSchema,
    address: InputDatumSchema.optional()
  }),
  
  // 2. Reporting Profile
  reportingPeriod: z.object({
    year: InputDatumSchema,
    quarter: InputDatumSchema,
  }),
  
  // 3. Products
  goods: z.array(z.object({
    cnCode: InputDatumSchema,
    sector: z.string(),
    productionVolume: InputDatumSchema,
    shipmentRecords: InputDatumSchema
  })),
  
  // 4. Installation & Boundaries
  installation: z.object({
    name: InputDatumSchema,
    unloCode: InputDatumSchema.optional(),
    country: InputDatumSchema,
    productionRoute: InputDatumSchema,
    systemBoundaries: z.string().optional()
  }),
  
  // 5. Emissions
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

  // 6. Sub-Systems
  carbonPriceRecords: z.array(CarbonPricePaidSchema),
  evidenceRegister: z.array(EvidenceRecordSchema),
  calculationTrace: z.array(CalculationTraceNodeSchema),
  gapAssessment: z.array(GapRecordSchema),
  
  // 7. Audit Manifest
  auditEvents: z.array(z.object({
    eventId: z.string().uuid(),
    timestamp: z.string().datetime(),
    actor: z.string(),
    action: z.string(),
    metadata: z.record(z.string(), z.any()).optional()
  }))
});

export type AuditReadyCase = z.infer<typeof AuditReadyCaseSchema>;

// Helper function to create an empty InputDatum
export const createEmptyInput = (canonicalUnit?: UnitCode): InputDatum => ({
  value: null,
  canonicalUnit,
  sourceType: "ESTIMATED",
  confidenceStatus: "LOW_ESTIMATE"
});
