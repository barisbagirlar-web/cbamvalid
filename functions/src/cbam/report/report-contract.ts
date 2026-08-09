import { z } from "zod";
import { VERIFICATION_MATERIALITY_RATE } from "../registry/rulesets";
import { PackageCodeSchema, resolvePackageCode } from "./package-code";
import { REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5, REQUIRED_TOP_LEVEL_COMPONENT_COUNT } from "./package-components";

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

const PackageMetadataSchema = z.object({
  schemaVersion: z.string(),
  requiredTopLevelComponentCount: z.number(),
  actualTopLevelComponentCount: z.number(),
  manifestFileCount: z.number(),
  evidenceFileCount: z.number(),
  primaryDossierFileName: z.string(),
  technicalCompilationFileName: z.string(),
  operatorEmissionsReportFileName: z.string(),
});

export const PersistedSealedReportSchema = z.object({
  reportId: ReportIdSchema,
  packageCode: PackageCodeSchema.optional(),
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
  installationName: z.string().optional(),
  packageMetadata: PackageMetadataSchema.optional(),
});

export const SealedReportViewSchema = PersistedSealedReportSchema.extend({
  packageCode: PackageCodeSchema,
  packageTopLevelComponentCount: z.number(),
  readinessScore: z.string().optional(),
  operatorReadinessStatus: z.string().optional(),
  automatedReadiness: z.enum([
    "READY_FOR_INDEPENDENT_VERIFICATION",
    "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION",
    "READY_FOR_VERIFIER_REVIEW",
    "OPERATOR_PREPARATION_COMPLETE",
    "INCOMPLETE_ASSESSMENT",
    "NOT_READY",
    "CONDITIONAL",
  ]),
  independentVerifierStatus: z.union([
    z.literal("NOT_REVIEWED"),
    z.literal("IN_REVIEW"),
    z.literal("OPINION_ISSUED_EXTERNAL"),
    z.literal("REJECTED_EXTERNAL"),
  ]),
  verificationMaterialityRate: z.literal(VERIFICATION_MATERIALITY_RATE),
});

export type PersistedSealedReport = z.infer<typeof PersistedSealedReportSchema>;
export type SealedReportView = z.infer<typeof SealedReportViewSchema>;

export function toSealedReportView(value: unknown): SealedReportView {
  const raw = { ...value as Record<string, unknown> };
  if (raw.packageMetadata && typeof raw.packageMetadata === "object") {
    const metaParse = PackageMetadataSchema.safeParse(raw.packageMetadata);
    if (!metaParse.success) {
      delete raw.packageMetadata;
    } else {
      raw.packageMetadata = metaParse.data;
    }
  }

  const report = PersistedSealedReportSchema.parse(raw);
  const isV5 =
    raw.productCode === "pack_premium_dossier_v5" ||
    raw.releaseContractVersion === 5 ||
    raw.dossierSchemaVersion === "CBAMVALID-DOSSIER-5.0";

  const manifestCount = report.packageMetadata?.actualTopLevelComponentCount;
  const defaultCount = isV5 ? REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 : REQUIRED_TOP_LEVEL_COMPONENT_COUNT;
  const storedStatus = typeof raw.operatorReadinessStatus === "string" ? raw.operatorReadinessStatus : undefined;
  const automatedReadiness = storedStatus === "OPERATOR_PREPARATION_COMPLETE" ||
    storedStatus === "INCOMPLETE_ASSESSMENT" ||
    storedStatus === "NOT_READY" ||
    storedStatus === "CONDITIONAL" ||
    storedStatus === "READY_FOR_VERIFIER_REVIEW" ||
    storedStatus === "READY_FOR_VERIFICATION"
    ? storedStatus === "READY_FOR_VERIFIER_REVIEW" || storedStatus === "READY_FOR_VERIFICATION"
      ? "OPERATOR_PREPARATION_COMPLETE"
      : storedStatus
    : isV5
      ? "OPERATOR_PREPARATION_COMPLETE"
      : "READY_FOR_INDEPENDENT_VERIFICATION";

  return SealedReportViewSchema.parse({
    ...report,
    packageCode: resolvePackageCode({ packageCode: report.packageCode, reportId: report.reportId }),
    packageTopLevelComponentCount: manifestCount !== undefined ? manifestCount : defaultCount,
    readinessScore: typeof raw.readinessScore === "string" ? raw.readinessScore : undefined,
    operatorReadinessStatus: storedStatus,
    automatedReadiness,
    independentVerifierStatus: "NOT_REVIEWED",
    verificationMaterialityRate: VERIFICATION_MATERIALITY_RATE,
  });
}
