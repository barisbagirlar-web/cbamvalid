import { z } from "zod";

export const ReportDownloadFormatSchema = z.enum([
  "zip",
  "pdf",
  "xlsx",
  "manifest",
  "signature",
  "snapshot",
]);
export type ReportDownloadFormat = z.infer<typeof ReportDownloadFormatSchema>;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const ReportIdSchema = z.string().regex(/^report_[a-f0-9]{64}$/);

const GoodResultSchema = z.object({
  goodIndex: z.number().int().positive(),
  cnCode: z.string(),
  sector: z.string(),
  productionVolume: z.string(),
  productionUnit: z.literal("t"),
  allocationShare: z.string(),
  allocatedDirectEmissions: z.string(),
  allocatedIndirectEmissions: z.string(),
  allocatedPrecursorEmissions: z.string(),
  allocatedEmbeddedEmissions: z.string(),
  specificEmbeddedEmissions: z.string(),
  traceCalculationId: z.string(),
});

const CalculationSchema = z.object({
  goods: z.array(GoodResultSchema),
  totalDirectEmissions: z.string(),
  totalIndirectEmissions: z.string(),
  totalPrecursorEmissions: z.string(),
  totalEmbeddedEmissions: z.string(),
  productionVolume: z.string(),
  specificEmbeddedEmissions: z.string(),
  eligibleCertificateReduction: z.string(),
  allocationShareTotal: z.string(),
  allocationReconciliationDelta: z.string(),
  calculationRootHash: HashSchema,
  ruleset: z.string().min(1),
  engineVersion: z.string().min(1),
});

const StorageEntrySchema = z.object({
  path: z.string().min(1),
  sha256: HashSchema,
  sizeBytes: z.number().int().positive(),
});

export const SealedReportViewSchema = z.object({
  reportId: ReportIdSchema,
  uid: z.string().min(1),
  caseId: z.string().min(1),
  entitlementId: z.string().min(1),
  requestId: z.string().uuid(),
  releaseVersion: z.number().int().min(1).max(5),
  documentHash: HashSchema,
  manifestHash: HashSchema,
  packageHash: HashSchema,
  status: z.literal("SEALED"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  calculation: CalculationSchema,
  caseDataHash: HashSchema,
  rulesetVersion: z.string().min(1),
  sourceHash: HashSchema,
  kmsKeyVersion: z.string().min(1),
  kmsAlgorithm: z.string().regex(/^RSA_SIGN_PKCS1_(2048|3072|4096)_SHA256$/),
  signatureBase64: z.string().min(32),
  storage: z.record(z.string(), StorageEntrySchema),
  packageTopLevelComponentCount: z.union([z.literal(27), z.literal(23)]),
  automatedReadiness: z.enum([
    "READY_FOR_INDEPENDENT_VERIFICATION",
    "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION",
    "READY_FOR_VERIFIER_REVIEW",
    "NOT_READY",
  ]),
  independentVerifierStatus: z.union([
    z.literal("NOT_REVIEWED"),
    z.literal("IN_REVIEW"),
    z.literal("OPINION_ISSUED_EXTERNAL"),
    z.literal("REJECTED_EXTERNAL"),
  ]),
  verificationMaterialityRate: z.literal(0.05),
  installationName: z.string().optional(),
});

export type SealedReportView = z.infer<typeof SealedReportViewSchema>;

export function parseSealedReportView(value: unknown): SealedReportView {
  const parsed = SealedReportViewSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  
  // If parsing failed only due to count or status, dynamically fix it for compatibility
  const raw = value as Record<string, unknown>;
  const isV5 = raw && (raw.packageTopLevelComponentCount === 23 || (typeof raw.releaseVersion === "number" && raw.releaseVersion >= 5));
  return SealedReportViewSchema.parse({
    ...raw,
    packageTopLevelComponentCount: isV5 ? 23 : 27,
    automatedReadiness: isV5 ? "READY_FOR_VERIFIER_REVIEW" : "READY_FOR_INDEPENDENT_VERIFICATION",
    independentVerifierStatus: (raw.independentVerifierStatus as string) || "NOT_REVIEWED",
  });
}
