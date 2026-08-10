/**
 * Shared build helpers for the RM-CBAMVALID-006 gate tests.
 *
 * Every gate test builds a V6 package from the seal-ready four-dossier
 * fixtures. The helper wires the calculation engine, quality controls,
 * verifier model, two-axis scores and the single package state, then exposes
 * the Enterprise Compliance Master Record model so the structure tests can
 * inspect and render it.
 */
import type { AuditReadyCase } from "../../functions/src/cbam/schema";
import type { DossierCalculationResult } from "../../functions/src/cbam/calculator";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import type { QualityControlResult } from "../../functions/src/cbam/validation/quality-controls";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import type { VerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import { buildVerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import type { TwoAxisScores } from "../../functions/src/cbam/report/v6/types";
import { computeTwoAxisScores } from "../../functions/src/cbam/report/v6/two-axis-score";
import { derivePackageReadinessState } from "../../functions/src/cbam/report/v6/package-state";
import type { PackageReadinessState } from "../../functions/src/cbam/report/v6/types";
import type { MasterRecordModel } from "../../functions/src/cbam/report/v6/master-record-model";
import {
  buildMasterRecordModel,
  MASTER_RECORD_MANIFEST_REFERENCE,
  MASTER_RECORD_SIGNATURE_REFERENCE,
} from "../../functions/src/cbam/report/v6/master-record-model";
import { createFourDossierCase, buildFourDossierEvidenceFiles, type FourDossierKey } from "../fixtures/four-dossiers";
import { FIXTURE_PACKAGE_CODE } from "../fixtures/verifier-grade-case";

export const V6_GENERATED_AT = "2027-01-31T00:00:00.000Z";
export const V6_SCHEMA_VERSION = "CBAMVALID-DOSSIER-6.0";
export const V6_ENGINE_VERSION = "4.0.0";
export const V6_RULESET = "EU-CBAM-DEFINITIVE-2026";
const V6_REPORT_ID = `report_${"v6gate".padEnd(57, "0")}`;

export interface V6BuiltPackage {
  readonly key: FourDossierKey;
  readonly caseData: AuditReadyCase;
  readonly calculation: DossierCalculationResult;
  readonly controls: readonly QualityControlResult[];
  readonly model: VerifierPackageModel;
  readonly scores: TwoAxisScores;
  readonly state: PackageReadinessState;
  readonly stateReasonCodes: readonly string[];
  readonly masterRecordModel: MasterRecordModel;
}

export async function buildV6Package(
  key: FourDossierKey,
  assessmentTimestamp = V6_GENERATED_AT
): Promise<V6BuiltPackage> {
  const caseData = createFourDossierCase(key);
  await buildFourDossierEvidenceFiles(caseData);
  return buildV6PackageFromCase(caseData, assessmentTimestamp, key);
}

export async function buildV6PackageFromCase(
  caseData: AuditReadyCase,
  assessmentTimestamp = V6_GENERATED_AT,
  key?: FourDossierKey
): Promise<V6BuiltPackage> {
  await buildFourDossierEvidenceFiles(caseData);
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const model = buildVerifierPackageModel({
    caseData,
    calculation,
    controls,
    reportId: V6_REPORT_ID,
    packageCode: FIXTURE_PACKAGE_CODE,
    releaseVersion: 1,
    generatedAt: assessmentTimestamp,
    assessmentTimestamp,
  });
  const scores = computeTwoAxisScores({ caseData, assessmentTimestamp });
  const stateDecision = derivePackageReadinessState({ caseData, assessmentTimestamp, scores });
  const masterRecordModel = buildMasterRecordModel({
    caseData,
    calculation,
    controls,
    model,
    reportId: V6_REPORT_ID,
    packageCode: FIXTURE_PACKAGE_CODE,
    releaseVersion: 1,
    schemaVersion: V6_SCHEMA_VERSION,
    engineVersion: V6_ENGINE_VERSION,
    generatedAt: assessmentTimestamp,
    manifestReference: MASTER_RECORD_MANIFEST_REFERENCE,
    signatureAlgorithm: "RSA-SHA256",
    signatureReference: MASTER_RECORD_SIGNATURE_REFERENCE,
    signatureProtectionLevel: "FULL",
    scores,
    state: stateDecision.state,
    stateReasonCodes: stateDecision.reasonCodes,
    graphRootHash: calculation.calculationRootHash,
    graphNodeHashes: calculation.trace.map((item) => ({ formulaId: item.formulaId, hash: item.calculationHash })),
  });
  return {
    key: key ?? "STEEL_IN",
    caseData,
    calculation,
    controls,
    model,
    scores,
    state: stateDecision.state,
    stateReasonCodes: stateDecision.reasonCodes,
    masterRecordModel,
  };
}

export function reportingYear(caseData: AuditReadyCase): number {
  return Number(caseData.reportingPeriod.year.value);
}

/**
 * Render the Enterprise Compliance Master Record PDF and extract its text and
 * page count via pdfjs so the structure gates operate on real rendered output.
 */
export async function masterRecordPdfText(
  model: MasterRecordModel
): Promise<{ text: string; pages: number; bytes: Buffer }> {
  const { buildMasterRecordPdf } = await import("../../functions/src/cbam/report/v6/master-record-pdf");
  const bytes = buildMasterRecordPdf(model);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
  }
  return { text, pages: document.numPages, bytes };
}
