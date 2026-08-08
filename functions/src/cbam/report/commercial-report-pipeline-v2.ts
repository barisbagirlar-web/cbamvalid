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
    // The exact TEB232 controlled QA cases deliberately model a completed
    // 2026 annual dossier assessed on 2027-01-31. Normal production cases keep
    // the immutable package creation time as their assessment clock.
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
    // Its graph hashes/root also use the exact algorithm shipped in the offline
    // verifier CLI so the customer can independently recompute the graph.
    const canonicalGraph = buildCliVerifiableCalculationGraph(params.calculation);

    // --- Pass 1: Build Unsigned Artifacts (single pass) ---
    // Artifacts are rendered ONCE with placeholder hash values.
    // The PDF references the manifest/signature/Package receipt hash
    // by canonical location name only — never embedding the actual hash,
    // avoiding the cyclic hash dependency.
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

    // Materialise evidence→calculation lineage and add a formula-driven
    // independent recomputation sheet before manifest hashing/signing.
    unsignedArtifacts = await hardenVerifierArtifacts({
      artifacts: unsignedArtifacts,
      caseData: artifactCaseData,
      calculation: params.calculation,
      graph: canonicalGraph,
    });

    // Hardening adds workbook ZIP members; normalise every XLSX member back to
    // the immutable release timestamp so equivalent releases remain byte-stable.
    unsignedArtifacts = await Promise.all(
      unsignedArtifacts.map(async (item) =>
        item.path === "Verifier Workspace.xlsx"
          ? { ...item, bytes: await normalizeXlsxEntryTimestamps(item.bytes, params.generatedAt) }
          : item
      )
    );

    // The graph must satisfy both cross-artifact Trace agreement and the exact
    // offline-verifier node/root hashing algorithm before a manifest can exist.
    assertCliGraphArtifactConsistency(unsignedArtifacts, params.calculation);

    // Build data integrity manifest using the hardened artifacts.
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

    // --- KMS Signing ---
    // Sign the exact canonical manifest bytes. These bytes MUST NOT change
    // after signing — no re-render pass is permitted.
    const signature = await params.signManifest(manifestResult.bytes);

    // --- Finalize (verify manifest/artifact contract, create ZIP, verify ZIP, verify signature) ---
    // If any integrity check fails, finalizeVerifierPackage throws and the seal aborts,
    // so a resolved package implies manifest hashes + KMS signature + ZIP readback PASS.
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
