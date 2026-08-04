#!/usr/bin/env npx tsx

import { createHash, verify as verifySignature } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { performDossierCalculations } from "../functions/src/cbam/calculator";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls";
import {
  assessReadiness,
} from "../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../functions/src/cbam/validation/evidence-sufficiency";
import { buildVerificationCrosswalk } from "../functions/src/cbam/registry/verification-template-2025-2546";
import {
  computeEvidenceAssuranceScore,
  countExternalVerifierCompletion,
  type HonestScoreboard,
} from "../functions/src/cbam/report/honest-scoreboard";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type DataIntegrityManifest,
  type PackageArtifact,
} from "../functions/src/cbam/report/verifier-package-builder";
import {
  FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  FOUR_DOSSIER_KEYS,
  FOUR_DOSSIER_RULESET,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
  type FourDossierKey,
} from "../tests/fixtures/four-dossiers";
import {
  buildDossierSealedPackage,
  DOSSIER_PRODUCT_CODE,
  DOSSIER_RELEASE_CONTRACT_VERSION,
  DOSSIER_RELEASE_VERSION,
  dossierPackageCode,
  dossierReportId,
  type DossierSealedPackage,
} from "../tests/fixtures/four-dossier-package";
import { createSignature } from "../tests/fixtures/kms-test-signer";

const CONTRACT_ID = "CBAMVALID-499-RELEASE-1";
const GATE_IDS = [
  "G01_INTERNAL_CONSISTENCY",
  "G02_RECOMPUTATION",
  "G03_EVIDENCE",
  "G04_VERIFIER_BOUNDARY",
  "G05_LEGAL_SOURCE",
  "G06_PACKAGE_INTEGRITY",
  "G07_USABILITY",
  "G08_OUTPUT_QUALITY",
  "G09_COMMERCIAL_VALUE",
  "G10_P0",
] as const;

type GateId = (typeof GATE_IDS)[number];
type GateResult = {
  id: GateId;
  status: "PASS" | "FAIL";
  evidence: string[];
  failures: string[];
};

type PdfInspection = {
  pages: number;
  text: string;
  perPageCharacters: number[];
  blankPages: number[];
  lowContentPages: number[];
  clippedItems: number;
  hasOutline: boolean;
};

type ValueBenchmark = {
  contractId: string;
  blendedProfessionalRateUsdPerHour: number;
  minimumEquivalentHours: number;
  minimumEquivalentValueUsd: number;
  calculatedEquivalentHours: number;
  calculatedEquivalentValueUsd: number;
  tasks: Array<{
    id: string;
    name: string;
    manualEquivalentHours: number;
    requiredOutputs: string[];
  }>;
};

type PackageEvidence = {
  key: string;
  reportId: string;
  packageCode: string;
  pdfSha256: string;
  zipSha256: string;
  manifestSha256: string;
  pages: number;
  topLevelComponents: number;
  manifestFiles: number;
  evidenceFiles: number;
};

const ROOT = resolve(process.cwd(), "artifacts", "499-usd-release");
const CONTRACT_PATH = resolve(process.cwd(), "docs", "release", "499_USD_RELEASE_CONTRACT.md");
const VALUE_PATH = resolve(process.cwd(), "docs", "release", "499-value-benchmark.json");

function sha256(bytes: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function exactSourceCommit(): string {
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/i.test(gitSha)) throw new Error(`SOURCE_SHA_INVALID:${gitSha}`);
  return gitSha;
}

function gate(id: GateId): GateResult {
  return { id, status: "PASS", evidence: [], failures: [] };
}

function fail(result: GateResult, message: string): void {
  result.status = "FAIL";
  result.failures.push(message);
}

function assertGate(result: GateResult, condition: boolean, passEvidence: string, failure: string): void {
  if (condition) result.evidence.push(passEvidence);
  else fail(result, failure);
}

