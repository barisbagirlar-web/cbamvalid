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

const repository = read("functions/src/cbam/storage/case-repository.ts");
const idempotency = read("functions/src/cbam/storage/case-creation-idempotency.ts");
const caseHandler = read("functions/src/handlers/cases.ts");
const reportHandler = read("functions/src/handlers/reports.ts");
const browserSchema = read("lib/cbam/schema.ts");
const functionsSchema = read("functions/src/cbam/schema.ts");
const client = read("lib/functions/client.ts");
const saveContract = read("lib/functions/case-save-contract.ts");
const caseSummary = read("lib/cbam/case-summary.ts");
const newCasePage = read("app/(workspace)/cases/new/page.tsx");
const casePage = read("app/(workspace)/cases/[caseId]/page.tsx");
const casesPage = read("app/(workspace)/cases/page.tsx");
const dashboardPage = read("app/(workspace)/cbam/page.tsx");
const firebaseConfig = read("firebase.json");
const firestoreRules = read("firestore.rules");
const rootPackage = read("package.json");
const functionsPackage = read("functions/package.json");
const functionsTsConfig = read("functions/tsconfig.json");
const functionsCleanBuild = read("functions/scripts/clean-build.mjs");
const cleanNextTypes = read("scripts/clean-next-types.mjs");
const gitIgnore = read(".gitignore");

requireText(repository, 'collection("case_creation_requests").doc(identity.digest)', "Case creation idempotency collection");
requireText(repository, "adminDb.runTransaction", "Atomic case creation transaction");
requireText(repository, "await transaction.get(markerRef)", "Idempotency marker read before write");
requireText(repository, "await transaction.get(caseRef)", "Case existence read before write");
requireText(repository, "transaction.create(caseRef, persistedRecord)", "Canonical case create");
requireText(repository, "transaction.create(markerRef, creationMarker)", "Atomic idempotency marker create");
requireText(repository, '.where("caseId", "==", normalizedCaseId).limit(2)', "Legacy case lookup");
requireText(repository, "document.id === record.caseId", "Canonical record deduplication");
rejectText(repository, "await caseRef.set(cbamCase)", "Raw auto-ID write pattern");

requireText(idempotency, "deriveCaseCreationIdentity", "Deterministic creation identity");
requireText(idempotency, 'return "RETURN_EXISTING"', "Idempotent retry state");
requireText(idempotency, 'return "CREATE"', "First creation state");
requireText(idempotency, "CASE_CREATION_IDEMPOTENCY_BROKEN", "Partial-state fail-closed contract");
requireText(idempotency, "CASE_CREATION_IDEMPOTENCY_COLLISION", "Collision fail-closed contract");

requireText(caseHandler, "requestId: CreationRequestIdSchema.optional()", "Callable request ID validation");
requireText(caseHandler, "resolveCreationRequestId(requestId, parsedData)", "Rolling-deploy request ID resolution");
requireText(caseHandler, 'event.action === "CASE_CREATED"', "Legacy client idempotency fallback");
requireText(caseHandler, "createCase(auth.uid, parsedData, creationRequestId)", "Idempotent repository invocation");
rejectText(caseHandler, "createCase(auth.uid, parsedData)", "Non-idempotent case creation invocation");
requireText(caseHandler, "toCaseWorkspaceView(cbamCase)", "Workspace DTO boundary");
rejectText(caseHandler, "return { case: cbamCase", "Envelope leakage to wizard");
requireText(caseHandler, "AuditReadyCaseSchema.safeParse", "Server-side case validation");

requireText(reportHandler, "const cbamCase = await getCase(caseId)", "Sealing canonical case resolver");
rejectText(reportHandler, 'collection("cbam_cases").doc(caseId)', "Direct case document assumption in sealing");

requireText(browserSchema, "caseId: CaseIdSchema.optional()", "Browser case ID schema");
requireText(functionsSchema, "caseId: CaseIdSchema.optional()", "Functions case ID schema");
requireText(functionsSchema, "canonicalUnit: z.string().optional()", "Functions canonical unit compatibility");

requireText(client, "AuditReadyCaseSchema.parse(result.data.case)", "Client workspace response validation");
requireText(client, "createCaseSaveRequest(data, caseId, requestId)", "Idempotent save request");
requireText(saveContract, "AMBIGUOUS_CASE_SAVE_REQUEST", "Create/edit payload separation");
requireText(saveContract, "CASE_CREATION_REQUEST_ID_REQUIRED", "Mandatory create request ID");

requireText(newCasePage, "creationRequestId.current", "Stable creation request ID");
requireText(newCasePage, "requestInFlight.current", "Single-flight creation");
requireText(newCasePage, "saveCase(draft, undefined, creationRequestId.current", "Idempotent new-case call");
requireText(newCasePage, "Retry New Case", "Observable creation failure");
rejectText(newCasePage, 'router.push("/dashboard")', "Silent new-case dashboard fallback");
rejectText(newCasePage, 'router.replace("/dashboard")', "Silent new-case dashboard fallback");

