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
import { type Enterprise1000Model, upgradeArtifactsToEnterprise1000 } from "./enterprise-1000-value-layer";
import { buildVerifierPackageModel } from "./verifier-model";
import { computeTwoAxisScores } from "./v6/two-axis-score";
import { derivePackageReadinessState } from "./v6/package-state";
import {
  buildMasterRecordModel,
  MASTER_RECORD_MANIFEST_REFERENCE,
  MASTER_RECORD_SIGNATURE_REFERENCE,
} from "./v6/master-record-model";
import { buildMasterRecordPdf } from "./v6/master-record-pdf";

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
    releaseContractVersion: 5 | 6 | 7;
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
        releaseContractVersion: params.releaseContractVersion,
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

    // Enterprise 1,000 USD mandate gate. ALL legacy human-facing PDFs are
    // removed first. The accepted package may foreground exactly 11 newly
    // rendered non-overlapping decision/workpaper PDFs — no legacy duplicate or
    // hidden compilation is allowed to survive alongside them.
    let enterpriseModel: Enterprise1000Model | undefined;
    if (params.productCode === "pack_premium_dossier_v5" || params.releaseContractVersion >= 5) {
      const machineAndEvidenceArtifacts = unsignedArtifacts.filter(
        (item) => !item.path.toLowerCase().endsWith(".pdf")
      );
      const enterpriseUpgrade = upgradeArtifactsToEnterprise1000({
        artifacts: machineAndEvidenceArtifacts,
        caseData: artifactCaseData,
        calculation: params.calculation,
        controls: params.controls,
        reportId: params.reportId,
        packageCode: params.packageCode,
        releaseVersion: params.releaseVersion,
        generatedAt: params.generatedAt,
      });
      enterpriseModel = enterpriseUpgrade.enterprise;
      unsignedArtifacts = enterpriseUpgrade.artifacts.map((item) =>
        item.path === "Verifier First Meeting & Handover Pack.pdf"
          ? { ...item, path: "Complete Dossier Compilation.pdf" }
          : item
      );
      // The historical path is a stable API/download identifier only. Its
      // rendered title and content are the dedicated Verifier First Meeting &
      // Handover Pack; no duplicate compilation remains. Keeping the path
      // avoids breaking already-integrated download clients and report metadata.
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

    // V6+: Enterprise Compliance Master Record is an operator corporate
    // record, not a verifier ZIP member. Render it after enterprise
    // transformation, keep it out of the signed ZIP, and use generatedAt as
    // the customer-facing period/state clock (assessmentTimestamp may only
    // validate controlled QA evidence).
    let masterRecordPdf: Buffer | null = null;
    if (params.releaseContractVersion >= 6) {
      const customerFacingClock = params.generatedAt;
      const scores = computeTwoAxisScores({ caseData: artifactCaseData, assessmentTimestamp: customerFacingClock });
      const stateDecision = derivePackageReadinessState({
        caseData: artifactCaseData,
        assessmentTimestamp: customerFacingClock,
        scores,
      });
      const masterRecordModel = buildMasterRecordModel({
        caseData: artifactCaseData,
        calculation: params.calculation,
        controls: params.controls,
        model: buildVerifierPackageModel({
          caseData: artifactCaseData,
          calculation: params.calculation,
          controls: params.controls,
          reportId: params.reportId,
          packageCode: params.packageCode,
          releaseVersion: params.releaseVersion,
          generatedAt: params.generatedAt,
          assessmentTimestamp: customerFacingClock,
          productCode: params.productCode,
          releaseContractVersion: params.releaseContractVersion,
        }),
        reportId: params.reportId,
        packageCode: params.packageCode,
        releaseVersion: params.releaseVersion,
        schemaVersion: "CBAMVALID-DOSSIER-7.0",
        engineVersion: params.calculation.engineVersion,
        generatedAt: params.generatedAt,
        manifestReference: MASTER_RECORD_MANIFEST_REFERENCE,
        signatureAlgorithm: "RSA_SIGN_PSS_4096_SHA256",
        signatureReference: MASTER_RECORD_SIGNATURE_REFERENCE,
        signatureProtectionLevel: "FULL",
        scores,
        state: stateDecision.state,
        stateReasonCodes: stateDecision.reasonCodes,
        graphRootHash: params.calculation.calculationRootHash,
        graphNodeHashes: params.calculation.trace.map((item) => ({ formulaId: item.formulaId, hash: item.calculationHash })),
      });
      masterRecordPdf = buildMasterRecordPdf(masterRecordModel);
    }

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
      releaseContractVersion: params.releaseContractVersion,
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
      enterprise: enterpriseModel,
      masterRecordPdf,
    };
  }
}
