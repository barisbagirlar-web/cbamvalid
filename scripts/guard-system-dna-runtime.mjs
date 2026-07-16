import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${relativePath}:missing`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

function requireText(relativePath, required) {
  const content = read(relativePath);
  for (const value of required) {
    if (!content.includes(value)) failures.push(`${relativePath}:missing:${value}`);
  }
  return content;
}

function rejectText(relativePath, forbidden) {
  const content = read(relativePath);
  for (const value of forbidden) {
    if (content.includes(value)) failures.push(`${relativePath}:forbidden:${value}`);
  }
}

requireText("app/api/auth/session/route.ts", [
  "verifyIdToken(idToken, true)",
  "EMAIL_VERIFICATION_REQUIRED",
  "AUTH_RECENT_REQUIRED",
]);
requireText("functions/src/auth/verified-user.ts", [
  "EMAIL_VERIFICATION_REQUIRED",
  "email_verified !== true",
]);
for (const handler of [
  "functions/src/handlers/account.ts",
  "functions/src/handlers/cases.ts",
  "functions/src/handlers/commerce.ts",
  "functions/src/handlers/reports.ts",
]) {
  requireText(handler, ["requireVerifiedUser(auth)"]);
}

requireText("proxy.ts", [
  '"/account"',
  '"/credits"',
  "matchesRoute(pathname, prefix)",
  "private, no-store, no-cache, must-revalidate",
]);
requireText("lib/auth/safe-next-route.ts", [
  '!candidate.startsWith("/")',
  'candidate.startsWith("//")',
  'candidate.includes("\\\\")',
]);
requireText("lib/auth/post-login-routing.ts", [
  'claims.role === "super_admin"',
  "claims.owner === true",
  "claims.email_verified === true",
  "resolveSafeNextRoute",
]);
rejectText("lib/auth/post-login-routing.ts", ["claims.ownerAdmin", "claims.admin"]);

const caseHandlers = requireText("functions/src/handlers/cases.ts", [
  "requireOwnerSuperAdmin(auth)",
  "OWNER_INTERNAL_REVIEW_NOT_INDEPENDENT_VERIFICATION",
]);
for (const value of ["auth.token.admin", "auth.token.ownerAdmin"]) {
  if (caseHandlers.includes(value)) failures.push(`functions/src/handlers/cases.ts:forbidden:${value}`);
}

requireText("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx", [
  'entitlement.status === "AVAILABLE"',
  "entitlement.scopeCaseId",
  "correctionRequired",
  "Correction reason for release version",
  "PREPARATION_PACK.creditsPerRelease",
  "not independent verifier approval",
]);
rejectText("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx", [
  'entitlement.status === "ACTIVE"',
  'entitlement.status === "PURCHASED"',
]);

requireText("functions/src/cbam/report/seal-service.ts", [
  "cleanupUnactivatedArtifacts",
  "committedArtifactPaths",
  'status: "STAGING"',
  "releaseEntitlementReservation",
  'commercialStatus: "ACTIVE"',
]);

requireText("app/api/verify/[documentHash]/route.ts", [
  'dynamic = "force-dynamic"',
  '"Cache-Control": "no-store, max-age=0"',
  "SEAL_RECONCILIATION_FAILED",
  "REFUNDED_AFTER_DELIVERY",
]);
rejectText("app/api/verify/[documentHash]/route.ts", ["EU-CBAM-DEFINITIVE-2026"]);
requireText("app/(public)/verify/page.tsx", [
  'state === "REFUNDED"',
  "Cryptographic Registration Confirmed",
  "Commercial status warning",
]);

requireText("lib/billing/paddle-config.server.ts", [
  "PADDLE_PRICE_ID_PRODUCTION",
  "PADDLE_PRICE_ID_SANDBOX",
  "expectedWebhookUrl",
  "WEBHOOK_URL_MISMATCH",
]);
requireText("scripts/check-paddle-config.ts", [
  "PADDLE_DASHBOARD_ENDPOINT_VERIFIED=NO",
  "PADDLE_CONFIG_STATIC_CHECK=PASS",
]);

const rules = requireText("firestore.rules", [
  "request.auth.token.email_verified == true",
  "request.auth.token.role == 'super_admin'",
  "request.auth.token.owner == true",
  "match /commerce_ledger/{entryId}",
  "match /credit_events/{eventId}",
  "match /commerce_manual_reviews/{reviewId}",
]);
for (const value of [
  "request.auth.token.admin == true",
  "request.auth.token.ownerAdmin == true",
  "request.resource.data.tokens == resource.data.tokens - 1",
]) {
  if (rules.includes(value)) failures.push(`firestore.rules:forbidden:${value}`);
}

if (failures.length > 0) {
  console.error("SYSTEM_DNA_RUNTIME_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SYSTEM_DNA_RUNTIME_GUARD=PASS");
console.log("VERIFIED_SESSION_AND_CALLABLES=PASS");
console.log("WORKSPACE_PROXY_BOUNDARY=PASS");
console.log("EVIDENCE_AUTHORITY_BOUNDARY=PASS");
console.log("CORRECTION_RELEASE_WORKFLOW=PASS");
console.log("SEAL_RECOVERY_CONTRACT=PASS");
console.log("PUBLIC_VERIFY_LIVE_STATUS=PASS");
console.log("PADDLE_ENDPOINT_STATIC_CONTRACT=PASS");
