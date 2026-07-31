/**
 * FAZ P0 — Shared helper that builds a fully sealed verifier package for each
 * of the four sandbox dossiers, mirroring the server seal pipeline
 * (calculations → quality controls → unsigned artifacts → manifest → signature
 * → finalized ZIP). Used by the four-dossier, cross-format, editorial and
 * render-QA test suites so every suite exercises the identical package bytes.
 */

import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
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

export const DOSSIER_RELEASE_VERSION = 5;
export const DOSSIER_PRODUCT_CODE = "pack_premium_dossier_v5";

export function dossierReportId(key: FourDossierKey): string {
  return `report_${key.toLowerCase()}_fixture`;
}

export function dossierPackageCode(key: FourDossierKey): string {
  return `pack_${key.toLowerCase()}_fixture`;
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
    assessmentContext: {
      generatedAt,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      reportId,
      packageCode,
      releaseVersion: DOSSIER_RELEASE_VERSION,
      rulesetVersion: FOUR_DOSSIER_RULESET,
      productCode: DOSSIER_PRODUCT_CODE,
      releaseContractVersion: DOSSIER_RELEASE_VERSION,
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
    releaseContractVersion: DOSSIER_RELEASE_VERSION,
  });

  const finalized = await finalizeVerifierPackage({
    artifacts,
    manifestBytes: manifestResult.bytes,
    signature: createSignature(manifestResult.bytes),
    generatedAt,
  });

  return { key, caseData, evidenceFiles, controls, calculation, artifacts, manifestResult, finalized };
}
