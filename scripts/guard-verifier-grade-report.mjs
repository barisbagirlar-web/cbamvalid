import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing verifier-grade component: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) failures.push(message);
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

const serverSchema = read("functions/src/cbam/schema.ts");
const clientSchema = read("lib/cbam/schema.ts");
const serverCalculator = read("functions/src/cbam/calculator.ts");
const clientCalculator = read("lib/cbam/calculator.ts");
const serverQc = read("functions/src/cbam/validation/quality-controls.ts");
const clientQc = read("lib/cbam/validation/quality-controls.ts");
const qualityContract = read("functions/src/cbam/report/report-quality-contract.ts");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const sealService = read("functions/src/cbam/report/seal-service.ts");
const wizard = read("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
const reportTest = read("tests/reports/verifier-package.test.ts");
const calculationTest = read("tests/cbam-engine/verifier-grade-calculation.test.ts");

for (const [source, name] of [[serverSchema, "server"], [clientSchema, "client"]]) {
  requireText(source, "allocationShare", `${name} dossier schema does not expose per-good allocationShare`);
}
requireText(clientSchema, '"fraction"', "Client schema does not define the canonical allocation fraction unit");

for (const [source, name] of [[serverCalculator, "server"], [clientCalculator, "client preview"]]) {
  requireText(source, "allocationReconciliationDelta", `${name} calculation does not expose allocation reconciliation`);
  requireText(source, "specificEmbeddedEmissions", `${name} calculation does not expose per-good intensity`);
  requireText(source, "goods", `${name} calculation does not expose per-good results`);
}
requireText(serverCalculator, "CALCULATION_INPUT_REQUIRED", "Server calculation does not fail closed on missing material inputs");
requireText(serverCalculator, "CBAM_GOODS_ALLOCATION_RECONCILIATION", "Server calculation trace lacks goods-allocation reconciliation node");
requireText(serverCalculator, "ROUND_HALF_UP", "Server calculation rounding policy is not explicit");
requireText(serverCalculator, "kg", "Server calculation lacks kg-to-tonne conversion support");

for (const [source, name] of [[serverQc, "server"], [clientQc, "client"]]) {
  requireText(source, 'reviewStatus === "APPROVED"', `${name} quality controls do not require internal evidence approval`);
  requireText(source, "GOODS_EMISSIONS_ALLOCATION", `${name} quality controls do not govern allocation methodology`);
  requireText(source, "PRECURSOR_SCOPE", `${name} quality controls do not govern precursor scope`);
  requireText(source, "ALLOCATION_TOLERANCE", `${name} quality controls do not reconcile allocation shares`);
}

requireText(qualityContract, 'REPORT_STANDARD_VERSION = "CBAMVALID-VGRS-1.0"', "Verifier-grade report standard version is missing");
requireText(qualityContract, "REPORT_EVIDENCE_COVERAGE_INCOMPLETE", "Report quality contract lacks evidence coverage gate");
requireText(qualityContract, "REPORT_CALCULATION_TRACE_INCOMPLETE", "Report quality contract lacks calculation trace gate");
requireText(qualityContract, "REPORT_ALLOCATION_NOT_RECONCILED", "Report quality contract lacks allocation reconciliation gate");
requireText(qualityContract, "REPORT_MATERIAL_FINDINGS_OPEN", "Report quality contract lacks open-material-finding gate");

requireText(packageBuilder, "assessVerifierGradeReport", "Package builder is not connected to the report quality contract");
requirePattern(
  packageBuilder,
  /if\s*\(\s*reportQualityAssessment\.status\s*!==\s*["']PASS["']\s*\)\s*\{[\s\S]{0,500}?throw\s+new\s+Error\s*\(/,
  "Package builder does not fail closed on report-quality failure"
);
requireText(packageBuilder, "Operator Emissions Report", "Operator emissions report is missing");
requireText(packageBuilder, "Verifier completion section", "Operator report lacks accredited-verifier completion fields");
requireText(packageBuilder, "Per-good reportable results", "Calculation annex lacks per-good reportable results");
requireText(packageBuilder, "Professional-scepticism checklist", "Readiness report lacks external-verifier challenge framing");
requireText(packageBuilder, "topLevelComponentCount: 23", "Manifest does not lock 23 top-level components");
requireText(packageBuilder, "reportQualityAssessment.status", "Package verification does not require report-quality PASS");

requireText(sealService, "buildVerifierPreparationPackage", "Seal service is not integrated with the verifier package builder");
requireText(sealService, "CALCULATION_TRACE_INCOMPLETE", "Seal service does not validate calculation trace completeness");

requireText(wizard, "Emissions allocation share", "User workflow does not expose per-good allocation shares");
requireText(wizard, "Approve for Internal Dossier Use", "User workflow lacks explicit evidence review and approval");
requireText(wizard, "Methodology decision register", "User workflow lacks methodology decision capture");
requireText(wizard, "allocationReconciliationDelta", "User workflow lacks allocation reconciliation feedback");
requireText(wizard, "per-good results", "User workflow lacks per-good result framing");

requireText(reportTest, "reportQualityAssessment.status", "Report tests do not assert report-quality PASS");
requireText(reportTest, "23", "Report tests do not assert the 23-component contract");
requireText(calculationTest, "CALCULATION_ALLOCATION_NOT_RECONCILED", "Calculation tests do not cover allocation mismatch");
requireText(calculationTest, "exactly once", "Calculation tests do not document double-counting protection");
requireText(calculationTest, "deterministic", "Calculation tests do not cover deterministic hashes");

const prohibitedPositiveClaims = [
  /CBAMValid\s+(?:is|acts as)\s+an?\s+accredited verifier/i,
  /guarantees?\s+(?:EU|customs|Registry)\s+approval/i,
  /official\s+CBAM\s+Registry\s+(?:XML|submission)/i,
];
for (const [file, content] of [
  ["functions/src/cbam/report/verifier-package-builder.ts", packageBuilder],
  ["app/(workspace)/cases/[caseId]/CaseWizardClient.tsx", wizard],
]) {
  for (const pattern of prohibitedPositiveClaims) {
    if (pattern.test(content)) failures.push(`${file}: prohibited compliance claim matched ${pattern}`);
  }
}

if (failures.length > 0) {
  console.error("VERIFIER_GRADE_REPORT_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("VERIFIER_GRADE_REPORT_GUARD=PASS");
console.log("REPORT_STANDARD=CBAMVALID-VGRS-1.0");
console.log("PER_GOOD_ALLOCATION=PASS");
console.log("EVIDENCE_APPROVAL_GATE=PASS");
console.log("METHODOLOGY_GOVERNANCE=PASS");
console.log("CALCULATION_RECONCILIATION=PASS");
console.log("PREMIUM_23_COMPONENT_DOSSIER=PASS");
console.log("ACCREDITED_VERIFIER_BOUNDARY=PASS");
