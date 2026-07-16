import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function requireText(content, token, label) {
  if (!content.includes(token)) failures.push(`${label} missing token: ${token}`);
}

function rejectText(content, token, label) {
  if (content.includes(token)) failures.push(`${label} contains prohibited token: ${token}`);
}

function requireExact(value, expected, label) {
  if (value !== expected) failures.push(`${label} expected ${JSON.stringify(expected)}; received ${JSON.stringify(value)}`);
}

const sourceContractPath = "config/cbam-commercial-product.json";
const generatedContractPath = "functions/src/generated/cbam-commercial-product.json";
let sourceContract = {};
let generatedContract = {};
try {
  sourceContract = JSON.parse(read(sourceContractPath));
  generatedContract = JSON.parse(read(generatedContractPath));
} catch (error) {
  failures.push(`Commercial contract JSON parse failure: ${error instanceof Error ? error.message : String(error)}`);
}

for (const [field, expected] of Object.entries({
  schemaVersion: "CBAMVALID-COMMERCE-1.0",
  productCode: "CBAM_EXPORTER_FINAL_REPORT",
  slug: "cbam-verifier-preparation-pack-5",
  currency: "USD",
  priceMinor: 14900,
  creditsGranted: 100,
  creditsRequiredToUnlock: 100,
  releasesPerPack: 5,
  subscription: false,
  active: true,
})) {
  requireExact(sourceContract[field], expected, `Commercial contract ${field}`);
}
if (JSON.stringify(sourceContract) !== JSON.stringify(generatedContract)) {
  failures.push("Browser and Functions commercial contracts are not byte-semantically equivalent.");
}
if (sourceContract.creditsGranted !== sourceContract.creditsRequiredToUnlock) {
  failures.push("Purchased credits must unlock exactly one Preparation Pack.");
}

const browserContract = read("lib/billing/commercial-contract.ts");
const browserCatalog = read("lib/billing/catalog.ts");
const functionContract = read("functions/src/commerce/commercial-contract.ts");
const functionCatalog = read("functions/src/commerce/catalog.ts");
const checkoutService = read("functions/src/commerce/paddle/checkout-service.ts");
const orderService = read("functions/src/commerce/order-service.ts");
const webhookProcessor = read("functions/src/commerce/webhook-processor.ts");
const webhookFunction = read("functions/src/webhook.ts");
const webhookProxy = read("app/api/webhooks/paddle/route.ts");
const retiredCheckout = read("app/api/checkout/cbam/route.ts");
const creditService = read("functions/src/commerce/credit-service.ts");
const entitlementService = read("functions/src/commerce/entitlement-service.ts");
const refundService = read("functions/src/commerce/refund-service.ts");
const commerceHandler = read("functions/src/handlers/commerce.ts");
const accountHandler = read("functions/src/handlers/account.ts");
const buyPage = read("app/(workspace)/credits/buy/page.tsx");
const homepage = read("app/(public)/page.tsx");
const accountPage = read("app/(workspace)/account/page.tsx");
const casePanel = read("app/(workspace)/cases/[caseId]/CaseCommercialPanel.tsx");
const adminGate = read("lib/auth/admin-gate.ts");
const adminHandler = read("functions/src/handlers/admin.ts");
const firestoreRules = read("firestore.rules");
const storageRules = read("storage.rules");
const packageBuilder = read("functions/src/cbam/report/verifier-package-builder.ts");
const commercialStressTest = read("tests/commerce/commercial-dna.test.ts");

requireText(browserContract, "CommercialContractSchema.parse", "Browser commercial contract");
requireText(functionContract, "CommercialContractSchema.parse", "Functions commercial contract");
requireText(browserCatalog, "COMMERCIAL_CONTRACT", "Browser catalog");
requireText(functionCatalog, "PADDLE_PRICE_ID_SANDBOX", "Functions catalog");
requireText(functionCatalog, "PADDLE_PRICE_ID_PRODUCTION", "Functions catalog");
rejectText(functionCatalog, 'priceId: "pri_', "Functions catalog");

