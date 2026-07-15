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
const handler = read("functions/src/handlers/cases.ts");
const browserSchema = read("lib/cbam/schema.ts");
const functionsSchema = read("functions/src/cbam/schema.ts");
const client = read("lib/functions/client.ts");
const newCasePage = read("app/(workspace)/cases/new/page.tsx");
const casePage = read("app/(workspace)/cases/[caseId]/page.tsx");
const firebaseConfig = read("firebase.json");

requireText(repository, "collection.doc(persistedRecord.caseId).create(persistedRecord)", "Canonical Firestore document identity");
requireText(repository, '.where("caseId", "==", normalizedCaseId).limit(2)', "Legacy case lookup");
requireText(repository, "document.id === record.caseId", "Canonical record deduplication");
rejectText(repository, "await caseRef.set(cbamCase)", "Raw auto-ID write pattern");

requireText(handler, "toCaseWorkspaceView(cbamCase)", "Workspace DTO boundary");
rejectText(handler, "return { case: cbamCase", "Envelope leakage to wizard");
requireText(handler, "AuditReadyCaseSchema.safeParse", "Server-side case validation");

requireText(browserSchema, "caseId: CaseIdSchema.optional()", "Browser case ID schema");
requireText(functionsSchema, "caseId: CaseIdSchema.optional()", "Functions case ID schema");
requireText(functionsSchema, "canonicalUnit: z.string().optional()", "Functions canonical unit compatibility");

requireText(client, "AuditReadyCaseSchema.parse(result.data.case)", "Client workspace response validation");
requireText(client, "createCaseSaveRequest(data, caseId)", "Undefined-free save request");

requireText(newCasePage, "requestInFlight.current", "Single-flight creation");
requireText(newCasePage, "Retry New Case", "Observable creation failure");
rejectText(newCasePage, 'router.push("/dashboard")', "Silent new-case dashboard fallback");
rejectText(newCasePage, 'router.replace("/dashboard")', "Silent new-case dashboard fallback");

requireText(casePage, "Promise.allSettled", "Case and entitlement failure isolation");
requireText(casePage, "Retry Loading", "Observable workspace load failure");
rejectText(casePage, 'router.push("/dashboard")', "Silent workspace dashboard fallback");
rejectText(casePage, 'router.replace("/dashboard")', "Silent workspace dashboard fallback");

requireText(firebaseConfig, 'npm --prefix \\"$RESOURCE_DIR\\" run build', "Functions predeploy build");

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
console.log("CASE_LOAD_FAILURE_ISOLATION=PASS");
console.log("FUNCTIONS_PREDEPLOY_BUILD=PASS");