function normalizePdfText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function inspectPdf(bytes: Buffer): Promise<PdfInspection> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const outline = await document.getOutline().catch(() => null);
  const blankPages: number[] = [];
  const lowContentPages: number[] = [];
  const perPageCharacters: number[] = [];
  let clippedItems = 0;
  let text = "";

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item && item.str.trim());
    const pageText = normalizePdfText(
      items.map((item) => ("str" in item ? item.str : "")).join(" ")
    );
    const characterCount = pageText.replace(/\s/g, "").length;
    perPageCharacters.push(characterCount);
    if (characterCount === 0) blankPages.push(pageNumber);
    if (characterCount > 0 && characterCount < 80) lowContentPages.push(pageNumber);

    for (const item of items) {
      const transform = (item as { transform?: number[] }).transform;
      if (
        transform &&
        (transform[4] < -50 ||
          transform[4] > viewport.width + 50 ||
          transform[5] < -50 ||
          transform[5] > viewport.height + 50)
      ) {
        clippedItems += 1;
      }
    }
    text += `${pageText} `;
  }

  return {
    pages: document.numPages,
    text: normalizePdfText(text),
    perPageCharacters,
    blankPages,
    lowContentPages,
    clippedItems,
    hasOutline: Array.isArray(outline) && outline.length > 0,
  };
}

function topLevelComponents(paths: string[]): string[] {
  return [...new Set(paths.map((path) => {
    const slash = path.indexOf("/");
    return slash >= 0 ? `${path.slice(0, slash)}/` : path;
  }))].sort();
}

function parseTrace(pkg: DossierSealedPackage): Record<string, unknown> {
  const trace = pkg.artifacts.find((artifact) => artifact.path === "Calculation Trace.json");
  if (!trace) throw new Error(`${pkg.key}:CALCULATION_TRACE_MISSING`);
  return JSON.parse(trace.bytes.toString("utf8")) as Record<string, unknown>;
}

function compareCalculationStrings(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
): string[] {
  const keys = [
    "installationDirectEmissions",
    "electricityIndirectEmissions",
    "precursorDirectEmissions",
    "precursorIndirectEmissions",
    "totalDirectEmissions",
    "totalIndirectEmissions",
    "totalEmbeddedEmissions",
    "productionVolume",
    "specificEmbeddedEmissions",
    "allocationShareTotal",
    "allocationReconciliationDelta",
    "eligibleCertificateReduction",
    "calculationRootHash",
  ];
  return keys.filter((key) => String(expected[key]) !== String(actual[key]));
}

