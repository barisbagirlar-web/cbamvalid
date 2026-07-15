import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) failures.push(`${label}: expected ${JSON.stringify(expected)}`);
}

function rejectText(source, rejected, label) {
  if (source.includes(rejected)) failures.push(`${label}: prohibited ${JSON.stringify(rejected)}`);
}

const rootLegal = read("lib/cbam/registry/legal-sources.ts");
const functionsLegal = read("functions/src/cbam/registry/legal-sources.ts");
const rootRulesets = read("lib/cbam/registry/rulesets.ts");
const functionsRulesets = read("functions/src/cbam/registry/rulesets.ts");
const rootSectors = read("lib/cbam/sectors/sector-adapter.ts");
const functionsSectors = read("functions/src/cbam/sectors/sector-adapter.ts");
const model = read("functions/src/cbam/report/verifier-model.ts");
const pdf = read("functions/src/cbam/report/professional-pdf.ts");
const xlsx = read("functions/src/cbam/report/xlsx-builder.ts");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const reportContract = read("functions/src/cbam/report/report-contract.ts");
const browserContract = read("lib/cbam/report-contract.ts");
const reportHandler = read("functions/src/handlers/reports.ts");
const reportClient = read("lib/functions/client.ts");
const reportPage = read("app/(workspace)/cbam/reports/[reportId]/page.tsx");
const reportTests = read("tests/reports/verifier-grade-deliverables.test.ts");
const regulatoryTests = read("tests/cbam-engine/regulatory-registry.test.ts");

if (rootLegal !== functionsLegal) failures.push("Browser and Functions legal-source registries must be byte-identical");
if (rootRulesets !== functionsRulesets) failures.push("Browser and Functions rulesets must be byte-identical");
if (rootSectors !== functionsSectors) failures.push("Browser and Functions sector methodologies must be byte-identical");

for (const [source, label] of [[rootLegal, "Legal registry"], [rootRulesets, "Ruleset"]]) {
  rejectText(source, "2620", label);
  rejectText(source, "2621", label);
  rejectText(source.toLowerCase(), "placeholder", label);
  rejectText(source, "a1b2c3", label);
}

for (const sourceId of [
  "REG_2023_956",
  "REG_2025_2083",
  "IMPL_2025_2546",
  "IMPL_2025_2547",
  "IMPL_2025_2548",
  "DEL_2025_2551",
]) requireText(rootLegal, sourceId, "Verified definitive legal source");

requireText(rootLegal, "8463233359d67185a513ca34427861be034b17937b9e7259b01fbf7a30689ffc", "Legal-source registry fingerprint");
requireText(rootRulesets, "VERIFICATION_MATERIALITY_RATE = 0.05", "Five-percent materiality contract");
requireText(rootRulesets, "verificationTemplateRequired: true", "Electronic verification template requirement");
requireText(rootSectors, 'legalStatus: "PROPOSAL_ONLY"', "Proposal-only downstream scope");
requireText(rootSectors, 'sealingAllowed: false', "Non-binding downstream seal block");

requireText(model, "buildVerifierPackageModel", "Verifier package model");
requireText(model, "READY_FOR_INDEPENDENT_VERIFICATION", "Automated readiness state");
requireText(model, 'independentVerifierStatus: "NOT_REVIEWED"', "Independent verifier default state");
requireText(model, "materialityThresholdSpecific", "Per-good materiality calculation");
requireText(model, "MONITORING_PLAN", "Monitoring-plan concept");

for (const text of [
  "document.setFileId",
  "document.setCreationDate",
  "Page ${pageNumber} of ${pageCount}",
  "CONFIDENTIAL - VERIFIER PREPARATION WORKSPACE",
  "independent accredited verification",
]) requireText(pdf, text, "Professional PDF contract");

for (const text of [
  'name: "VERIFIER_SIGN_OFF"',
  'name: "LEGAL_SOURCES"',
  "<pane",
  "<autoFilter",
  "<conditionalFormatting",
  "<dataValidations",
  "COUNTIF(QUALITY_CONTROLS!C:C",
  "NOT_REVIEWED",
  "NO_OPINION",
]) requireText(xlsx, text, "Verifier XLSX contract");

const componentMatches = [...packageBuilder.matchAll(/^\s{2}"([^"]+)",$/gm)].map((match) => match[1]);
const requiredStart = componentMatches.indexOf("Product and Scope Definition.pdf");
const requiredEnd = componentMatches.indexOf("Supporting_Evidence/");
const requiredComponents = requiredStart >= 0 && requiredEnd >= requiredStart
  ? componentMatches.slice(requiredStart, requiredEnd + 1)
  : [];
if (requiredComponents.length !== 27) failures.push(`Verifier package must define exactly 27 top-level components; found ${requiredComponents.length}`);
requireText(packageBuilder, 'schemaVersion: "CBAMVALID-DOSSIER-4.0"', "Manifest schema v4");
requireText(packageBuilder, "legalSourceRegistryHash", "Manifest regulatory fingerprint");
requireText(packageBuilder, "PACKAGE_REOPEN_HASH_MISMATCH", "ZIP read-back hash validation");
requireText(packageBuilder, "PACKAGE_REOPEN_SIGNATURE_INVALID", "ZIP signature read-back validation");
requireText(packageBuilder, "PACKAGE_PRIMARY_ARTIFACT_MISSING_OR_TRIVIAL", "Non-trivial primary artifacts");

requireText(reportContract, "PersistedSealedReportSchema", "Server report schema");
requireText(browserContract, "SealedReportViewSchema", "Browser report schema");
requireText(reportHandler, "toSealedReportView", "Server report output validation");
requireText(reportHandler, "Immutable report artifact metadata does not match", "Download metadata validation");
requireText(reportClient, "parseSealedReportView", "Client report validation");
rejectText(reportPage, "any", "Report page type safety");
rejectText(reportPage, "alert(", "Report page observable errors");
requireText(reportPage, "27 controlled components", "Report package component disclosure");
requireText(reportPage, "Independent verifier status", "Verifier boundary disclosure");
requireText(reportPage, "getReportDownload", "Controlled download client");

for (const text of [
  "5% materiality",
  "VERIFIER_SIGN_OFF",
  "<conditionalFormatting",
  "CBAMVALID-DOSSIER-4.0",
  "REQUIRED_TOP_LEVEL_COMPONENTS",
]) requireText(reportTests, text, "Behavioral deliverable tests");
requireText(regulatoryTests, "recomputes the pinned fingerprint", "Regulatory fingerprint test");
requireText(regulatoryTests, "contains no speculative legal instruments", "Speculative-source rejection test");

if (failures.length > 0) {
  console.error("VERIFIER_GRADE_DELIVERABLES_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("VERIFIER_GRADE_DELIVERABLES_GUARD=PASS");
console.log("REGULATORY_SINGLE_SOURCE=PASS");
console.log("REGULATORY_SOURCE_FINGERPRINT=PASS");
console.log("VERIFICATION_MATERIALITY_5_PERCENT=PASS");
console.log("PROFESSIONAL_PDF_CONTRACT=PASS");
console.log("VERIFIER_XLSX_CONTRACT=PASS");
console.log("PACKAGE_27_COMPONENT_CONTRACT=PASS");
console.log("SEALED_REPORT_TYPED_BOUNDARY=PASS");
console.log("INDEPENDENT_VERIFIER_BOUNDARY=PASS");
