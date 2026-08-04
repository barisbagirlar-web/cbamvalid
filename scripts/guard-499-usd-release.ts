#!/usr/bin/env npx tsx

import { createHash, verify as verifySignature } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { performDossierCalculations } from "../functions/src/cbam/calculator";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls";
import { assessReadiness } from "../functions/src/cbam/validation/readiness-score";
import {
  isEvidenceSupportedState,
  runEvidenceSufficiency,
} from "../functions/src/cbam/validation/evidence-sufficiency";
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
    manualEquivalentHours: number;
    requiredOutputs: string[];
  }>;
};

const ROOT = resolve(process.cwd(), "artifacts", "499-usd-release");
const CONTRACT_PATH = resolve(process.cwd(), "docs", "release", "499_USD_RELEASE_CONTRACT.md");
const VALUE_PATH = resolve(process.cwd(), "docs", "release", "499-value-benchmark.json");

function sha256(value: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
function sourceCommit(): string {
  const value = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new Error(`SOURCE_SHA_INVALID:${value}`);
  return value;
}
function newGate(id: GateId): GateResult {
  return { id, status: "PASS", evidence: [], failures: [] };
}
function pass(result: GateResult, message: string): void {
  result.evidence.push(message);
}
function fail(result: GateResult, message: string): void {
  result.status = "FAIL";
  result.failures.push(message);
}
function check(result: GateResult, condition: boolean, success: string, failure: string): void {
  condition ? pass(result, success) : fail(result, failure);
}
function normalizeText(value: string): string {
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
  let clippedItems = 0;
  let combined = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item && item.str.trim());
    const pageText = normalizeText(items.map((item) => ("str" in item ? item.str : "")).join(" "));
    const chars = pageText.replace(/\s/g, "").length;
    if (chars === 0) blankPages.push(pageNumber);
    if (chars > 0 && chars < 80) lowContentPages.push(pageNumber);
    for (const item of items) {
      const transform = (item as { transform?: number[] }).transform;
      if (
        transform &&
        (transform[4] < -50 || transform[4] > viewport.width + 50 ||
          transform[5] < -50 || transform[5] > viewport.height + 50)
      ) clippedItems += 1;
    }
    combined += `${pageText} `;
  }
  return {
    pages: document.numPages,
    text: normalizeText(combined),
    blankPages,
    lowContentPages,
    clippedItems,
    hasOutline: Array.isArray(outline) && outline.length > 0,
  };
}