function fixtureScoreboard(
  caseData: ReturnType<typeof AuditReadyCaseSchema.parse>,
  assessmentTimestamp: string
): HonestScoreboard {
  const readiness = assessReadiness({
    caseData,
    isDraft: false,
    assessmentTimestamp,
    sealMode: "PREVIEW",
  });
  const sufficiency = runEvidenceSufficiency(caseData, assessmentTimestamp);
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

function testCalcGraph(rootHash: string) {
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
    inputPaths: inputs.map((path) => ({ path })),
    value: { toString: () => value },
    unit,
    hash: sha256(`${id}:${value}:${unit}`),
  });
  return {
    rootHash,
    nodes: [
      node("CBAM_CALC_ROOT", "Embedded Emissions", "COMBINE", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"], ["IR 2025/2547"]),
      node("CBAM_DIRECT_80", "Direct Emissions", "SUM", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"], ["IR 2025/2547"]),
      node("CBAM_DIRECT_INSTALL_80", "Installation Direct", "DIRECT_MEASURE", "80", "tCO2e", [], ["IR 2025/2547"]),
      node("CBAM_INDIRECT_40", "Electricity Indirect", "GRID_FACTOR*CONSUMPTION", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"], ["IR 2025/2547"]),
      node("CBAM_GRID_0.4", "Grid Emission Factor", "FACTOR", "0.4", "tCO2e/MWh", [], ["IR 2025/2547"]),
      node("CBAM_CONSUMPTION_100", "Electricity Consumption", "MEASURE", "100", "MWh", [], ["IR 2025/2547"]),
    ],
  };
}

async function buildFutureWorkingFilePackage(): Promise<DossierSealedPackage> {
  const key: FourDossierKey = "ALU_CN";
  const generatedAt = "2026-08-03T21:41:36.000Z";
  const rawCase = createFourDossierCase(key);
  const evidenceFiles = await buildFourDossierEvidenceFiles(rawCase);
  const caseData = AuditReadyCaseSchema.parse(rawCase);
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const reportId = `report_${sha256(`499-future-working-file:${key}`)}`;
  const packageCode = "F499W";
  const honestScoreboard = fixtureScoreboard(caseData, generatedAt);
  const artifacts = await buildUnsignedVerifierArtifacts({
    caseData,
    controls,
    calculation,
    reportId,
    packageCode,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    generatedAt,
    evidenceFiles,
    calcGraph: testCalcGraph(calculation.calculationRootHash),
    honestScoreboard,
    publicVerificationUrl: `https://sandbox.cbamvalid.com/verify/package/${reportId}`,
    assessmentContext: {
      generatedAt,
      assessmentTimestamp: generatedAt,
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
  return {
    key,
    caseData,
    evidenceFiles,
    controls,
    calculation,
    artifacts,
    manifestResult,
    finalized,
  };
}

async function verifyPackageIntegrity(
  label: string,
  pkg: DossierSealedPackage,
  result: GateResult
): Promise<{ manifest: DataIntegrityManifest; zip: JSZip; topLevel: string[] }> {
  const manifestBytes = Buffer.from(pkg.manifestResult.bytes);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as DataIntegrityManifest;
  const zip = await JSZip.loadAsync(pkg.finalized.zip, { checkCRC32: true });
  const topLevel = topLevelComponents(
    Object.keys(zip.files).filter(
      (path) => !zip.files[path]!.dir || path === "Supporting_Evidence/"
    )
  );

  assertGate(
    result,
    topLevel.length === manifest.componentContract.requiredCount && topLevel.length === 26,
    `${label}: 26/26 top-level components`,
    `${label}: top-level component mismatch ${topLevel.length}/${manifest.componentContract.requiredCount}`
  );

  const artifactByPath = new Map<string, PackageArtifact>(
    pkg.artifacts.map((artifact) => [artifact.path, artifact])
  );
  for (const entry of manifest.files) {
    const zipEntry = zip.file(entry.path);
    if (!zipEntry) {
      fail(result, `${label}: manifest path missing from ZIP: ${entry.path}`);
      continue;
    }
    const bytes = Buffer.from(await zipEntry.async("uint8array"));
    if (sha256(bytes) !== entry.sha256) fail(result, `${label}: SHA-256 mismatch: ${entry.path}`);
    if (bytes.byteLength !== entry.sizeBytes) fail(result, `${label}: byte-size mismatch: ${entry.path}`);
    const sourceArtifact = artifactByPath.get(entry.path);
    if (!sourceArtifact) fail(result, `${label}: source artifact missing: ${entry.path}`);
    else if (sourceArtifact.mediaType !== entry.mediaType) fail(result, `${label}: media-type mismatch: ${entry.path}`);
  }

  const manifestEntry = zip.file("Data Integrity Manifest.json");
  const signatureEntry = zip.file("Manifest Signature.sig");
  if (!manifestEntry || !signatureEntry) {
    fail(result, `${label}: manifest or detached signature missing`);
  } else {
    const reopenedManifest = Buffer.from(await manifestEntry.async("uint8array"));
    const signature = JSON.parse(await signatureEntry.async("string")) as {
      publicKeyPem: string;
      signatureBase64: string;
      manifestHash: string;
    };
    assertGate(
      result,
      reopenedManifest.equals(manifestBytes),
      `${label}: reopened manifest bytes exact`,
      `${label}: reopened manifest bytes differ`
    );
    assertGate(
      result,
      signature.manifestHash === sha256(reopenedManifest),
      `${label}: signature manifest hash exact`,
      `${label}: signature manifest hash mismatch`
    );
    assertGate(
      result,
      verifySignature(
        "sha256",
        reopenedManifest,
        signature.publicKeyPem,
        Buffer.from(signature.signatureBase64, "base64")
      ),
      `${label}: detached signature verified`,
      `${label}: detached signature verification failed`
    );
  }

  return { manifest, zip, topLevel };
}

function writePackageEvidence(label: string, pkg: DossierSealedPackage): void {
  const out = join(ROOT, label);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "primary-report.pdf"), pkg.finalized.primaryPdf);
  writeFileSync(join(out, "sealed-package.zip"), pkg.finalized.zip);
  writeFileSync(join(out, "Data Integrity Manifest.json"), Buffer.from(pkg.manifestResult.bytes));
  writeFileSync(join(out, "Verifier Workspace.xlsx"), pkg.finalized.workbook);
}

async function main(): Promise<void> {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });

  const results = new Map<GateId, GateResult>(GATE_IDS.map((id) => [id, gate(id)]));
  const sourceCommitSha = exactSourceCommit();
  const contractBytes = readFileSync(CONTRACT_PATH);
  const valueBenchmark = JSON.parse(readFileSync(VALUE_PATH, "utf8")) as ValueBenchmark;
  const packageEvidence: PackageEvidence[] = [];

  const packages: DossierSealedPackage[] = [];
  for (const key of FOUR_DOSSIER_KEYS) {
    const pkg = await buildDossierSealedPackage(key);
    packages.push(pkg);
    writePackageEvidence(key, pkg);
  }
  const futurePackage = await buildFutureWorkingFilePackage();
  writePackageEvidence("FUTURE_WORKING_FILE_ALU_CN", futurePackage);

  // G01 — exact artifact semantics, including the historical future-period failure mode.
  const consistency = results.get("G01_INTERNAL_CONSISTENCY")!;
  for (const pkg of packages) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    const readiness = assessReadiness({
      caseData: pkg.caseData,
      isDraft: false,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    });
    const text = pdf.text;
    assertGate(consistency, readiness.criticalBlockerCount === 0, `${pkg.key}: model critical blockers = 0`, `${pkg.key}: model critical blockers = ${readiness.criticalBlockerCount}`);
    assertGate(consistency, /Sealing critical blockers\s+0/i.test(text), `${pkg.key}: executive sealing blockers = 0`, `${pkg.key}: executive sealing blocker count is not zero`);
    assertGate(consistency, !/Open critical blockers/i.test(text), `${pkg.key}: obsolete ambiguous blocker heading absent`, `${pkg.key}: obsolete Open critical blockers heading present`);
  }
  const futurePdf = await inspectPdf(futurePackage.finalized.primaryPdf);
  assertGate(consistency, /Decision\s*-\s*do not submit/i.test(futurePdf.text), "Future-period artifact: DO NOT SUBMIT decision visible", "Future-period artifact: DO NOT SUBMIT decision missing");
  assertGate(consistency, /Sealing critical blockers\s+0/i.test(futurePdf.text), "Future-period artifact: sealing blocker count remains zero", "Future-period artifact: sealing blocker count not zero");
  assertGate(consistency, /Reporting-period restrictions\s+1/i.test(futurePdf.text), "Future-period artifact: one reporting-period restriction disclosed", "Future-period artifact: reporting-period restriction count mismatch");
  assertGate(consistency, /Future Reporting Period End Date/i.test(futurePdf.text), "Future-period artifact: finding remains visible", "Future-period artifact: finding missing");
  assertGate(consistency, !/Open critical blockers/i.test(futurePdf.text), "Future-period artifact: ambiguous old heading absent", "Future-period artifact: old Open critical blockers heading present");
  assertGate(consistency, /Registry Field-Mapping Completeness/i.test(futurePdf.text), "Future-period artifact: field-mapping heading explicit", "Future-period artifact: field-mapping heading missing");
  assertGate(consistency, !/Registry Submission Readiness/i.test(futurePdf.text), "Future-period artifact: misleading submission-readiness heading absent", "Future-period artifact: misleading Registry Submission Readiness heading present");

  // G02 — recompute independently and reconcile against trace + manifest.
  const recomputation = results.get("G02_RECOMPUTATION")!;
  for (const pkg of packages) {
    const independent = performDossierCalculations(pkg.caseData) as unknown as Record<string, unknown>;
    const sealed = pkg.calculation as unknown as Record<string, unknown>;
    const deltas = compareCalculationStrings(independent, sealed);
    const trace = parseTrace(pkg);
    const traceCalculation = trace.calculation as Record<string, unknown> | undefined;
    const traceDeltas = traceCalculation ? compareCalculationStrings(sealed, traceCalculation) : ["TRACE_CALCULATION_MISSING"];
    assertGate(recomputation, deltas.length === 0, `${pkg.key}: independent recomputation delta = 0`, `${pkg.key}: recomputation mismatches ${deltas.join(",")}`);
    assertGate(recomputation, traceDeltas.length === 0, `${pkg.key}: trace/calculation delta = 0`, `${pkg.key}: trace mismatches ${traceDeltas.join(",")}`);
    assertGate(recomputation, pkg.manifestResult.manifest.calculationRootHash === pkg.calculation.calculationRootHash, `${pkg.key}: manifest calculation root exact`, `${pkg.key}: manifest calculation root mismatch`);
  }

  // G03 — material evidence or explicit methodology basis.
  const evidenceGate = results.get("G03_EVIDENCE")!;
  for (const pkg of packages) {
    const rows = runEvidenceSufficiency(pkg.caseData, FOUR_DOSSIER_ASSESSMENT_TIMESTAMP);
    const materialRows = rows.filter((row) => row.isMaterial ?? row.blocksSealing);
    const unacceptable = materialRows.filter((row) => !["SUPPORTED", "NOT_APPLICABLE"].includes(row.state));
    const weakGrades = materialRows.filter((row) => {
      const grade = String((row as unknown as { evidenceQualityGrade?: string }).evidenceQualityGrade ?? "");
      return ["D", "E", "PENDING"].includes(grade);
    });
    const withoutBasis = materialRows.filter((row) =>
      row.evidenceIds.length === 0 &&
      row.state !== "NOT_APPLICABLE" &&
      !row.reasonCodes.some((code) => /METHODOLOGY|ACCEPTED|LEGAL_BASIS/i.test(code))
    );
    assertGate(evidenceGate, unacceptable.length === 0, `${pkg.key}: all ${materialRows.length} material rows supported/applicable`, `${pkg.key}: unsupported material rows ${unacceptable.map((row) => row.requirementId).join(",")}`);
    assertGate(evidenceGate, weakGrades.length === 0, `${pkg.key}: no material D/E/PENDING grades`, `${pkg.key}: weak material grades ${weakGrades.map((row) => row.requirementId).join(",")}`);
    assertGate(evidenceGate, withoutBasis.length === 0, `${pkg.key}: every material row has evidence or explicit basis`, `${pkg.key}: material rows without evidence/basis ${withoutBasis.map((row) => row.requirementId).join(",")}`);
  }

  // G04 — verifier-reserved fields never pass before external action.
  const verifierGate = results.get("G04_VERIFIER_BOUNDARY")!;
  for (const [label, pkg] of [...packages.map((pkg) => [pkg.key, pkg] as const), ["FUTURE_WORKING_FILE_ALU_CN", futurePackage] as const]) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    const pendingPassed = /Pending verifier.{0,180}Passed/i.test(pdf.text);
    assertGate(verifierGate, !pendingPassed, `${label}: pending-verifier Passed count = 0`, `${label}: pending verifier displayed as Passed`);
    assertGate(verifierGate, /Verifier action pending/i.test(pdf.text), `${label}: verifier action pending is explicit`, `${label}: verifier pending marker missing`);
    assertGate(verifierGate, /NOT REVIEWED\s*-\s*PENDING/i.test(pdf.text), `${label}: independent status is NOT REVIEWED - PENDING`, `${label}: independent pending status missing`);
  }

  // G05 — one requirement, one legal source, with the 2546/2547 role split.
  const legalGate = results.get("G05_LEGAL_SOURCE")!;
  const requiredLegalMapping: Record<string, string> = {
    "CW-INST-INFO": "IMPL_2025_2546",
    "CW-VER-VISIT": "IMPL_2025_2546",
    "CW-ALLOC-METHOD": "IMPL_2025_2547",
    "CW-NON-ASSOC": "IMPL_2025_2547",
    "CW-PRECURSOR-0": "IMPL_2025_2547",
    "CW-PRECURSOR-INST": "IMPL_2025_2547",
  };
  for (const pkg of packages) {
    const rows = buildVerificationCrosswalk(pkg.caseData);
    const sourceByRequirement = new Map<string, Set<string>>();
    for (const row of rows) {
      const sources = sourceByRequirement.get(row.requirementId) ?? new Set<string>();
      sources.add(row.legalSourceId);
      sourceByRequirement.set(row.requirementId, sources);
      if (!row.legalLocation.trim()) fail(legalGate, `${pkg.key}: empty legal location for ${row.requirementId}`);
    }
    for (const [requirement, sources] of sourceByRequirement) {
      if (sources.size !== 1) fail(legalGate, `${pkg.key}: ${requirement} maps to ${sources.size} legal sources`);
    }
    for (const [requirement, expectedSource] of Object.entries(requiredLegalMapping)) {
      const actual = rows.find((row) => row.requirementId === requirement)?.legalSourceId;
      assertGate(legalGate, actual === expectedSource, `${pkg.key}: ${requirement} -> ${expectedSource}`, `${pkg.key}: ${requirement} expected ${expectedSource}, got ${actual ?? "MISSING"}`);
    }
  }

  // G06 — independently reopen and verify every package.
  const integrityGate = results.get("G06_PACKAGE_INTEGRITY")!;
  for (const pkg of packages) {
    const verified = await verifyPackageIntegrity(pkg.key, pkg, integrityGate);
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    packageEvidence.push({
      key: pkg.key,
      reportId: dossierReportId(pkg.key),
      packageCode: dossierPackageCode(pkg.key),
      pdfSha256: sha256(pkg.finalized.primaryPdf),
      zipSha256: sha256(pkg.finalized.zip),
      manifestSha256: sha256(Buffer.from(pkg.manifestResult.bytes)),
      pages: pdf.pages,
      topLevelComponents: verified.topLevel.length,
      manifestFiles: verified.manifest.files.length,
      evidenceFiles: pkg.evidenceFiles.length,
    });
  }
  await verifyPackageIntegrity("FUTURE_WORKING_FILE_ALU_CN", futurePackage, integrityGate);

  // G07 — deterministic support-free workflow contract + end-to-end generation.
  const usabilityGate = results.get("G07_USABILITY")!;
  try {
    execSync(
      "npx vitest run tests/integration/wizard-step-validation.test.ts tests/integration/wizard-step-content-contract.test.ts tests/integration/field-help-coverage.test.ts tests/integration/new-case-runtime-contract.test.ts",
      { stdio: "inherit", env: { ...process.env, CI: "true" } }
    );
    usabilityGate.evidence.push("Eight-step validation, content, field-help and new-case runtime tests passed");
  } catch {
    fail(usabilityGate, "Deterministic user-flow tests failed");
  }
  assertGate(usabilityGate, packages.length === FOUR_DOSSIER_KEYS.length, "Four sector workflows generated sealed packages end-to-end", `Expected ${FOUR_DOSSIER_KEYS.length} sector packages, generated ${packages.length}`);

  // G08 — inspect exact primary PDFs, not renderer source.
  const outputGate = results.get("G08_OUTPUT_QUALITY")!;
  for (const [label, pkg] of [...packages.map((pkg) => [pkg.key, pkg] as const), ["FUTURE_WORKING_FILE_ALU_CN", futurePackage] as const]) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    assertGate(outputGate, pdf.hasOutline, `${label}: PDF outline present`, `${label}: PDF outline missing`);
    assertGate(outputGate, pdf.blankPages.length === 0, `${label}: blank pages = 0`, `${label}: blank pages ${pdf.blankPages.join(",")}`);
    assertGate(outputGate, pdf.lowContentPages.length === 0, `${label}: low-content pages = 0`, `${label}: low-content pages ${pdf.lowContentPages.join(",")}`);
    assertGate(outputGate, pdf.clippedItems === 0, `${label}: clipped items = 0`, `${label}: clipped items = ${pdf.clippedItems}`);
    assertGate(outputGate, !/[�\uFFFD]/.test(pdf.text), `${label}: broken replacement glyphs = 0`, `${label}: broken replacement glyph found`);
    assertGate(outputGate, !/Registry Submission Readiness/i.test(pdf.text), `${label}: wrong registry heading absent`, `${label}: wrong registry heading present`);
    assertGate(outputGate, /Registry Field-Mapping Completeness/i.test(pdf.text), `${label}: correct registry heading present`, `${label}: correct registry heading missing`);
  }

  // G09 — frozen conservative equivalent-work benchmark and mapped deliverables.
  const valueGate = results.get("G09_COMMERCIAL_VALUE")!;
  const summedHours = valueBenchmark.tasks.reduce((sum, task) => sum + task.manualEquivalentHours, 0);
  const calculatedValue = summedHours * valueBenchmark.blendedProfessionalRateUsdPerHour;
  assertGate(valueGate, summedHours >= valueBenchmark.minimumEquivalentHours, `Equivalent work = ${summedHours} hours`, `Equivalent work ${summedHours}h below ${valueBenchmark.minimumEquivalentHours}h`);
  assertGate(valueGate, calculatedValue >= valueBenchmark.minimumEquivalentValueUsd, `Equivalent value = USD ${calculatedValue}`, `Equivalent value USD ${calculatedValue} below USD ${valueBenchmark.minimumEquivalentValueUsd}`);
  assertGate(valueGate, calculatedValue === valueBenchmark.calculatedEquivalentValueUsd, "Benchmark arithmetic is internally consistent", `Benchmark arithmetic mismatch: calculated USD ${calculatedValue}, declared USD ${valueBenchmark.calculatedEquivalentValueUsd}`);
  const firstZip = await JSZip.loadAsync(packages[0]!.finalized.zip, { checkCRC32: true });
  for (const task of valueBenchmark.tasks) {
    for (const output of task.requiredOutputs) {
      const exists = output.endsWith("/")
        ? Object.keys(firstZip.files).some((path) => path.startsWith(output))
        : Boolean(firstZip.file(output));
      assertGate(valueGate, exists, `${task.id}: ${output} exists`, `${task.id}: required output missing ${output}`);
    }
  }

  // G10 — software-release failures only; case-specific disclosed restrictions are not defects.
  const p0Gate = results.get("G10_P0")!;
  const upstreamFailures = [...results.values()]
    .filter((result) => result.id !== "G10_P0")
    .flatMap((result) => result.failures.map((failure) => `${result.id}:${failure}`));
  assertGate(p0Gate, upstreamFailures.length === 0, "Release P0 defect count = 0", `Release P0 defects = ${upstreamFailures.length}`);

  const generatedAt = new Date().toISOString();
  const gateResults = GATE_IDS.map((id) => results.get(id)!);
  const releaseReady = gateResults.every((result) => result.status === "PASS");
  const releaseEvidence = {
    contractId: CONTRACT_ID,
    contractSha256: sha256(contractBytes),
    valueBenchmarkContractId: valueBenchmark.contractId,
    sourceCommitSha,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    generatedAt,
    artifactSet: packageEvidence,
    futureWorkingFile: {
      pdfSha256: sha256(futurePackage.finalized.primaryPdf),
      zipSha256: sha256(futurePackage.finalized.zip),
      manifestSha256: sha256(Buffer.from(futurePackage.manifestResult.bytes)),
    },
    gates: gateResults,
    releaseP0DefectCount: upstreamFailures.length,
    equivalentWorkHours: summedHours,
    equivalentValueUsd: calculatedValue,
    releaseReady,
  };
  writeFileSync(join(ROOT, "release-evidence.json"), `${JSON.stringify(releaseEvidence, null, 2)}\n`);
  writeFileSync(join(ROOT, "release-evidence.sha256"), `${sha256(canonical(releaseEvidence))}  release-evidence.json\n`);

  for (const result of gateResults) {
    console.log(`\n${result.id}=${result.status}`);
    for (const item of result.evidence) console.log(`  PASS: ${item}`);
    for (const item of result.failures) console.error(`  FAIL: ${item}`);
  }
  console.log(`\nSOURCE_COMMIT_SHA=${sourceCommitSha}`);
  console.log(`CONTRACT_SHA256=${sha256(contractBytes)}`);
  console.log(`EQUIVALENT_VALUE_USD=${calculatedValue}`);
  console.log(`499_USD_RELEASE_READY=${releaseReady ? "YES" : "NO"}`);

  if (!releaseReady) process.exit(1);
}

main().catch((error) => {
  mkdirSync(ROOT, { recursive: true });
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
  writeFileSync(join(ROOT, "fatal-error.txt"), message);
  console.error(message);
  process.exit(1);
});
