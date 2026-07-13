import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required release component: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const sealService = read("functions/src/cbam/report/seal-service.ts");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const webhookProcessor = read("functions/src/commerce/webhook-processor.ts");
const productCatalog = read("functions/src/commerce/catalog.ts");
const checkoutPage = read("app/(workspace)/credits/buy/page.tsx");
const legacyCheckoutRoute = read("app/api/checkout/cbam/route.ts");
const appHosting = read("apphosting.yaml");
const reportsHandler = read("functions/src/handlers/reports.ts");

const requiredPackageFiles = [
  "01_Product_Scope_Assessment.pdf",
  "02_CN_Code_Reasoning.pdf",
  "03_Required_Data_Checklist.pdf",
  "04_Installation_Monitoring_Plan.pdf",
  "05_Production_Process_Map.pdf",
  "06_System_Boundary_Register.pdf",
  "07_Source_Stream_Register.csv",
  "08_Emission_Source_Register.csv",
  "09_Measurement_and_Meter_Register.csv",
  "10_Activity_Data_Ledger.csv",
  "11_Evidence_Register.csv",
  "12_Field_to_Evidence_Matrix.csv",
  "13_Methodology_Decision_Log.pdf",
  "14_Embedded_Emissions_Calculation_Annex.pdf",
  "15_Operator_Emissions_Report.pdf",
  "16_Operator_Summary_Emissions_Report.pdf",
  "17_Verification_Readiness_Assessment.pdf",
  "18_Misstatement_and_Non_Conformity_Register.csv",
  "19_Corrective_Action_Log.csv",
  "20_O3CI_Field_Mapping.csv",
  "21_Calculation_Trace.json",
  "22_Data_Integrity_Manifest.json",
  "23_Supporting_Evidence/",
];

for (const filename of requiredPackageFiles) {
  if (!packageBuilder.includes(filename)) {
    failures.push(`Verifier package contract missing: ${filename}`);
  }
}

const prohibitedSourcePatterns = [
  [/pdl_sdbx_apikey_[A-Za-z0-9_-]+/, "Paddle sandbox API key committed to source"],
  [/pdl_live_apikey_[A-Za-z0-9_-]+/, "Paddle live API key committed to source"],
  [/pws_(sandbox|live)_[A-Za-z0-9_-]+/, "Paddle webhook secret committed to source"],
  [/PADDLE_API_KEY\s*\n\s*value:/, "PADDLE_API_KEY must be a managed secret"],
  [/PADDLE_WEBHOOK_SECRET\s*\n\s*value:/, "PADDLE_WEBHOOK_SECRET must be a managed secret"],
];

for (const [pattern, message] of prohibitedSourcePatterns) {
  if (pattern.test(appHosting)) failures.push(message);
}

if (!appHosting.includes("secret: PADDLE_API_KEY")) failures.push("PADDLE_API_KEY Secret Manager binding missing");
if (!appHosting.includes("secret: PADDLE_WEBHOOK_SECRET")) failures.push("PADDLE_WEBHOOK_SECRET Secret Manager binding missing");
if (!webhookProcessor.includes("PADDLE_AMOUNT_MISMATCH")) failures.push("Webhook amount verification missing");
if (!webhookProcessor.includes("PADDLE_PRICE_ID_MISMATCH")) failures.push("Webhook price verification missing");
if (!webhookProcessor.includes("PADDLE_ORDER_PAYLOAD_MISMATCH")) failures.push("Webhook order reconciliation missing");
if (!checkoutPage.includes("transactionId: checkout.transactionId")) failures.push("Checkout is not opened from a server-created transaction");
if (/customData\s*:/.test(checkoutPage)) failures.push("Client checkout must not control Paddle customData");

if (!legacyCheckoutRoute.includes("CHECKOUT_CHANNEL_RETIRED")) {
  failures.push("Legacy Next.js checkout route is not explicitly retired");
}
if (/(sandbox-api\.paddle\.com|api\.paddle\.com)\/transactions|custom_data\s*:|Math\.random\s*\(/.test(legacyCheckoutRoute)) {
  failures.push("Legacy Next.js checkout route can still create or shape Paddle transactions");
}
if (!productCatalog.includes('PREPARATION_PACK_PRODUCT_CODE = "CBAM_CREDIT_PACK_5"')) {
  failures.push("Canonical Preparation Pack product code missing");
}
if (productCatalog.includes("CBAM_EXPORTER_FINAL_REPORT")) {
  failures.push("Retired parallel CBAM product remains in the production catalog");
}
if (/pri_01j2f(xyz|abc)\.\.\./.test(productCatalog)) {
  failures.push("Placeholder Paddle price ID remains in the production catalog");
}

if (!sealService.includes("buildVerifierPreparationPackage")) failures.push("Seal path is not connected to the verifier package builder");
if (!sealService.includes("packageTopLevelComponentCount: 23")) failures.push("Sealed report does not record 23 top-level components");
if (!reportsHandler.includes('z.enum(["zip", "manifest"])')) failures.push("Download endpoint exposes unsupported or non-existent report formats");
if (sealService.includes("ASYMMETRIC_MANIFEST_SIGNATURE=NOT_IMPLEMENTED")) failures.push("Mock cryptographic signature remains in production seal path");

const formalPassIdPattern = /(REAL_PAYMENT_TRANSACTION_ID|WEBHOOK_EVENT_ID|LEDGER_ENTRY_ID|ENTITLEMENT_ID)\s*=\s*([^\s]+)/g;
const reportFiles = [];
for (const candidate of ["release-report.txt", "artifacts/release-report.txt", "FINAL_RELEASE_REPORT.txt"]) {
  const absolute = path.join(root, candidate);
  if (fs.existsSync(absolute)) reportFiles.push(candidate);
}

for (const reportFile of reportFiles) {
  const report = read(reportFile);
  for (const match of report.matchAll(formalPassIdPattern)) {
    const value = match[2].toLowerCase();
    if (/(test|sandbox|fixture|mock|example)/.test(value)) {
      failures.push(`${reportFile}: ${match[1]} contains a non-production identifier (${match[2]})`);
    }
  }
  if (/REVENUE_RELEASE_READY\s*=\s*YES/.test(report) && !/REAL_PAYMENT_TRANSACTION\s*=\s*PASS/.test(report)) {
    failures.push(`${reportFile}: revenue readiness declared without real-payment PASS`);
  }
}

if (failures.length > 0) {
  console.error("RELEASE_TRUTH_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RELEASE_TRUTH_GUARD=PASS");
console.log(`VERIFIER_PACKAGE_TOP_LEVEL_CONTRACT=${requiredPackageFiles.length}`);
console.log("PADDLE_SECRET_SOURCE_CONTAINMENT=PASS");
console.log("SINGLE_CHECKOUT_CHANNEL=PASS");
console.log("SINGLE_PREPARATION_PACK_PRODUCT=PASS");
console.log("SERVER_CREATED_CHECKOUT_CONTRACT=PASS");
console.log("WEBHOOK_RECONCILIATION_CONTRACT=PASS");
console.log("SEAL_PACKAGE_CONTRACT=PASS");