function topLevel(paths: string[]): string[] {
  return [...new Set(paths.map((path) => {
    const slash = path.indexOf("/");
    return slash >= 0 ? `${path.slice(0, slash)}/` : path;
  }))].sort();
}
function calculationMismatches(
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
function traceCalculation(pkg: DossierSealedPackage): Record<string, unknown> {
  const artifact = pkg.artifacts.find((entry) => entry.path === "Calculation Trace.json");
  if (!artifact) throw new Error(`${pkg.key}:CALCULATION_TRACE_MISSING`);
  const parsed = JSON.parse(artifact.bytes.toString("utf8")) as { calculation?: Record<string, unknown> };
  if (!parsed.calculation) throw new Error(`${pkg.key}:TRACE_CALCULATION_MISSING`);
  return parsed.calculation;
}

function scoreboard(
  caseData: ReturnType<typeof AuditReadyCaseSchema.parse>,
  assessmentTimestamp: string
): HonestScoreboard {
  const readiness = assessReadiness({ caseData, isDraft: false, assessmentTimestamp, sealMode: "PREVIEW" });
  const evidence = computeEvidenceAssuranceScore(runEvidenceSufficiency(caseData, assessmentTimestamp));
  const verifier = countExternalVerifierCompletion(caseData.verifierReserved);
  const operatorPreparationScore = Number(readiness.score);
  return {
    operatorReadiness: operatorPreparationScore,
    verifierReservedCount: verifier.completed,
    verifierReservedTotal: verifier.total,
    dossierCompleteness: operatorPreparationScore,
    status: readiness.operatorStatus,
    formula: "OPERATOR PREPARATION, EVIDENCE ASSURANCE, PACKAGE INTEGRITY and EXTERNAL VERIFIER COMPLETION are reported independently.",
    operatorPreparationScore,
    evidenceAssuranceScore: evidence.score,
    packageIntegrity: "PASS",
    externalVerifierCompleted: verifier.completed,
    externalVerifierTotal: verifier.total,
    scoreboardClaim: verifier.completed < verifier.total
      ? "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER PENDING"
      : "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER COMPLETE",
    premiumChapterContract: "COMPLETE",
    premiumNameVisible: true,
    productTierLabel: "Premium Dossier",
  };
}
function calcGraph(rootHash: string) {
  const node = (id: string, value: string, unit: string, inputs: string[]) => ({
    id,
    label: id,
    formula: inputs.length ? "COMPUTE" : "INPUT",
    legalBasis: ["IR 2025/2547"],
    inputNodes: inputs,
    inputPaths: inputs.map((path) => ({ path })),
    value: { toString: () => value },
    unit,
    hash: sha256(`${id}:${value}:${unit}`),
  });
  return {
    rootHash,
    nodes: [
      node("CBAM_CALC_ROOT", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"]),
      node("CBAM_DIRECT_80", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"]),
      node("CBAM_DIRECT_INSTALL_80", "80", "tCO2e", []),
      node("CBAM_INDIRECT_40", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"]),
      node("CBAM_GRID_0.4", "0.4", "tCO2e/MWh", []),
      node("CBAM_CONSUMPTION_100", "100", "MWh", []),
    ],
  };
}

async function buildFuturePackage(): Promise<DossierSealedPackage> {
  const key: FourDossierKey = "ALU_CN";
  const generatedAt = "2026-08-03T21:41:36.000Z";
  const rawCase = createFourDossierCase(key);
  const evidenceFiles = await buildFourDossierEvidenceFiles(rawCase);
  const caseData = AuditReadyCaseSchema.parse(rawCase);
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const reportId = `report_${sha256(`499-future:${key}`)}`;
  const packageCode = "F499W";
  const artifacts = await buildUnsignedVerifierArtifacts({
    caseData,
    controls,
    calculation,
    reportId,
    packageCode,
    releaseVersion: DOSSIER_RELEASE_VERSION,
    generatedAt,
    evidenceFiles,
    calcGraph: calcGraph(calculation.calculationRootHash),
    honestScoreboard: scoreboard(caseData, generatedAt),
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
  return { key, caseData, evidenceFiles, controls, calculation, artifacts, manifestResult, finalized };
}

function writeArtifacts(label: string, pkg: DossierSealedPackage): void {
  const directory = join(ROOT, label);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "primary-report.pdf"), pkg.finalized.primaryPdf);
  writeFileSync(join(directory, "sealed-package.zip"), pkg.finalized.zip);
  writeFileSync(join(directory, "Data Integrity Manifest.json"), Buffer.from(pkg.manifestResult.bytes));
  writeFileSync(join(directory, "Verifier Workspace.xlsx"), pkg.finalized.workbook);
}

async function verifyIntegrity(
  label: string,
  pkg: DossierSealedPackage,
  result: GateResult
): Promise<{ manifest: DataIntegrityManifest; components: string[] }> {
  const manifestBytes = Buffer.from(pkg.manifestResult.bytes);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as DataIntegrityManifest;
  const zip = await JSZip.loadAsync(pkg.finalized.zip, { checkCRC32: true });
  const components = topLevel(Object.keys(zip.files).filter(
    (path) => !zip.files[path]!.dir || path === "Supporting_Evidence/"
  ));
  check(result,
    components.length === 26 && components.length === manifest.componentContract.requiredCount,
    `${label}: 26/26 top-level components`,
    `${label}: component mismatch ${components.length}/${manifest.componentContract.requiredCount}`
  );
  const source = new Map<string, PackageArtifact>(pkg.artifacts.map((artifact) => [artifact.path, artifact]));
  for (const entry of manifest.files) {
    const zipEntry = zip.file(entry.path);
    if (!zipEntry) {
      fail(result, `${label}: manifest path absent from ZIP ${entry.path}`);
      continue;
    }
    const bytes = Buffer.from(await zipEntry.async("uint8array"));
    if (sha256(bytes) !== entry.sha256) fail(result, `${label}: hash mismatch ${entry.path}`);
    if (bytes.byteLength !== entry.sizeBytes) fail(result, `${label}: size mismatch ${entry.path}`);
    if (source.get(entry.path)?.mediaType !== entry.mediaType) fail(result, `${label}: media type mismatch ${entry.path}`);
  }
  const manifestEntry = zip.file("Data Integrity Manifest.json");
  const signatureEntry = zip.file("Manifest Signature.sig");
  if (!manifestEntry || !signatureEntry) {
    fail(result, `${label}: manifest/signature missing`);
    return { manifest, components };
  }
  const reopened = Buffer.from(await manifestEntry.async("uint8array"));
  const signature = JSON.parse(await signatureEntry.async("string")) as {
    publicKeyPem: string;
    signatureBase64: string;
    manifestHash: string;
  };
  check(result, reopened.equals(manifestBytes), `${label}: manifest bytes exact`, `${label}: manifest bytes differ`);
  check(result, signature.manifestHash === sha256(reopened), `${label}: manifest hash exact`, `${label}: signature hash mismatch`);
  check(result,
    verifySignature("sha256", reopened, signature.publicKeyPem, Buffer.from(signature.signatureBase64, "base64")),
    `${label}: detached signature verified`,
    `${label}: detached signature invalid`
  );
  return { manifest, components };
}

async function main(): Promise<void> {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  const gates = new Map<GateId, GateResult>(GATE_IDS.map((id) => [id, newGate(id)]));
  const commitSha = sourceCommit();
  const contractBytes = readFileSync(CONTRACT_PATH);
  const benchmark = JSON.parse(readFileSync(VALUE_PATH, "utf8")) as ValueBenchmark;

  const packages: DossierSealedPackage[] = [];
  for (const key of FOUR_DOSSIER_KEYS) {
    const pkg = await buildDossierSealedPackage(key);
    packages.push(pkg);
    writeArtifacts(key, pkg);
  }
  const future = await buildFuturePackage();
  writeArtifacts("FUTURE_WORKING_FILE_ALU_CN", future);

  const g01 = gates.get("G01_INTERNAL_CONSISTENCY")!;
  for (const pkg of packages) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    const readiness = assessReadiness({ caseData: pkg.caseData, isDraft: false, assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP });
    check(g01, readiness.criticalBlockerCount === 0, `${pkg.key}: model critical blockers 0`, `${pkg.key}: model critical blockers ${readiness.criticalBlockerCount}`);
    check(g01, /Sealing critical blockers\s+0/i.test(pdf.text), `${pkg.key}: sealing blockers 0`, `${pkg.key}: sealing blocker count inconsistent`);
    check(g01, !/Open critical blockers/i.test(pdf.text), `${pkg.key}: obsolete blocker heading absent`, `${pkg.key}: obsolete blocker heading present`);
  }
  const futurePdf = await inspectPdf(future.finalized.primaryPdf);
  for (const [condition, success, failure] of [
    [/Decision\s*-\s*do not submit/i.test(futurePdf.text), "Future file: DO NOT SUBMIT visible", "Future file: decision missing"],
    [/Sealing critical blockers\s+0/i.test(futurePdf.text), "Future file: sealing blockers 0", "Future file: sealing blockers inconsistent"],
    [/Reporting-period restrictions\s+1/i.test(futurePdf.text), "Future file: restriction count 1", "Future file: restriction count inconsistent"],
    [/Future Reporting Period End Date/i.test(futurePdf.text), "Future file: finding visible", "Future file: finding missing"],
    [!/Open critical blockers/i.test(futurePdf.text), "Future file: old heading absent", "Future file: old heading present"],
    [/Registry Field-Mapping Completeness/i.test(futurePdf.text), "Future file: field-mapping heading explicit", "Future file: field-mapping heading missing"],
    [!/Registry Submission Readiness/i.test(futurePdf.text), "Future file: submission heading absent", "Future file: submission heading present"],
  ] as Array<[boolean, string, string]>) check(g01, condition, success, failure);

  const g02 = gates.get("G02_RECOMPUTATION")!;
  for (const pkg of packages) {
    const sealed = pkg.calculation as unknown as Record<string, unknown>;
    const recomputed = performDossierCalculations(pkg.caseData) as unknown as Record<string, unknown>;
    const delta = calculationMismatches(recomputed, sealed);
    const traceDelta = calculationMismatches(sealed, traceCalculation(pkg));
    check(g02, delta.length === 0, `${pkg.key}: recomputation delta 0`, `${pkg.key}: recomputation mismatch ${delta.join(",")}`);
    check(g02, traceDelta.length === 0, `${pkg.key}: trace delta 0`, `${pkg.key}: trace mismatch ${traceDelta.join(",")}`);
    check(g02,
      pkg.manifestResult.manifest.calculationRootHash === pkg.calculation.calculationRootHash,
      `${pkg.key}: calculation root exact`,
      `${pkg.key}: calculation root mismatch`
    );
  }

  const g03 = gates.get("G03_EVIDENCE")!;
  for (const pkg of packages) {
    const rows = runEvidenceSufficiency(pkg.caseData, FOUR_DOSSIER_ASSESSMENT_TIMESTAMP);
    const material = rows.filter((row) => row.isMaterial ?? row.blocksSealing);
    const unsupported = material.filter((row) => !isEvidenceSupportedState(row.state) && row.state !== "NOT_APPLICABLE");
    const weak = material.filter((row) => ["D", "E", "PENDING"].includes(String(row.evidenceQualityGrade ?? "")));
    const withoutBasis = material.filter((row) =>
      row.evidenceIds.length === 0 &&
      !isEvidenceSupportedState(row.state) &&
      row.state !== "NOT_APPLICABLE" &&
      !row.reasonCodes.some((code) => /METHODOLOGY|ACCEPTED|LEGAL_BASIS/i.test(code))
    );
    check(g03, unsupported.length === 0, `${pkg.key}: all ${material.length} material rows supported`, `${pkg.key}: unsupported ${unsupported.map((row) => row.requirementId).join(",")}`);
    check(g03, weak.length === 0, `${pkg.key}: no material D/E/PENDING grade`, `${pkg.key}: weak grades ${weak.map((row) => row.requirementId).join(",")}`);
    check(g03, withoutBasis.length === 0, `${pkg.key}: evidence/methodology basis complete`, `${pkg.key}: basis missing ${withoutBasis.map((row) => row.requirementId).join(",")}`);
  }

  const g04 = gates.get("G04_VERIFIER_BOUNDARY")!;
  for (const [label, pkg] of [...packages.map((pkg) => [pkg.key, pkg] as const), ["FUTURE_WORKING_FILE_ALU_CN", future] as const]) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    check(g04, !/Pending verifier.{0,180}Passed/i.test(pdf.text), `${label}: pending-verifier Passed count 0`, `${label}: pending verifier displayed as Passed`);
    check(g04, /Verifier action pending/i.test(pdf.text), `${label}: verifier pending explicit`, `${label}: verifier pending marker missing`);
    check(g04, /NOT REVIEWED\s*-\s*PENDING/i.test(pdf.text), `${label}: independent status pending`, `${label}: independent pending status missing`);
  }

  const g05 = gates.get("G05_LEGAL_SOURCE")!;
  const expected: Record<string, string> = {
    "CW-INST-INFO": "IMPL_2025_2546",
    "CW-VER-VISIT": "IMPL_2025_2546",
    "CW-ALLOC-METHOD": "IMPL_2025_2547",
    "CW-NON-ASSOC": "IMPL_2025_2547",
    "CW-PRECURSOR-0": "IMPL_2025_2547",
    "CW-PRECURSOR-INST": "IMPL_2025_2547",
  };
  for (const pkg of packages) {
    const rows = buildVerificationCrosswalk(pkg.caseData);
    const sources = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = sources.get(row.requirementId) ?? new Set<string>();
      set.add(row.legalSourceId);
      sources.set(row.requirementId, set);
      if (!row.legalLocation.trim()) fail(g05, `${pkg.key}: legal location empty ${row.requirementId}`);
    }
    for (const [requirement, set] of sources) {
      if (set.size !== 1) fail(g05, `${pkg.key}: ${requirement} maps to ${set.size} sources`);
    }
    for (const [requirement, legalSource] of Object.entries(expected)) {
      if (requirement === "CW-PRECURSOR-0" && pkg.caseData.precursors.length === 0) {
        pass(g05, `${pkg.key}: ${requirement} not applicable — no precursor row`);
        continue;
      }
      const actual = rows.find((row) => row.requirementId === requirement)?.legalSourceId;
      check(g05, actual === legalSource, `${pkg.key}: ${requirement} -> ${legalSource}`, `${pkg.key}: ${requirement} expected ${legalSource}, got ${actual ?? "MISSING"}`);
    }
  }

  const g06 = gates.get("G06_PACKAGE_INTEGRITY")!;
  const artifactSet: Array<Record<string, unknown>> = [];
  for (const pkg of packages) {
    const verified = await verifyIntegrity(pkg.key, pkg, g06);
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    artifactSet.push({
      key: pkg.key,
      reportId: dossierReportId(pkg.key),
      packageCode: dossierPackageCode(pkg.key),
      pdfSha256: sha256(pkg.finalized.primaryPdf),
      zipSha256: sha256(pkg.finalized.zip),
      manifestSha256: sha256(Buffer.from(pkg.manifestResult.bytes)),
      pages: pdf.pages,
      topLevelComponents: verified.components.length,
      manifestFiles: verified.manifest.files.length,
      evidenceFiles: pkg.evidenceFiles.length,
    });
  }
  await verifyIntegrity("FUTURE_WORKING_FILE_ALU_CN", future, g06);

  const g07 = gates.get("G07_USABILITY")!;
  try {
    execSync(
      "npx vitest run tests/integration/wizard-step-validation.test.ts tests/integration/wizard-step-content-contract.test.ts tests/integration/field-help-coverage.test.ts tests/integration/new-case-runtime-contract.test.ts",
      { stdio: "inherit", env: { ...process.env, CI: "true" } }
    );
    pass(g07, "Eight-step validation, content, field-help and runtime tests passed");
  } catch {
    fail(g07, "Deterministic user-flow tests failed");
  }
  check(g07, packages.length === FOUR_DOSSIER_KEYS.length, "Four sector packages generated end-to-end", `Generated ${packages.length}/${FOUR_DOSSIER_KEYS.length} packages`);

  const g08 = gates.get("G08_OUTPUT_QUALITY")!;
  for (const [label, pkg] of [...packages.map((pkg) => [pkg.key, pkg] as const), ["FUTURE_WORKING_FILE_ALU_CN", future] as const]) {
    const pdf = await inspectPdf(pkg.finalized.primaryPdf);
    check(g08, pdf.hasOutline, `${label}: outline present`, `${label}: outline missing`);
    check(g08, pdf.blankPages.length === 0, `${label}: blank pages 0`, `${label}: blank pages ${pdf.blankPages.join(",")}`);
    check(g08, pdf.lowContentPages.length === 0, `${label}: low-content pages 0`, `${label}: low-content pages ${pdf.lowContentPages.join(",")}`);
    check(g08, pdf.clippedItems === 0, `${label}: clipped items 0`, `${label}: clipped items ${pdf.clippedItems}`);
    check(g08, !/[�\uFFFD]/.test(pdf.text), `${label}: broken glyphs 0`, `${label}: broken glyph found`);
    check(g08, !/Registry Submission Readiness/i.test(pdf.text), `${label}: wrong heading absent`, `${label}: wrong heading present`);
    check(g08, /Registry Field-Mapping Completeness/i.test(pdf.text), `${label}: correct heading present`, `${label}: correct heading missing`);
  }

  const g09 = gates.get("G09_COMMERCIAL_VALUE")!;
  const hours = benchmark.tasks.reduce((sum, task) => sum + task.manualEquivalentHours, 0);
  const value = hours * benchmark.blendedProfessionalRateUsdPerHour;
  check(g09, hours >= benchmark.minimumEquivalentHours, `Equivalent work ${hours}h`, `Equivalent work ${hours}h below minimum`);
  check(g09, value >= benchmark.minimumEquivalentValueUsd, `Equivalent value USD ${value}`, `Equivalent value USD ${value} below minimum`);
  check(g09, hours === benchmark.calculatedEquivalentHours && value === benchmark.calculatedEquivalentValueUsd, "Benchmark arithmetic exact", "Benchmark arithmetic mismatch");
  const sampleZip = await JSZip.loadAsync(packages[0]!.finalized.zip, { checkCRC32: true });
  for (const task of benchmark.tasks) {
    for (const output of task.requiredOutputs) {
      const exists = output.endsWith("/")
        ? Object.keys(sampleZip.files).some((path) => path.startsWith(output))
        : Boolean(sampleZip.file(output));
      check(g09, exists, `${task.id}: ${output} exists`, `${task.id}: missing ${output}`);
    }
  }

  const g10 = gates.get("G10_P0")!;
  const upstreamFailures = [...gates.values()]
    .filter((result) => result.id !== "G10_P0")
    .flatMap((result) => result.failures.map((message) => `${result.id}:${message}`));
  check(g10, upstreamFailures.length === 0, "Release P0 defect count 0", `Release P0 defects ${upstreamFailures.length}`);

  const gateResults = GATE_IDS.map((id) => gates.get(id)!);
  const releaseReady = gateResults.every((result) => result.status === "PASS");
  const evidence = {
    contractId: CONTRACT_ID,
    contractSha256: sha256(contractBytes),
    valueBenchmarkContractId: benchmark.contractId,
    sourceCommitSha: commitSha,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    generatedAt: new Date().toISOString(),
    artifactSet,
    futureWorkingFile: {
      pdfSha256: sha256(future.finalized.primaryPdf),
      zipSha256: sha256(future.finalized.zip),
      manifestSha256: sha256(Buffer.from(future.manifestResult.bytes)),
    },
    gates: gateResults,
    releaseP0DefectCount: upstreamFailures.length,
    equivalentWorkHours: hours,
    equivalentValueUsd: value,
    releaseReady,
  };
  const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(join(ROOT, "release-evidence.json"), evidenceJson);
  writeFileSync(join(ROOT, "release-evidence.sha256"), `${sha256(evidenceJson)}  release-evidence.json\n`);

  for (const result of gateResults) {
    console.log(`\n${result.id}=${result.status}`);
    for (const item of result.evidence) console.log(`  PASS: ${item}`);
    for (const item of result.failures) console.error(`  FAIL: ${item}`);
  }
  console.log(`\nSOURCE_COMMIT_SHA=${commitSha}`);
  console.log(`CONTRACT_SHA256=${sha256(contractBytes)}`);
  console.log(`EQUIVALENT_VALUE_USD=${value}`);
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
