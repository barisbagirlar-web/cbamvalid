"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditReadyCaseSchema = exports.CaseStatusSchema = exports.GapRecordSchema = exports.GapSeveritySchema = exports.CalculationTraceNodeSchema = exports.CarbonPricePaidSchema = exports.EvidenceRecordSchema = exports.InputDatumSchema = void 0;
const zod_1 = require("zod");
exports.InputDatumSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    value: zod_1.z.union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null()]),
    rawUnit: zod_1.z.string().optional(),
    canonicalUnit: zod_1.z.string().optional(),
    unit: zod_1.z.string().optional(),
    reportingPeriod: zod_1.z.string().optional(),
    sourceType: zod_1.z.enum(["PRIMARY", "DEFAULT", "SECONDARY", "ESTIMATED", "REGULATORY"]),
    evidenceId: zod_1.z.string().optional(),
    documentReference: zod_1.z.string().optional(),
    measurementMethod: zod_1.z.string().optional(),
    confidenceStatus: zod_1.z.enum(["HIGH_VERIFIED", "MEDIUM_DOCUMENTED", "LOW_ESTIMATE", "DEFAULT", "DEFAULT_ASSIGNED"]),
    responsiblePerson: zod_1.z.string().optional(),
    reviewerNote: zod_1.z.string().optional(),
});
exports.EvidenceRecordSchema = zod_1.z.object({
    evidenceId: zod_1.z.string().uuid(),
    documentType: zod_1.z.string().min(1),
    fileName: zod_1.z.string().min(1),
    storagePath: zod_1.z.string().min(1),
    mimeType: zod_1.z.string().min(1),
    sizeBytes: zod_1.z.number().int().nonnegative(),
    issuer: zod_1.z.string(),
    issueDate: zod_1.z.string(),
    reportingPeriod: zod_1.z.string(),
    pageReference: zod_1.z.string().optional(),
    fileHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/i),
    uploadTimestamp: zod_1.z.string().datetime(),
    uploader: zod_1.z.string(),
    reviewStatus: zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]),
    supportStatus: zod_1.z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "UNSUPPORTED", "NOT_REQUIRED"]).default("UNSUPPORTED"),
    confidentiality: zod_1.z.enum(["CONFIDENTIAL", "INTERNAL", "PUBLIC"]).default("CONFIDENTIAL"),
    linkedInputs: zod_1.z.array(zod_1.z.string()),
    linkedCalculations: zod_1.z.array(zod_1.z.string()),
    reviewerNotes: zod_1.z.string().optional()
});
exports.CarbonPricePaidSchema = zod_1.z.object({
    id: zod_1.z.string(),
    amountPaid: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    applicableEmissions: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    currency: zod_1.z.string().length(3),
    paymentPeriod: zod_1.z.string(),
    legislationReference: zod_1.z.string(),
    proofOfPaymentEvidenceId: zod_1.z.string().optional(),
    rebateInformation: zod_1.z.string().optional(),
    independentCertificationEvidenceId: zod_1.z.string().optional(),
    conversionMethod: zod_1.z.string().optional(),
    eligibleCertificateReduction: zod_1.z.union([zod_1.z.number(), zod_1.z.string()])
});
exports.CalculationTraceNodeSchema = zod_1.z.object({
    calculationId: zod_1.z.string(),
    formulaId: zod_1.z.string(),
    formulaVersion: zod_1.z.string(),
    officialSource: zod_1.z.string(),
    sourceVersion: zod_1.z.string(),
    effectiveDate: zod_1.z.string(),
    inputs: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    conversions: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    intermediateCalculations: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    roundingApplied: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    assumptions: zod_1.z.array(zod_1.z.string()),
    warnings: zod_1.z.array(zod_1.z.string()),
    outputValue: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    outputUnit: zod_1.z.string(),
    calculationHash: zod_1.z.string()
});
exports.GapSeveritySchema = zod_1.z.enum(["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "ADVISORY"]);
exports.GapRecordSchema = zod_1.z.object({
    gapId: zod_1.z.string(),
    issueType: zod_1.z.enum([
        "missing evidence",
        "data inconsistency",
        "misstatement",
        "non-conformity",
        "methodology deviation",
        "materiality risk",
        "unresolved assumption",
        "calculation blocker"
    ]).optional(),
    requirement: zod_1.z.string(),
    severity: exports.GapSeveritySchema,
    affectedResult: zod_1.z.string().optional(),
    whyItMatters: zod_1.z.string(),
    requiredEvidence: zod_1.z.string(),
    suggestedAction: zod_1.z.string(),
    responsibleParty: zod_1.z.string().optional(),
    deadline: zod_1.z.string().optional(),
    isBlocking: zod_1.z.boolean(),
    resolutionStatus: zod_1.z.enum(["OPEN", "IN_PROGRESS", "EVIDENCE_REQUESTED", "CORRECTED", "RECALCULATED", "REVIEWED", "RESOLVED"]),
    resolutionEvidenceIds: zod_1.z.array(zod_1.z.string()).optional(),
    closureNote: zod_1.z.string().optional()
});
exports.CaseStatusSchema = zod_1.z.enum(["DRAFT", "REVIEW_REQUIRED", "VERIFICATION_READY", "SEALED", "SUPERSEDED", "REVOKED"]);
exports.AuditReadyCaseSchema = zod_1.z.object({
    caseId: zod_1.z.string().min(1).optional(),
    status: exports.CaseStatusSchema.default("DRAFT"),
    version: zod_1.z.number().int().positive().default(1),
    ownerId: zod_1.z.string().min(1),
    importerIdentity: zod_1.z.object({
        legalName: exports.InputDatumSchema,
        eoriNumber: exports.InputDatumSchema,
        address: exports.InputDatumSchema.optional()
    }),
    exporterIdentity: zod_1.z.object({
        legalName: exports.InputDatumSchema,
        address: exports.InputDatumSchema.optional()
    }),
    reportingPeriod: zod_1.z.object({
        year: exports.InputDatumSchema,
        quarter: exports.InputDatumSchema,
    }),
    goods: zod_1.z.array(zod_1.z.object({
        cnCode: exports.InputDatumSchema,
        sector: zod_1.z.string(),
        productionVolume: exports.InputDatumSchema,
        shipmentRecords: exports.InputDatumSchema,
        allocationShare: exports.InputDatumSchema.optional()
    })),
    installation: zod_1.z.object({
        name: exports.InputDatumSchema,
        unloCode: exports.InputDatumSchema.optional(),
        country: exports.InputDatumSchema,
        productionRoute: exports.InputDatumSchema,
        systemBoundaries: zod_1.z.string().optional()
    }),
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
    carbonPriceRecords: zod_1.z.array(exports.CarbonPricePaidSchema),
    evidenceRegister: zod_1.z.array(exports.EvidenceRecordSchema),
    calculationTrace: zod_1.z.array(exports.CalculationTraceNodeSchema),
    gapAssessment: zod_1.z.array(exports.GapRecordSchema),
    methodologyDecisions: zod_1.z.array(zod_1.z.object({
        decisionId: zod_1.z.string(),
        topic: zod_1.z.string(),
        selectedMethod: zod_1.z.string(),
        reason: zod_1.z.string(),
        legalOrTechnicalBasis: zod_1.z.string(),
        evidenceIds: zod_1.z.array(zod_1.z.string()),
        rejectedAlternativeReason: zod_1.z.string().optional(),
        reviewStatus: zod_1.z.enum(["PENDING", "ACCEPTED", "REVIEW_REQUIRED"]),
        rulesetVersion: zod_1.z.string()
    })).default([]),
    auditEvents: zod_1.z.array(zod_1.z.object({
        eventId: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        actor: zod_1.z.string(),
        action: zod_1.z.string(),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
    }))
});
//# sourceMappingURL=schema.js.map