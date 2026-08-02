/**
 * Shared helper that builds a fully sealed verifier package for each of the
 * four sandbox dossiers, mirroring the server seal pipeline
 * (calculations → quality controls → unsigned artifacts → manifest → signature
 * → finalized ZIP). Used by the four-dossier, cross-format, editorial and
 * render-QA test suites so every suite exercises identical package bytes.
 */

import { createHash } from "node:crypto";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { assessReadiness } from "../../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";
import {
  computeEvidenceAssuranceScore,
  countExternalVerifierCompletion,
  type HonestScoreboard,
} from "../../functions/src/cbam/report/honest-scoreboard";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type DataIntegrityManifest,
  type PackageArtifact,
} from "../../functions/src/cbam/report/verifier-package-builder";
import { createSignature } from "./kms-test-signer";
import {
  FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  FOUR_DOSSIER_RULESET,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
  type FourDossierKey,
} from "./four-dossiers";

/** Fresh sandbox refreshes always start at release 1. */
export const DOSSIER_RELEASE_VERSION = 1;
/** The report/package schema contract remains V5. */
export const DOSSIER_RELEASE_CONTRACT_VERSION = 5 as const;
export const DOSSIER_PRODUCT_CODE = "pack_premium_dossier_v5";
export const FOUR_DOSSIER_FIXTURE_SET = "FOUR_COMPLETE_DOSSIERS_V2";

export function dossierReportId(key: FourDossierKey): string {
  const digest = createHash("sha256")
    .update(`${FOUR_DOSSIER_FIXTURE_SET}\u0000${key}`)
    .digest("hex");
  return `report_${digest}`;
}

/** Previous fixture identity retained only for bounded sandbox cleanup. */
export function legacyDossierReportId(key: FourDossierKey): string {
  return `report_${key.toLowerCase()}_fixture`;
}

export function dossierPackageCode(key: FourDossierKey): string {
  const letter = key.slice(0, 1);
  const digits = String((key.length * 7919) % 10000).padStart(4, "0");
  return `${letter}${digits}`;
}

function buildDossierTestCalcGraph(rootHash: string): {
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
} {
  const node = (
    id: string,
    label: string,
    formula: string,
    value: string,
    unit: string,
    inputs: string[],
    basis: string[]
  ) => ({
    id,
    label,
    formula,
    legalBasis: basis,
    inputNodes: inputs,
    inputPaths: inputs.map((i) => ({ path: i })),
    value: { toString: () => value },
    unit,
    hash: "",
  });
  const nodes = [
    node("CBAM_CALC_ROOT", "Embedded Emissions", "COMBINE", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_80", "Direct Emissions", "SUM", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_INSTALL_80", "Installation Direct", "DIRECT_MEASURE", "80", "tCO2e", [], ["IR 2025/2547"]),
    node("CBAM_INDIRECT_40", "Electricity Indirect", "GRID_FACTOR*CONSUMPTION", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"], ["IR 2025/2547"]),
    node("CBAM_GRID_0.4", "Grid Emission Factor", "FACTOR", "0.4", "tCO2e/MWh", [], ["IR 2025/2547"]),
    node("CBAM_CONSUMPTION_100", "Electricity Consumption", "MEASURE", "100", "MWh", [], ["IR 2025/2547"]),
  ];
  return { rootHash, nodes };
}

function buildFixtureScoreboard(
  caseData: ReturnType<typeof AuditReadyCaseSchema.parse>
): HonestScoreboard {
  const readiness = assessReadiness({
    caseData,
    isDraft: false,
    assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    sealMode: "PREVIEW",
  });
  const sufficiency = runEvidenceSufficiency(
    caseData,
    FOUR_DOSSIER_ASSESSMENT_TIMESTAMP
  );
  const evidence = computeEvidenceAssuranceScore(sufficiency);
  const verifier = countExternalVerifierCompletion(caseData.verifierReserved);
  const operatorPreparationScore = Number(readiness.score);

  return {
    operatorReadiness: operatorPreparationScore,
    verifierReservedCount: verifier.completed,
    verifierReservedTotal: verifier.total,
    dossierCompleteness: operatorPreparationScore,
    status: readiness.operatorStatus,
    formula:
      "OPERATOR PREPARATION, EVIDENCE ASSURANCE, PACKAGE INTEGRITY and EXTERNAL VERIFIER COMPLETION are reported independently.",
    operatorPreparationScore,
    evidenceAssuranceScore: evidence.score,
    packageIntegrity: "PASS",
    externalVerifierCompleted: verifier.completed,
    externalVerifierTotal: verifier.total,
    scoreboardClaim:
      verifier.completed < verifier.total
        ? "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER PENDING"
        : "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER COMPLETE",
    premiumChapterContract: "COMPLETE",
    premiumNameVisible: true,
    productTierLabel: "Premium Dossier",
  };
}

export interface DossierSealedPackage {
  key: FourDossierKey;
  caseData: ReturnType<typeof createFourDossierCase>;
  evidenceFiles: Awaited<ReturnType<typeof buildFourDossierEvidenceFiles>>;
  controls: ReturnType<typeof runQualityControls>;
  calculation: ReturnType<typeof performDossierCalculations>;
  artifacts: PackageArtifact[];
  manifestResult: { bytes: Uint8Array; manifest: DataIntegrityManifest };
  finalized: Awaited<ReturnType<typeof finalizeVerifierPackage>>;
}

export async function buildDossierSealedPackage(key: FourDossierKey): Promise<DossierSealedPackage> {
  const rawCase = createFourDossierCase(key);
  const evidenceFiles = await buildFourDossierEvidenceFiles(rawCase);
  const caseData = AuditReadyCaseSchema.parse(rawCase);
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const calcGraph = buildDossierTestCalcGraph(calculation.calculationRootHash);
  const reportId = dossierReportId(key);
  const packageCode = dossierPackageCode(key);
  const generatedAt = FOUR_DOSSIER_ASSESSMENT_TIMESTAMP;
  const honestScoreboard = buildFixtureScoreboard(caseData);

  const artifacts = await buildUnsignedVerifierArtifacts({
    caseData,
    controls,
    calculation,
    reportId,
    packageCode,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    generatedAt,
    evidenceFiles,
    calcGraph,
    honestScoreboard,
    publicVerificationUrl: `https://sandbox.cbamvalid.com/verify/package/${reportId}`,
    assessmentContext: {
      generatedAt,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      reportId,
      packageCode,
      releaseVersion: DOSSIER_RELEASE_VERSION,
      rulesetVersion: FOUR_DOSSIER_RULESET,
      productCode: DOSSIER_PRODUCT_CODE,
      releaseContractVersion: DOSSIER_RELEASE_CONTRACT_VERSION,
    },
  });

  const manifestResult = buildDataIntegrityManifest({
    artifacts,
    caseData,
    calculation,
    reportId,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    generatedAt,
    evidenceCount: evidenceFiles.length,
    productCode: DOSSIER_PRODUCT_CODE,
    releaseContractVersion: DOSSIER_RELEASE_CONTRACT_VERSION,
  });

  const finalized = await finalizeVerifierPackage({
    artifacts,
    manifestBytes: Buffer.from(manifestResult.bytes),
    signature: createSignature(manifestResult.bytes),
    generatedAt,
  });

  return { key, caseData, evidenceFiles, controls, calculation, artifacts, manifestResult, finalized };
}
