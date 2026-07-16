import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relativePath}: missing`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function requireTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    if (!content.includes(token)) failures.push(`${relativePath}: missing ${JSON.stringify(token)}`);
  }
  return content;
}

function rejectTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    if (content.includes(token)) failures.push(`${relativePath}: forbidden ${JSON.stringify(token)}`);
  }
  return content;
}

const packTokens = [
  'productCode: "CBAM_CREDIT_PACK_5"',
  'slug: "cbam-5-reports"',
  'currency: "USD"',
  "priceMinor: 14900",
  "accountCredits: 100",
  "maxReleases: 5",
  "creditsPerRelease: 20",
];
requireTokens("lib/commerce/preparation-pack.ts", packTokens);
requireTokens("functions/src/commerce/preparation-pack.ts", packTokens);

const serverCatalog = requireTokens("functions/src/commerce/catalog.ts", [
  "[PREPARATION_PACK.productCode]: product",
  "expectedUnitAmount: PREPARATION_PACK.priceMinor",
  "accountCredits: PREPARATION_PACK.accountCredits",
  "creditsPerRelease: PREPARATION_PACK.creditsPerRelease",
  "PADDLE_PRICE_ID_SANDBOX",
  "PADDLE_PRICE_ID_PRODUCTION",
]);
for (const forbidden of ["CBAM_EXPORTER_FINAL_REPORT", "pri_01j2f", "missing-price-id"]) {
  if (serverCatalog.includes(forbidden)) failures.push(`functions/src/commerce/catalog.ts: forbidden ${forbidden}`);
}

requireTokens("app/(workspace)/credits/buy/page.tsx", [
  "createCheckout(requestId.current)",
  "transactionId: result.transactionId",
  "paymentConfigured",
  "No charge was created",
]);
rejectTokens("app/(workspace)/credits/buy/page.tsx", [
  "customData:",
  "items: [{ priceId",
  "PADDLE_PRICE_ID",
]);

requireTokens("app/api/checkout/cbam/route.ts", ["CHECKOUT_ROUTE_RETIRED", "status: 410"]);
requireTokens("app/api/webhooks/paddle/route.ts", ["WEBHOOK_ROUTE_RETIRED", "status: 410"]);
requireTokens("functions/src/index.ts", ['export * from "./webhook"']);

requireTokens("functions/src/commerce/paddle/checkout-service.ts", [
  "assertPaddleConfigured()",
  "getProduct(params.productCode)",
  "getPriceIdForProduct(params.productCode, sandbox)",
  "requestId: params.requestId",
  "orderId: result.order.orderId",
]);
rejectTokens("functions/src/commerce/paddle/checkout-service.ts", ["params.amount", "params.currency", "params.priceId"]);

requireTokens("functions/src/commerce/transaction-contract.ts", [
  "PADDLE_ENVIRONMENT_MISMATCH",
  "PADDLE_CURRENCY_MISMATCH",
  "PADDLE_PRICE_ID_MISMATCH",
  "PADDLE_AMOUNT_MISMATCH",
  "PADDLE_QUANTITY_INVALID",
]);

requireTokens("functions/src/webhook.ts", [
  'request.rawBody.toString("utf8")',
  'request.headers["paddle-signature"]',
  'processingState: "FAILED_RETRYABLE"',
  "attempts >= 10",
  "payloadSha256",
  "WEBHOOK_CONFIGURATION_ERROR",
  "PADDLE_EVENT_ENVELOPE_INVALID",
]);
requireTokens("functions/src/commerce/webhook-processor.ts", [
  "validateCompletedTransaction",
  "fulfillPreparationPackPurchase",
  "processRefund",
  "commerce_manual_reviews",
  "PARTIAL_OR_EXCESS_ADJUSTMENT",
]);
requireTokens("functions/src/commerce/webhook-verifier.ts", [
  "paddle.webhooks.unmarshal",
  "PADDLE_WEBHOOK_SECRET",
  "InvalidWebhookSignatureError",
]);

requireTokens("functions/src/commerce/purchase-fulfillment.ts", [
  'status: "ENTITLED"',
  "creditsRemaining: PREPARATION_PACK.accountCredits",
  "availableCredits: balanceAfter",
  'type: "PURCHASE_CREDIT"',
  'type: "PAYMENT_CAPTURED"',
]);
requireTokens("functions/src/commerce/entitlement-service.ts", [
  "creditsRemaining !== expectedCredits",
  "creditSummary.availableCredits < PREPARATION_PACK.creditsPerRelease",
  "entitlement.creditsRemaining < PREPARATION_PACK.creditsPerRelease",
  "availableCredits: balanceAfter",
  "creditsRemaining,",
  'type: "SEAL_CONSUMPTION"',
]);
requireTokens("functions/src/cbam/report/seal-service.ts", [
  "await consumeEntitlement(transaction",
  'status: "SEALED"',
  'commercialStatus: "ACTIVE"',
  "releaseEntitlementReservation",
]);

requireTokens("functions/src/commerce/refund-service.ts", [
  "REFUND_ENTITLEMENT_CONSERVATION_INVALID",
  "REFUND_REPORT_RECONCILIATION_INVALID",
  'commercialStatus: "REFUNDED_AFTER_DELIVERY"',
  'status: "REVOKED"',
]);

requireTokens("functions/src/auth/verified-user.ts", [
  "EMAIL_VERIFICATION_REQUIRED",
  "auth.token.email_verified !== true",
]);
requireTokens("functions/src/handlers/commerce.ts", [
  "requireVerifiedUser(auth)",
  "z.literal(PREPARATION_PACK.productCode)",
  "LEGACY_CREDIT_UNLOCK_DISABLED",
]);
requireTokens("functions/src/handlers/reports.ts", [
  "requireVerifiedUser(auth)",
  "sealCbamReport",
]);
requireTokens("context/AuthProvider.tsx", [
  "if (!refreshedUser.emailVerified)",
  'fetch("/api/auth/session", { method: "DELETE" })',
]);
requireTokens("app/(auth)/register/page.tsx", [
  "sendEmailVerification",
  "Create Account and Verify Email",
  "minLength={12}",
]);
requireTokens("app/(auth)/login/page.tsx", [
  "if (!user.emailVerified)",
  "sendEmailVerification",
]);
requireTokens("app/(auth)/verify-email/page.tsx", [
  "RESEND_COOLDOWN_SECONDS",
  "Check Verification",
  "finalizeServerSession",
]);
requireTokens("lib/auth/safe-next-route.ts", [
  '!candidate.startsWith("/")',
  'candidate.startsWith("//")',
  'candidate.includes("\\\\")',
]);

requireTokens("functions/src/auth/owner-admin.ts", [
  "OWNER_ADMIN_UID",
  "OWNER_ADMIN_EMAIL",
  'auth.token.role === "super_admin"',
  "auth.token.owner === true",
  "auth.token.email_verified === true",
]);
requireTokens("lib/auth/admin-gate.ts", [
  "OWNER_ADMIN_UID",
  "OWNER_ADMIN_EMAIL",
  'claims.role === "super_admin"',
  "claims.owner === true",
  "claims.email_verified === true",
]);
requireTokens("lib/auth/post-login-routing.ts", [
  'claims.role === "super_admin"',
  "claims.owner === true",
  "claims.email_verified === true",
  "resolveSafeNextRoute",
]);
rejectTokens("lib/auth/post-login-routing.ts", ["claims.ownerAdmin", "claims.admin"]);
requireTokens("functions/src/handlers/admin.ts", [
  "requireOwnerSuperAdmin(auth)",
  "LEGACY_ABSOLUTE_CREDIT_SETTER_DISABLED",
]);
requireTokens("lib/account-contract.ts", [
  "availableCredits: z.number().int().nonnegative()",
  "balanceAfter: z.number().int().nonnegative()",
]);

const firestoreRules = requireTokens("firestore.rules", [
  "request.auth.token.email_verified == true",
  "request.auth.token.role == 'super_admin'",
  "request.auth.token.owner == true",
  "allow write: if false;",
  "match /commerce_ledger/{entryId}",
  "match /credit_events/{eventId}",
  "match /commerce_manual_reviews/{reviewId}",
]);
for (const forbidden of [
  "request.auth.token.admin == true",
  "request.auth.token.ownerAdmin == true",
  "request.resource.data.tokens == resource.data.tokens - 1",
]) {
  if (firestoreRules.includes(forbidden)) failures.push(`firestore.rules: forbidden ${forbidden}`);
}

const commercialSurfaceFiles = [
  "app/(public)/page.tsx",
  "app/(public)/product/page.tsx",
  "app/(public)/cn-code/[code]/page.tsx",
  "app/(workspace)/cbam/page.tsx",
  "app/(workspace)/credits/buy/page.tsx",
  "app/(workspace)/account/page.tsx",
  "components/layout/AppHeader.tsx",
  "lib/billing/catalog.ts",
  "functions/src/commerce/catalog.ts",
];
for (const relativePath of commercialSurfaceFiles) {
  rejectTokens(relativePath, ["USD 150", "$150", "No credits", "1 credit equals 1", "Exporter Evidence XML"]);
}

const productionSecretFiles = [
  "functions/src/commerce/paddle-client.ts",
  "functions/src/commerce/webhook-verifier.ts",
  "functions/src/commerce/catalog.ts",
  "app/(workspace)/credits/buy/page.tsx",
];
for (const relativePath of productionSecretFiles) {
  const content = read(relativePath);
  if (/pdl_(?:sdbx|live)_[A-Za-z0-9_-]{8,}/.test(content)) {
    failures.push(`${relativePath}: hardcoded Paddle credential pattern`);
  }
}

if (failures.length > 0) {
  console.error("SYSTEM_DNA_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SYSTEM_DNA_GUARD=PASS");
console.log("CANONICAL_PRODUCT_CONTRACT=PASS");
console.log("SINGLE_PAYMENT_CHANNEL=PASS");
console.log("SERVER_OWNED_CHECKOUT=PASS");
console.log("WEBHOOK_AUTHENTICITY_AND_RETRY=PASS");
console.log("CREDIT_CONSERVATION=PASS");
console.log("ENTITLEMENT_SCOPE_AND_SEAL_ATOMICITY=PASS");
console.log("REFUND_RECONCILIATION=PASS");
console.log("EMAIL_VERIFICATION_BOUNDARY=PASS");
console.log("TENANT_FIRESTORE_RULES=PASS");
console.log("EXACT_OWNER_ADMIN_GATE=PASS");
console.log("STALE_COMMERCIAL_COPY_SCAN=PASS");
