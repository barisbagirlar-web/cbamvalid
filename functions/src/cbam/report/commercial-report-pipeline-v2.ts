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
import type { HonestScoreboard } from "./honest-scoreboard";
import { normalizeXlsxEntryTimestamps } from "./deterministic-xlsx";
import {
  assertCliGraphArtifactConsistency,
  buildCliVerifiableCalculationGraph,
} from "./canonical-calculation-graph";
import {
  assertPremiumPackagePreconditions,
  hardenVerifierArtifacts,
  prepareCaseForVerifierArtifacts,
} from "./premium-package-hardening";
import { resolveControlledCaseAssessmentTimestamp } from "./controlled-test-assessment";
import { upgradeArtifactsToEnterprise1000 } from "./enterprise-1000-value-layer";

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
    /**
     * @deprecated Production graph bytes are derived from Calculation Trace.
     * Kept in the call contract temporarily so older callers compile, but the
     * value is deliberately ignored to prevent parallel-engine drift.
     */
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
    honestScoreboard?: HonestScoreboard;
    versionStamp?: { product: string; schema: string; rulesetId: string; releaseIteration: number };
    publicVerificationUrl?: string | null;
  }) {
    // Controlled QA cases may use a synthetic assessment clock for validating
    // future-dated evidence. That clock is NEVER used as the customer-facing
    // enterprise-readiness truth clock: the mandate uses the immutable real
    // package generatedAt timestamp for reporting-period readiness.
    const assessmentTimestamp = resolveControlledCaseAssessmentTimestamp(
      params.caseData,
      params.generatedAt
    );

    // Verifier-grade fail-closed gates run before any commercial artifact is
    // rendered or KMS-signed. A failure here must leave no signed package.
    assertPremiumPackagePreconditions({
      caseData: params.caseData,
      calculation: params.calculation,
      generatedAt: assessmentTimestamp,
    });

    // linkedCalculations is deterministic derivative metadata. Enrich only the
    // private artifact-generation copy; never mutate the operator source object.
    const artifactCaseData = prepareCaseForVerifierArtifacts(params.caseData, params.calculation);

    // Calculation Graph has exactly one source of truth: Calculation Trace.
    const canonicalGraph = buildCliVerifiableCalculationGraph(params.calculation);

    let unsignedArtifacts = await buildUnsignedVerifierArtifacts({
      caseData: artifactCaseData,
      calculation: params.calculation,
      controls: params.controls,
      reportId: params.reportId,
      packageCode: params.packageCode,
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      evidenceFiles: params.evidenceFiles,
      calcGraph: canonicalGraph,
      honestScoreboard: params.honestScoreboard,
      publicVerificationUrl: params.publicVerificationUrl,
      assessmentContext: {
        generatedAt: params.generatedAt,
        assessmentTimestamp,
        reportId: params.reportId,
        packageCode: params.packageCode,
        releaseVersion: params.releaseVersion,
        rulesetVersion: params.calculation.ruleset,
        productCode: params.productCode,
        releaseContractVersion: 5,
      },
    });

    // Materialise evidence→calculation lineage and add formula-driven
    // independent recomputation before commercial package transformation.
    unsignedArtifacts = await hardenVerifierArtifacts({
      artifacts: unsignedArtifacts,
      caseData: artifactCaseData,
      calculation: params.calculation,
      graph: canonicalGraph,
    });

    // Enterprise 1,000 USD mandate gate. V5 human-review PDFs are rebuilt into
    // 11 non-overlapping workpapers, one authoritative readiness status is
    // applied using real generatedAt, evidence grades receive independent-
    // verifiability bases, corrective actions become closure-complete, and the
    // scenario/materiality/first-meeting premium layers are generated. This
    // runs BEFORE manifest hashing/KMS so a mandate failure cannot be signed.
    if (params.productCode === "pack_premium_dossier_v5" || params.releaseContractVersion === 5) {
      const enterpriseUpgrade = upgradeArtifactsToEnterprise1000({
        artifacts: unsignedArtifacts,
        caseData: artifactCaseData,
        calculation: params.calculation,
        controls: params.controls,
        reportId: params.reportId,
        packageCode: params.packageCode,
        releaseVersion: params.releaseVersion,
        generatedAt: params.generatedAt,
      });
      unsignedArtifacts = enterpriseUpgrade.artifacts;
    }

    // Hardening and enterprise transformation add/rewrite workbook/ZIP members;
    // pin XLSX member timestamps to the immutable release timestamp.
    unsignedArtifacts = await Promise.all(
      unsignedArtifacts.map(async (item) =>
        item.path === "Verifier Workspace.xlsx"
          ? { ...item, bytes: await normalizeXlsxEntryTimestamps(item.bytes, params.generatedAt) }
          : item
      )
    );

    // Graph/Trace/Workbook must still satisfy the exact offline-verifier
    // hashing and cross-artifact value/unit contract after the mandate rewrite.
    assertCliGraphArtifactConsistency(unsignedArtifacts, params.calculation);

    const manifestResult = buildDataIntegrityManifest({
      artifacts: unsignedArtifacts,
      caseData: artifactCaseData,
      calculation: params.calculation,
      reportId: params.reportId,
      releaseVersion: params.releaseVersion,
      generatedAt: params.generatedAt,
      evidenceCount: params.evidenceFiles.length,
      productCode: params.productCode,
      releaseContractVersion: 5,
    });

    // Sign the exact canonical manifest bytes. These bytes never change after signing.
    const signature = await params.signManifest(manifestResult.bytes);

    const finalPackage = await finalizeVerifierPackage({
      artifacts: unsignedArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      generatedAt: params.generatedAt,
    });

    const sealedScoreboard = params.honestScoreboard
      ? { ...params.honestScoreboard, packageIntegrity: "PASS" as const }
      : undefined;

    return {
      artifacts: unsignedArtifacts,
      manifestBytes: manifestResult.bytes,
      signature,
      packageResult: finalPackage,
      scoreboard: sealedScoreboard,
    };
  }
}
