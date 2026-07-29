import fs from "node:fs";
import path from "node:path";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");
const packageJsonPath = path.join(process.cwd(), "package.json");
const failures = [];
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageScripts = packageJson.scripts ?? {};

if (packageJson.engines?.node !== "22.x") {
  failures.push("package.json: root engines.node must be pinned to 22.x");
}
const nvmrcPath = path.join(process.cwd(), ".nvmrc");
if (!fs.existsSync(nvmrcPath) || fs.readFileSync(nvmrcPath, "utf8").trim() !== "22") {
  failures.push(".nvmrc: root developer runtime must be pinned to Node 22");
}

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

  const runsNodeCommands =
    /run:\s*(?:node|npm|npx)\b/.test(content) ||
    /\n\s+(?:node|npm|npx)\s/.test(content);

  if (runsNodeCommands) {
    if (!/uses:\s*actions\/setup-node@v4\b/.test(content)) {
      failures.push(`${relativePath}: Node commands require actions/setup-node@v4`);
    }
    if (!/node-version:\s*["']?22["']?\s*$/m.test(content)) {
      failures.push(`${relativePath}: Node commands must run on Node 22`);
    }
  }

  if (/node-version:\s*["']?20["']?\s*$/m.test(content)) {
    failures.push(`${relativePath}: Node 20 is prohibited; production runtime is Node 22`);
  }

  for (const match of content.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:._-]+)/g)) {
    const scriptName = match[1];
    if (!Object.prototype.hasOwnProperty.call(packageScripts, scriptName)) {
      failures.push(`${relativePath}: npm script does not exist: ${scriptName}`);
    }
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
console.log("WORKFLOW_NODE22_RUNTIME_CONTRACT=PASS");
