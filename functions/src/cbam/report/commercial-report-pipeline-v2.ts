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
    // Build every final report file exactly once. Package/manifest hashes are intentionally
    // absent from PDFs because a ZIP hash cannot be embedded without changing that ZIP.
    const finalArtifacts = await buildUnsignedVerifierArtifacts({
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

    const manifestResult = buildDataIntegrityManifest({
      artifacts: finalArtifacts,
      caseData: params.caseData,
      calculation: params.calculation,
      reportId: params.reportId,
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      evidenceCount: params.evidenceFiles.length,
      productCode: params.productCode,
      releaseContractVersion: 5,
    });

    const signature = await params.signManifest(manifestResult.bytes);
    const finalPackage = await finalizeVerifierPackage({
      artifacts: finalArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      generatedAt: params.generatedAt,
    });

    return {
      artifacts: finalArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      packageResult: finalPackage,
    };
  }
}