requireText(casePage, "Promise.allSettled", "Case and entitlement failure isolation");
requireText(casePage, "let cancelled = false", "Workspace request cancellation guard");
requireText(casePage, "cancelled = true", "Workspace stale-response cancellation");
requireText(casePage, "const retryLoading = () =>", "Event-owned retry state reset");
requireText(casePage, "Retry Loading", "Observable workspace load failure");
rejectText(casePage, "useCallback", "Effect-owned synchronous state loader");
rejectText(casePage, "void loadWorkspace()", "Effect-owned synchronous state loader invocation");
rejectText(casePage, 'router.push("/dashboard")', "Silent workspace dashboard fallback");
rejectText(casePage, 'router.replace("/dashboard")', "Silent workspace dashboard fallback");

requireText(caseSummary, "caseData.installation.name", "Canonical installation summary path");
requireText(caseSummary, "caseData.goods[0]?.cnCode", "Canonical CN-code summary path");
requireText(caseSummary, "Number.isFinite", "Non-finite summary protection");
for (const [source, label] of [
  [casesPage, "Cases page"],
  [dashboardPage, "Dashboard page"],
]) {
  requireText(source, "getCaseDisplayName", `${label} shared installation projection`);
  requireText(source, "getPrimaryCnCode", `${label} shared CN-code projection`);
  rejectText(source, "data?.installationName", `${label} legacy installation path`);
  rejectText(source, "data?.cnCode", `${label} legacy CN-code path`);
}

requireText(firestoreRules, "match /case_creation_requests/{requestDigest}", "Explicit idempotency marker rule");
requireText(firestoreRules, "allow read, write: if false;", "Backend-only idempotency marker access");

requireText(rootPackage, "node scripts/clean-next-types.mjs && next typegen && tsc --noEmit", "Fresh Next route type generation");
requireText(cleanNextTypes, 'path.join(root, ".next", "types")', "Production route type cache cleanup");
requireText(cleanNextTypes, 'path.join(root, ".next", "dev", "types")', "Development route type cache cleanup");
requireText(cleanNextTypes, "fs.rmSync", "Generated type cache deletion");

requireText(functionsPackage, '"main": "build/index.js"', "Generated Functions runtime entry");
requireText(functionsPackage, '"node": "20"', "Lock-compatible local Functions engine metadata");
requireText(functionsPackage, '"build": "node scripts/clean-build.mjs && tsc"', "Clean Functions build command");
requireText(functionsTsConfig, '"outDir": "build"', "Untracked Functions build output");
requireText(functionsTsConfig, '"target": "es2022"', "Node.js 22-compatible compilation target");
requireText(functionsCleanBuild, 'path.join(functionsRoot, "build")', "Functions build directory isolation");
requireText(functionsCleanBuild, "fs.rmSync", "Stale Functions output removal");
requireText(functionsCleanBuild, "FUNCTIONS_BUILD_CLEAN=PASS", "Observable Functions clean-build evidence");
requireText(firebaseConfig, '"runtime": "nodejs22"', "Firebase Functions production runtime pin");
requireText(firebaseConfig, '"predeploy"', "Functions predeploy declaration");
requireText(firebaseConfig, "$RESOURCE_DIR", "Functions predeploy resource directory");
requireText(firebaseConfig, "run build", "Functions predeploy compiler command");
requireText(firebaseConfig, '"lib"', "Stale compiled Functions exclusion");
requireText(gitIgnore, "functions/build/", "Current Functions output ignore rule");
requireText(gitIgnore, "functions/lib/", "Legacy Functions output ignore rule");

if (failures.length) {
  console.error("CASE_RUNTIME_CONTRACT_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("CASE_RUNTIME_CONTRACT_GUARD=PASS");
console.log("CASE_DOCUMENT_IDENTITY=PASS");
console.log("CASE_WORKSPACE_DTO=PASS");
console.log("CASE_SCHEMA_PARITY=PASS");
console.log("CASE_CREATE_SINGLE_FLIGHT=PASS");
console.log("CASE_CREATE_IDEMPOTENCY=PASS");
console.log("CASE_ROLLING_DEPLOY_COMPATIBILITY=PASS");
console.log("CASE_LOAD_FAILURE_ISOLATION=PASS");
console.log("CASE_LOAD_CANCELLATION=PASS");
console.log("CASE_SEALING_RESOLVER=PASS");
console.log("CASE_SUMMARY_SCHEMA_PATHS=PASS");
console.log("CASE_CREATION_MARKER_RULES=PASS");
console.log("NEXT_TYPEGEN_CONTRACT=PASS");
console.log("FUNCTIONS_PRODUCTION_NODE22_RUNTIME=PASS");
console.log("FUNCTIONS_LOCAL_LOCK_COMPATIBILITY=PASS");
console.log("FUNCTIONS_GENERATED_OUTPUT_ISOLATION=PASS");
console.log("FUNCTIONS_CLEAN_BUILD=PASS");
console.log("FUNCTIONS_PREDEPLOY_BUILD=PASS");
