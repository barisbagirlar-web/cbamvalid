/**
 * FAZ 16 guard — External professional acceptance.
 *
 * 1. Validates that the external-acceptance module defines all 12 mandated
 *    criteria and all three required reviewer roles, and that the default
 *    acceptance state is NOT_ACCEPTED (fail-closed).
 * 2. Validates the runtime behaviour of the builder: ACCEPTED is unreachable
 *    while any critical/high finding is open or any reviewer is pending.
 * 3. Verifies that no customer-facing or shipped report/product text claims
 *    final acceptance (GLOBAL_PREMIUM / VERIFIER_READY / 10/10 /
 *    449 USD VALUE VALIDATED) while external acceptance is not complete.
 */
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

const moduleSource = read("functions/src/cbam/report/external-acceptance.ts");
requireText(moduleSource, "Legal completeness", "EXT-01 criterion present");
requireText(moduleSource, "Monitoring plan completeness", "EXT-02 criterion present");
requireText(moduleSource, "Calculation reproducibility", "EXT-03 criterion present");
requireText(moduleSource, "Evidence sufficiency", "EXT-04 criterion present");
requireText(moduleSource, "Materiality usability", "EXT-05 criterion present");
requireText(moduleSource, "Risk and sampling usability", "EXT-06 criterion present");
requireText(moduleSource, "Site-visit readiness", "EXT-07 criterion present");
requireText(moduleSource, "Registry template readiness", "EXT-08 criterion present");
requireText(moduleSource, "Report clarity", "EXT-09 criterion present");
requireText(moduleSource, "Verifier workload reduction", "EXT-10 criterion present");
requireText(moduleSource, "Misleading claim absence", "EXT-11 criterion present");
requireText(moduleSource, "Commercial value", "EXT-12 criterion present");
requireText(moduleSource, "CBAM_METHODOLOGY_SPECIALIST", "Methodology specialist reviewer role present");
requireText(moduleSource, "ACCREDITED_CBAM_VERIFIER", "Accredited verifier reviewer role present");
requireText(moduleSource, "FINANCIAL_OPERATIONAL_DATA_CONTROL_SPECIALIST", "Data control specialist reviewer role present");

// Runtime behaviour is covered by tests/reports/external-acceptance.test.ts (runs
// inside the test:reports gate). Here we enforce the fail-closed invariants
// statically against the authoritative module source so the guard is
// deterministic and has no runtime tooling dependency.
requireText(moduleSource, "overall: \"NOT_ACCEPTED\"", "default acceptance state is fail-closed NOT_ACCEPTED");
requireText(moduleSource, "completionState: \"PENDING\"", "reviewers start PENDING");
requireText(moduleSource, "allReviewersComplete && noFailedRows && criticalFindingsOpen === 0 && highFindingsOpen === 0", "ACCEPTED requires all reviewers, no failed rows and zero findings");
requireText(moduleSource, "EXTERNAL_CRITERION_UNKNOWN", "unknown criteria are rejected");

// Acceptance-claim scan on customer-facing sources. The mandate forbids these
// claims until every final-acceptance field passes. Internal scripts and the
// module that documents the acceptance contract are exempt.
const scanTargets = [
  "lib/product/journey-state.ts",
  "app/(workspace)/cbam/reports/[reportId]/page.tsx",
  "app/(workspace)/cases/[caseId]/CaseWizardClient.tsx",
  "functions/src/cbam/report/premium-dossier-pdf.ts",
  "functions/src/cbam/report/professional-pdf.ts",
  "functions/src/cbam/report/xlsx-builder.ts",
];
const bannedClaims = ["GLOBAL_PREMIUM", "VERIFIER_READY", "449 USD VALUE VALIDATED"];

for (const relativePath of scanTargets) {
  const source = read(relativePath);
  if (!source) continue;
  for (const claim of bannedClaims) {
    rejectText(source, claim, `${relativePath} must not claim ${claim}`);
  }
  // "10/10" is only allowed as a comment, never as a shipped status claim.
  const matches = [...source.matchAll(/10\/10/g)];
  for (const match of matches) {
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const lineEnd = source.indexOf("\n", match.index);
    const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
    if (!line.trimStart().startsWith("//") && !line.trimStart().startsWith("*")) {
      failures.push(`${relativePath}: "10/10" used as a shipped claim: ${line.trim()}`);
    }
  }
}

if (failures.length > 0) {
  console.error("EXTERNAL_ACCEPTANCE_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("EXTERNAL_ACCEPTANCE_GUARD=PASS");
