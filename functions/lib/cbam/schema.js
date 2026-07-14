"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyInput = exports.AuditReadyCaseSchema = exports.CaseStatusSchema = exports.GapRecordSchema = exports.GapSeveritySchema = exports.CalculationTraceNodeSchema = exports.CarbonPricePaidSchema = exports.EvidenceRecordSchema = exports.InputDatumSchema = void 0;
const zod_1 = require("zod");
// Base Input Standard
exports.InputDatumSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    value: zod_1.z.union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null()]),
    unit: zod_1.z.string(),
    reportingPeriod: zod_1.z.string().optional(),
    sourceType: zod_1.z.enum(["PRIMARY", "DEFAULT", "SECONDARY", "ESTIMATED"]),
    evidenceId: zod_1.z.string().optional(), // Links to EvidenceRegister
    documentReference: zod_1.z.string().optional(),
    measurementMethod: zod_1.z.string().optional(),
    confidenceStatus: zod_1.z.enum(["HIGH_VERIFIED", "MEDIUM_DOCUMENTED", "LOW_ESTIMATE", "DEFAULT"]),
    responsiblePerson: zod_1.z.string().optional(),
    reviewerNote: zod_1.z.string().optional(),
});
// Evidence Record System
exports.EvidenceRecordSchema = zod_1.z.object({
    evidenceId: zod_1.z.string().uuid(),
    documentType: zod_1.z.string(), // e.g. "CUSTOMS_DECLARATION", "SUPPLIER_INVOICE", "LAB_REPORT"
    fileName: zod_1.z.string(),
    issuer: zod_1.z.string(),
    issueDate: zod_1.z.string(),
    reportingPeriod: zod_1.z.string(),
    pageReference: zod_1.z.string().optional(),
    fileHash: zod_1.z.string(),
    uploadTimestamp: zod_1.z.string().datetime(),
    uploader: zod_1.z.string().optional(),
    reviewStatus: zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]),
    supportStatus: zod_1.z.enum(["PENDING", "SUPPORTED", "UNSUPPORTED", "PARTIALLY_SUPPORTED"]).default("PENDING"),
    malwareScanStatus: zod_1.z.enum(["CLEAN", "INFECTED", "PENDING"]).default("CLEAN"),
    linkedInputs: zod_1.z.array(zod_1.z.string()), // IDs of InputDatum
    linkedCalculations: zod_1.z.array(zod_1.z.string()), // IDs of Calculation traces
    reviewerNotes: zod_1.z.string().optional()
});
// Carbon Price Paid Module
exports.CarbonPricePaidSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    amountPaid: zod_1.z.number().min(0),
    applicableEmissions: zod_1.z.number().min(0),
    currency: zod_1.z.string().length(3),
    paymentPeriod: zod_1.z.string(),
    legislationReference: zod_1.z.string(),
    proofOfPaymentEvidenceId: zod_1.z.string().uuid(),
    rebateInformation: zod_1.z.string().optional(),
    independentCertificationEvidenceId: zod_1.z.string().uuid().optional(),
    conversionMethod: zod_1.z.string().optional(),
    eligibleCertificateReduction: zod_1.z.number().min(0)
});
// Calculation Trace Node
exports.CalculationTraceNodeSchema = zod_1.z.object({
    calculationId: zod_1.z.string().uuid(),
    formulaId: zod_1.z.string(),
    formulaVersion: zod_1.z.string(),
    officialSource: zod_1.z.string(),
    sourceVersion: zod_1.z.string(),
    effectiveDate: zod_1.z.string(),
    inputs: zod_1.z.record(zod_1.z.string(), zod_1.z.any()), // Raw inputs mapped
    conversions: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    intermediateCalculations: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    roundingApplied: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    assumptions: zod_1.z.array(zod_1.z.string()),
    warnings: zod_1.z.array(zod_1.z.string()),
    outputValue: zod_1.z.number(),
    outputUnit: zod_1.z.string(),
    calculationHash: zod_1.z.string()
});
// Gap Assessment Severity
exports.GapSeveritySchema = zod_1.z.enum([
    "BLOCKER",
    "CRITICAL",
    "MAJOR",
    "MINOR",
    "ADVISORY"
]);
exports.GapRecordSchema = zod_1.z.object({
    gapId: zod_1.z.string().uuid(),
    requirement: zod_1.z.string(),
    severity: exports.GapSeveritySchema,
    affectedResult: zod_1.z.string().optional(),
    whyItMatters: zod_1.z.string(),
    requiredEvidence: zod_1.z.string(),
    suggestedAction: zod_1.z.string(),
    responsibleParty: zod_1.z.string().optional(),
    deadline: zod_1.z.string().optional(),
    isBlocking: zod_1.z.boolean(),
    resolutionStatus: zod_1.z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"])
});
// Global Case Status
exports.CaseStatusSchema = zod_1.z.enum([
    "DRAFT",
    "REVIEW_REQUIRED",
    "VERIFICATION_READY",
    "SEALED",
    "SUPERSEDED",
    "REVOKED"
]);
// Main Case Payload
exports.AuditReadyCaseSchema = zod_1.z.object({
    caseId: zod_1.z.string().uuid().optional(),
    status: exports.CaseStatusSchema.default("DRAFT"),
    version: zod_1.z.number().default(1),
    // 1. Case Identity
    ownerId: zod_1.z.string(),
    importerIdentity: zod_1.z.object({
        legalName: exports.InputDatumSchema,
        eoriNumber: exports.InputDatumSchema,
        address: exports.InputDatumSchema.optional()
    }),
    exporterIdentity: zod_1.z.object({
        legalName: exports.InputDatumSchema,
        address: exports.InputDatumSchema.optional()
    }),
    // 2. Reporting Profile
    reportingPeriod: zod_1.z.object({
        year: exports.InputDatumSchema,
        quarter: exports.InputDatumSchema,
    }),
    // 3. Products
    goods: zod_1.z.array(zod_1.z.object({
        cnCode: exports.InputDatumSchema,
        sector: zod_1.z.string(),
        productionVolume: exports.InputDatumSchema,
        shipmentRecords: exports.InputDatumSchema
    })),
    // 4. Installation & Boundaries
    installation: zod_1.z.object({
        name: exports.InputDatumSchema,
        unloCode: exports.InputDatumSchema.optional(),
        country: exports.InputDatumSchema,
        productionRoute: exports.InputDatumSchema,
        systemBoundaries: zod_1.z.string().optional()
    }),
    // 5. Emissions
    directEmissions: exports.InputDatumSchema,
    electricityConsumed: exports.InputDatumSchema,
    gridEmissionFactor: exports.InputDatumSchema,
    precursors: zod_1.z.array(zod_1.z.object({
        name: exports.InputDatumSchema,
        quantity: exports.InputDatumSchema,
        directEmissions: exports.InputDatumSchema,
        indirectEmissions: exports.InputDatumSchema,
        countryOfOrigin: exports.InputDatumSchema
    })),
    // 6. Sub-Systems
    carbonPriceRecords: zod_1.z.array(exports.CarbonPricePaidSchema),
    evidenceRegister: zod_1.z.array(exports.EvidenceRecordSchema),
    calculationTrace: zod_1.z.array(exports.CalculationTraceNodeSchema),
    gapAssessment: zod_1.z.array(exports.GapRecordSchema),
    // 7. Audit Manifest
    auditEvents: zod_1.z.array(zod_1.z.object({
        eventId: zod_1.z.string().uuid(),
        timestamp: zod_1.z.string().datetime(),
        actor: zod_1.z.string(),
        action: zod_1.z.string(),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
    }))
});
// Helper function to create an empty InputDatum
const createEmptyInput = (unit = "") => ({
    value: null,
    unit,
    sourceType: "ESTIMATED",
    confidenceStatus: "LOW_ESTIMATE"
});
exports.createEmptyInput = createEmptyInput;
//# sourceMappingURL=schema.js.map