requireText(buyPage, "createCommercialCheckout", "Purchase page");
requireText(buyPage, "transactionId: checkout.transactionId", "Purchase page");
requireText(buyPage, "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "Purchase page");
rejectText(buyPage, "priceId:", "Purchase page");
rejectText(buyPage, "customData:", "Purchase page");
rejectText(buyPage, "ord_${Date.now()}", "Purchase page");
rejectText(buyPage, "test_82d61", "Purchase page");
rejectText(buyPage, "€150", "Purchase page");
rejectText(buyPage, "$150", "Purchase page");

requireText(homepage, "COMMERCIAL_CONTRACT", "Homepage");
requireText(homepage, "formatCommercialPrice", "Homepage");
requireText(homepage, "27-component signed ZIP dossier", "Homepage");
rejectText(homepage, "USD 150", "Homepage");
rejectText(homepage, "No credits", "Homepage");

requireText(retiredCheckout, "CHECKOUT_ROUTE_RETIRED", "Retired duplicate checkout route");
rejectText(retiredCheckout, "transactions.create", "Retired duplicate checkout route");

requireText(checkoutService, 'collection("checkout_requests")', "Checkout service");
requireText(checkoutService, "checkoutDigest", "Checkout service");
requireText(checkoutService, "getPriceIdForProduct", "Checkout service");
requireText(checkoutService, "paddleTransactionId", "Checkout service");
requireText(checkoutService, "CHECKOUT_RECOVERY_REQUIRED", "Checkout service");
requireText(checkoutService, "customData", "Checkout service");
requireText(orderService, "assertOrderTransition", "Order state machine");
requireText(orderService, "ORDER_STATE_TRANSITION_INVALID", "Order state machine");

for (const token of [
  "order.uid !== purchase.uid",
  "order.productCode !== purchase.productCode",
  "order.checkoutRequestId !== purchase.requestId",
  "order.paddleTransactionId !== purchase.transactionId",
  "order.paddlePriceId !== purchase.priceId",
  "order.currency !== purchase.currency",
  "order.amountMinor !== purchase.totalMinor",
  "preparePurchasedCreditGrant",
  'status: "CREDITS_GRANTED"',
  "PADDLE_FULFILLMENT_PARTIAL_STATE",
]) {
  requireText(webhookProcessor, token, "Paddle fulfillment processor");
}

requireText(webhookFunction, "payloadSha256", "Webhook ingestion");
requireText(webhookFunction, "FAILED_RETRYABLE", "Webhook ingestion");
requireText(webhookFunction, "PADDLE_EVENT_PAYLOAD_MISMATCH", "Webhook ingestion");
requireText(webhookProxy, "PADDLE_WEBHOOK_FUNCTION_URL", "Webhook proxy");
requireText(webhookProxy, "Paddle-Signature", "Webhook proxy");
requireText(webhookProxy, "PADDLE_WEBHOOK_PROXY_UNAVAILABLE", "Webhook proxy");
rejectText(webhookProxy, 'status: "success"', "Webhook proxy");

for (const token of [
  "creditsRequiredToUnlock",
  'collection("creditSummary")',
  'collection("creditLedger")',
  'collection("commerceHold")',
  "PACK_UNLOCK_IDEMPOTENCY_BROKEN",
  "PACK_UNLOCK_PARTIAL_STATE",
  "scopeCaseId: params.caseId",
]) {
  requireText(creditService, token, "Credit and pack service");
}
for (const token of [
  "maxReleases",
  "releasesCount",
  "correctionReason",
  "COMMERCE_HOLD_ACTIVE",
  "DoubleSpendViolationError",
]) {
  requireText(entitlementService, token, "Entitlement service");
}
for (const token of [
  "REFUND_FULL_AMOUNT_REQUIRED",
  "Math.min(current.availableCredits",
  "deficitCredits",
  "REFUND_AFTER_CREDIT_CONSUMPTION",
  'active: true',
]) {
  requireText(refundService, token, "Refund service");
}
requireText(commerceHandler, "unlockPreparationPack", "Commerce callable handler");
requireText(commerceHandler, "z.string().uuid()", "Commerce callable handler");

requireText(accountHandler, 'collection("creditSummary")', "Account overview");
requireText(accountHandler, 'collection("commerce_orders")', "Purchase history");
requireText(accountHandler, 'collection("commerceHold")', "Account overview");
requireText(accountPage, "lifetimePurchased", "Account page");
requireText(accountPage, "commerceHold.active", "Account page");
rejectText(accountPage, "1 credit equals 1", "Account page");
requireText(casePanel, "unlockPreparationPack", "Case commercial panel");
requireText(casePanel, "assessCaseReadiness", "Case commercial panel");
requireText(casePanel, "correctionReason", "Case commercial panel");

for (const content of [adminGate, adminHandler, firestoreRules]) {
  requireText(content, "ownerAdmin", "Canonical owner-admin authorization");
  requireText(content, "email_verified", "Canonical owner-admin authorization");
  requireText(content, "admin", "Canonical owner-admin authorization");
}

for (const collection of [
  "commerce_orders",
  "entitlements",
  "commerce_ledger",
  "commerce_ledger_state",
  "paddle_events",
  "admin_audit",
]) {
  requireText(firestoreRules, `match /${collection}/`, "Firestore rules");
}
requireText(firestoreRules, "allow read, write: if false;", "Firestore default deny");
requireText(storageRules, "duration.value(15, 'm')", "Evidence rollback window");
requireText(storageRules, "allow update: if false;", "Evidence immutability");

for (const component of [
  "24_Executive_Verification_Readiness_Summary.pdf",
  "25_Per_Good_Embedded_Emissions_Schedule.csv",
  "26_Carbon_Price_Paid_Schedule.csv",
  "27_Read_Me_and_Verifier_Navigation_Guide.pdf",
]) {
  requireText(packageBuilder, component, "Mandated verifier package");
}
for (const legacyComponent of [
  "Operator Summary Statement.pdf",
  "Activity Data Ledger.csv",
  "Carbon Price Register.csv",
  "O3CI Field Mapping.csv",
]) {
  rejectText(packageBuilder, legacyComponent, "Mandated verifier package");
}

for (const token of [
  "fulfills one exact payment once",
  "rejects price, total, currency and identity tampering",
  "deducts one hundred credits exactly once",
  "recovers unused credits",
  "creates a blocking commerce hold",
]) {
  requireText(commercialStressTest, token, "Closed-loop commercial stress test");
}

if (fs.existsSync(path.join(root, "app/api/webhook/paddle"))) {
  failures.push("Legacy singular Paddle webhook route exists alongside the canonical plural route.");
}

if (failures.length) {
  for (const failure of failures) console.error(`[GUARD-COMMERCE] ERROR ${failure}`);
  console.error(`COMMERCIAL_ARCHITECTURE_GUARD=FAIL`);
  console.error(`COMMERCIAL_ARCHITECTURE_FAILURES=${failures.length}`);
  process.exit(1);
}

console.log("COMMERCIAL_ARCHITECTURE_GUARD=PASS");
console.log(`COMMERCIAL_PRODUCT=${sourceContract.productCode}`);
console.log(`COMMERCIAL_PRICE_MINOR=${sourceContract.priceMinor}`);
console.log(`COMMERCIAL_CREDITS_GRANTED=${sourceContract.creditsGranted}`);
console.log(`COMMERCIAL_RELEASES_PER_PACK=${sourceContract.releasesPerPack}`);
console.log("COMMERCIAL_CLIENT_PRICE_AUTHORITY=SERVER_ONLY");
console.log("COMMERCIAL_WEBHOOK_FULFILLMENT=STRICT_MATCH");
console.log("COMMERCIAL_PACK_UNLOCK=ATOMIC_IDEMPOTENT");
console.log("COMMERCIAL_REFUND_RECONCILIATION=NON_NEGATIVE_WITH_HOLD");
console.log("COMMERCIAL_REPORT_COMPONENT_CONTRACT=27_EXACT");
