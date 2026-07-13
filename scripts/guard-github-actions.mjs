import fs from "node:fs";
import path from "node:path";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");
const failures = [];

if (!fs.existsSync(workflowsDir)) {
  console.error("GITHUB_ACTIONS_GUARD=FAIL");
  console.error("- Missing .github/workflows directory");
  process.exit(1);
}

const files = fs.readdirSync(workflowsDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

for (const file of files) {
  const relativePath = `.github/workflows/${file}`;
  const content = fs.readFileSync(path.join(workflowsDir, file), "utf8");

  if (/pull_request_target\s*:/.test(content)) {
    failures.push(`${relativePath}: pull_request_target is prohibited`);
  }

  if (/permissions\s*:\s*write-all/.test(content)) {
    failures.push(`${relativePath}: permissions: write-all is prohibited`);
  }

  if (!/^permissions\s*:/m.test(content)) {
    failures.push(`${relativePath}: explicit top-level permissions are required`);
  }

  const floatingRefs = [...content.matchAll(/uses:\s*([^\s#]+)@(main|master|latest)\b/g)];
  for (const match of floatingRefs) {
    failures.push(`${relativePath}: floating action reference is prohibited: ${match[1]}@${match[2]}`);
  }

  if (/curl\s+[^\n|]+\|\s*(bash|sh)\b/.test(content)) {
    failures.push(`${relativePath}: pipe-to-shell installation is prohibited`);
  }

  if (/persist-credentials:\s*true/.test(content)) {
    failures.push(`${relativePath}: checkout credentials must not be explicitly persisted`);
  }
}

if (files.length === 0) {
  failures.push("No GitHub Actions workflows found");
}

if (failures.length > 0) {
  console.error("GITHUB_ACTIONS_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GITHUB_ACTIONS_GUARD=PASS");
console.log(`WORKFLOW_COUNT=${files.length}`);
console.log(`WORKFLOWS=${files.join(",")}`);
