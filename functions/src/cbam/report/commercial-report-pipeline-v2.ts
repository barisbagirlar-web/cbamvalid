import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import {
  buildUnsignedVerifierArtifacts,
  buildDataIntegrityManifest,
  finalizeVerifierPackage,
  type EvidenceBinary,
} from "./verifier-package-builder";
import type { KmsSignatureResult } from "./kms-signature";

export class CommercialReportPipelineV2 {
  public static async executeSealingPipeline(params: {
    caseData: AuditReadyCase;
    calculation: DossierCalculationResult;
    controls: QualityControlResult[];
    reportId: string;
    packageCode: string;
    releaseVersion: number;
    generatedAt: string;
    evidenceFiles: EvidenceBinary[];
    productCode: string;
    releaseContractVersion: number;
    signManifest: (manifestBytes: Buffer) => Promise<KmsSignatureResult>;
    calcGraph?: {
      rootHash: string;
      nodes: ReadonlyArray<{
        id: string;
        label: string;
        formula: string;
        legalBasis: readonly string[];
        inputNodes: readonly string[];
        inputPaths: readonly { path: string }[];
        value: { toString(): string };
        unit: string;
        hash: string;
      }>;
    };
    honestScoreboard?: {
      operatorReadiness: number;
      verifierReservedCount: number;
      verifierReservedTotal: number;
      dossierCompleteness: number;
      status: string;
      formula: string;
    };
    versionStamp?: { product: string; schema: string; rulesetId: string; releaseIteration: number };
    publicVerificationUrl?: string | null;
  }) {
    // --- Pass 1: Build Unsigned Artifacts (single pass) ---
    // Artifacts are rendered ONCE with placeholder hash values.
    // The PDF references the manifest/signature/Package receipt hash
    // by canonical location name only — never embedding the actual hash,
    // avoiding the cyclic hash dependency.
    const unsignedArtifacts = await buildUnsignedVerifierArtifacts({
      caseData: params.caseData,
      calculation: params.calculation,
      controls: params.controls,
      reportId: params.reportId,
      packageCode: params.packageCode,
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      evidenceFiles: params.evidenceFiles,
      calcGraph: params.calcGraph,
      assessmentContext: {
        generatedAt: params.generatedAt,
        assessmentTimestamp: params.generatedAt,
        reportId: params.reportId,
        packageCode: params.packageCode,
        releaseVersion: params.releaseVersion,
        rulesetVersion: params.calculation.ruleset,
        productCode: params.productCode,
        releaseContractVersion: 5,
      },
    });

    // Build data integrity manifest using these artifacts
    const manifestResult = buildDataIntegrityManifest({
      artifacts: unsignedArtifacts,
      caseData: params.caseData,
      calculation: params.calculation,
      reportId: params.reportId,
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      evidenceCount: params.evidenceFiles.length,
      productCode: params.productCode,
      releaseContractVersion: 5,
    });

    // --- KMS Signing ---
    // Sign the exact canonical manifest bytes. These bytes MUST NOT change
    // after signing — no re-render pass is permitted.
    const signature = await params.signManifest(manifestResult.bytes);

    // --- Finalize (verify manifest/artifact contract, create ZIP, verify ZIP, verify signature) ---
    const finalPackage = await finalizeVerifierPackage({
      artifacts: unsignedArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      generatedAt: params.generatedAt,
    });

    return {
      artifacts: unsignedArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      packageResult: finalPackage,
    };
  }
}
