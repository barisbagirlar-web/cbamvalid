import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const SCANNER_DEFINITION_FILES = new Set([
  path.normalize("scripts/guard-release-truth.mjs"),
  path.normalize("scripts/guard-auth-env.mjs"),
]);

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required release component: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function scanTextFiles(relativeDirectory, visitor) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next", "lib"].includes(entry.name)) continue;
    const relativePath = path.normalize(path.join(relativeDirectory, entry.name));
    if (entry.isDirectory()) {
      scanTextFiles(relativePath, visitor);
    } else if (
      !SCANNER_DEFINITION_FILES.has(relativePath) &&
      /\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|md|txt|rules)$/.test(entry.name)
    ) {
      visitor(relativePath, fs.readFileSync(path.join(root, relativePath), "utf8"));
    }
  }
}

const sealService = read("functions/src/cbam/report/seal-service.ts");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const webhookProcessor = read("functions/src/commerce/webhook-processor.ts");
const webhookHandler = read("functions/src/webhook.ts");
const commerceHandler = read("functions/src/handlers/commerce.ts");
const productCatalog = read("functions/src/commerce/catalog.ts");
const checkoutPage = read("app/(workspace)/credits/buy/page.tsx");
const legacyCheckoutRoute = read("app/api/checkout/cbam/route.ts");
const firebaseConfig = read("firebase.json");
const reportsHandler = read("functions/src/handlers/reports.ts");

if (fs.existsSync(path.join(root, "apphosting.yaml"))) {
  failures.push("Unused apphosting.yaml creates production-runtime drift; Firebase Framework-Aware Hosting is canonical");
}
if (!firebaseConfig.includes('"source": "."') || !firebaseConfig.includes('"frameworksBackend"')) {
  failures.push("Canonical Firebase Framework-Aware Hosting configuration is missing");
}
if (!firebaseConfig.includes('"source": "functions"')) {
  failures.push("Canonical Firebase Functions source configuration is missing");
}

const manifestContent = read("functions/src/cbam/report/package-manifest.ts");
const requiredPackageFiles = [...manifestContent.matchAll(/filename:\s*["']([^"']+)["']/g)].map(m => m[1]);

for (const filename of requiredPackageFiles) {
  if (!packageBuilder.includes(filename)) failures.push(`Verifier package contract missing: ${filename}`);
}

const prohibitedCredentialPatterns = [
  [/pdl_sdbx_apikey_[A-Za-z0-9_-]+/, "Paddle sandbox API key committed to source"],
  [/pdl_live_apikey_[A-Za-z0-9_-]+/, "Paddle live API key committed to source"],
  [/pws_(?:sandbox|live)_[A-Za-z0-9_-]+/, "Paddle webhook secret committed to source"],
  [/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "Private key committed to source"],
];

for (const directory of ["app", "components", "context", "functions/src", "lib", "scripts", ".github", "docs"]) {
  scanTextFiles(directory, (filePath, content) => {
    for (const [pattern, message] of prohibitedCredentialPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) failures.push(`${filePath}: ${message}`);
    }
  });
}

if (!/secrets:\s*\[\s*"PADDLE_API_KEY"\s*\]/.test(commerceHandler)) {
  failures.push("createCheckoutSession does not bind PADDLE_API_KEY as a Firebase managed secret");
}
if (!/secrets:\s*\[\s*"PADDLE_WEBHOOK_SECRET"\s*\]/.test(webhookHandler)) {
  failures.push("paddleWebhook does not bind only PADDLE_WEBHOOK_SECRET as a Firebase managed secret");
}
if (/secrets:\s*\[[^\]]*PADDLE_API_KEY[^\]]*\]/.test(webhookHandler)) {
  failures.push("paddleWebhook has unnecessary PADDLE_API_KEY access");
}
if (!productCatalog.includes("PADDLE_PRICE_ID_SANDBOX") || !productCatalog.includes("PADDLE_PRICE_ID_PRODUCTION")) {
  failures.push("Environment-specific Paddle price-ID runtime variables are missing");
}

if (!webhookProcessor.includes("PADDLE_AMOUNT_MISMATCH")) failures.push("Webhook amount verification missing");
if (!webhookProcessor.includes("PADDLE_PRICE_ID_MISMATCH")) failures.push("Webhook price verification missing");
if (!webhookProcessor.includes("PADDLE_ORDER_PAYLOAD_MISMATCH")) failures.push("Webhook order reconciliation missing");
if (!webhookHandler.includes("FAILED_RETRYABLE") || !webhookHandler.includes("processingLeaseUntil")) {
  failures.push("Webhook retry lease/state machine missing");
}
if (!checkoutPage.includes("transactionId: checkout.transactionId")) failures.push("Checkout is not opened from a server-created transaction");
if (/customData\s*:/.test(checkoutPage)) failures.push("Client checkout must not control Paddle customData");

if (!legacyCheckoutRoute.includes("CHECKOUT_CHANNEL_RETIRED")) failures.push("Legacy Next.js checkout route is not explicitly retired");
if (/(sandbox-api\.paddle\.com|api\.paddle\.com)\/transactions|custom_data\s*:|Math\.random\s*\(/.test(legacyCheckoutRoute)) {
  failures.push("Legacy Next.js checkout route can still create or shape Paddle transactions");
}
if (!productCatalog.includes('PREPARATION_PACK_PRODUCT_CODE = "CBAM_CREDIT_PACK_5"')) failures.push("Canonical Preparation Pack product code missing");
if (productCatalog.includes("CBAM_EXPORTER_FINAL_REPORT")) failures.push("Retired parallel CBAM product remains in the production catalog");
if (/pri_01j2f(xyz|abc)\.\.\./.test(productCatalog)) failures.push("Placeholder Paddle price ID remains in the production catalog");

if (!sealService.includes("buildVerifierPreparationPackage")) failures.push("Seal path is not connected to the verifier package builder");
if (!sealService.includes("packageTopLevelComponentCount: 27")) failures.push("Sealed report does not record 27 top-level components");
if (!reportsHandler.includes('z.enum(["zip", "manifest"])')) failures.push("Download endpoint exposes unsupported or non-existent report formats");
if (sealService.includes("ASYMMETRIC_MANIFEST_SIGNATURE=NOT_IMPLEMENTED")) failures.push("Mock cryptographic signature remains in production seal path");

const formalPassIdPattern = /(REAL_PAYMENT_TRANSACTION_ID|WEBHOOK_EVENT_ID|LEDGER_ENTRY_ID|ENTITLEMENT_ID)\s*=\s*([^\s]+)/g;
for (const reportFile of ["release-report.txt", "artifacts/release-report.txt", "FINAL_RELEASE_REPORT.txt"]) {
  const absolute = path.join(root, reportFile);
  if (!fs.existsSync(absolute)) continue;
  const report = read(reportFile);
  for (const match of report.matchAll(formalPassIdPattern)) {
    if (/(test|sandbox|fixture|mock|example)/i.test(match[2])) {
      failures.push(`${reportFile}: ${match[1]} contains a non-production identifier (${match[2]})`);
    }
  }
  if (/REVENUE_RELEASE_READY\s*=\s*YES/.test(report) && !/REAL_PAYMENT_TRANSACTION\s*=\s*PASS/.test(report)) {
    failures.push(`${reportFile}: revenue readiness declared without real-payment PASS`);
  }
}

if (failures.length > 0) {
  console.error("RELEASE_TRUTH_GUARD=FAIL");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RELEASE_TRUTH_GUARD=PASS");
console.log("CANONICAL_RUNTIME=FIREBASE_FRAMEWORK_AWARE_HOSTING_PLUS_FUNCTIONS");
console.log(`VERIFIER_PACKAGE_TOP_LEVEL_CONTRACT=${requiredPackageFiles.length}`);
console.log("PADDLE_SECRET_SOURCE_CONTAINMENT=PASS");
console.log("FIREBASE_FUNCTION_SECRET_BINDINGS=PASS");
console.log("SINGLE_CHECKOUT_CHANNEL=PASS");
console.log("SINGLE_PREPARATION_PACK_PRODUCT=PASS");
console.log("SERVER_CREATED_CHECKOUT_CONTRACT=PASS");
console.log("WEBHOOK_RETRY_AND_RECONCILIATION_CONTRACT=PASS");
console.log("SEAL_PACKAGE_CONTRACT=PASS");
