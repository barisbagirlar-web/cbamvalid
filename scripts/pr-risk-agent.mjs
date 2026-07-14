import fs from "node:fs";
import path from "node:path";

const [inputPath = "changed-files.txt", outputPath = "pr-risk-report.md"] = process.argv.slice(2);

if (!fs.existsSync(inputPath)) {
  console.error(`PR_RISK_AGENT=FAIL\nMissing changed-file list: ${inputPath}`);
  process.exit(1);
}

const files = fs.readFileSync(inputPath, "utf8")
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

const categories = [
  {
    id: "AUTH_AND_TENANT",
    severity: "P0",
    patterns: [/^app\/api\/auth\//, /^app\/\(auth\)\//, /^lib\/auth\//, /^lib\/firebase\//, /^context\/AuthProvider/, /^firestore\.rules$/],
    gates: ["Authentication tests", "Unauthorized-access review", "Tenant-isolation review", "Server/client boundary review"]
  },
  {
    id: "COMMERCE_AND_REVENUE",
    severity: "P0",
    patterns: [/^app\/api\/checkout\//, /^app\/api\/webhooks\//, /^app\/\(workspace\)\/credits\//, /^lib\/commerce\//, /^functions\/src\/commerce\//],
    gates: ["Commerce tests", "Webhook authenticity review", "Ledger atomicity review", "Replay/idempotency evidence"]
  },
  {
    id: "CALCULATION_INTEGRITY",
    severity: "P0",
    patterns: [/^lib\/cbam\/calculation\//, /^lib\/cbam\/sectors\//, /^lib\/cbam\/regulatory\//, /^functions\/src\/cbam\/calculation\//, /^functions\/src\/cbam\/sectors\//, /^tests\/cbam-engine\//],
    gates: ["Independent golden fixtures", "Property tests", "Unit/dimension review", "Rounding and boundary review"]
  },
  {
    id: "EVIDENCE_REPORTS_AND_SEALING",
    severity: "P0",
    patterns: [/^lib\/cbam\/(report|validation|storage)\//, /^functions\/src\/cbam\/(report|validation|storage)\//, /^app\/\(workspace\)\/cases\//, /^app\/\(workspace\)\/reports\//, /^tests\/reports\//],
    gates: ["Report tests", "Failed-seal zero-use review", "Manifest/hash verification", "Immutable-version review"]
  },
  {
    id: "NAVIGATION_AND_USER_FLOW",
    severity: "P1",
    patterns: [/^components\/layout\//, /^lib\/navigation/, /^app\/\(workspace\)\/(cbam|cases|reports)\//, /^app\/\(public\)\/layout/, /^components\/methodology\//],
    gates: ["Workspace navigation guard", "Header layout isolation", "Distinct route-content review", "Responsive/browser review"]
  },
  {
    id: "RELEASE_AND_SUPPLY_CHAIN",
    severity: "P1",
    patterns: [/^\.github\//, /^scripts\/guard-/, /^package(-lock)?\.json$/, /^firebase\.json$/, /^apphosting\.yaml$/],
    gates: ["Workflow integrity", "Security and supply-chain scan", "Production build", "Evidence artifact review"]
  }
];

const matches = categories
  .map((category) => ({
    ...category,
    files: files.filter((file) => category.patterns.some((pattern) => pattern.test(file)))
  }))
  .filter((category) => category.files.length > 0);

const severityRank = { P0: 0, P1: 1, P2: 2 };
const highestSeverity = matches.length
  ? [...matches].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])[0].severity
  : "P2";

const gates = [...new Set([
  "Typecheck",
  "Lint",
  "Relevant unit/integration tests",
  "Production build",
  ...matches.flatMap((category) => category.gates)
])];

const uncategorized = files.filter((file) => !matches.some((category) => category.files.includes(file)));
const marker = "<!-- cbamvalid-pr-risk-agent -->";

const report = [
  marker,
  "## CBAMValid PR Risk Agent",
  "",
  `**Risk level:** ${highestSeverity}`,
  `**Changed files:** ${files.length}`,
  "",
  matches.length ? "### Detected release surfaces" : "### Detected release surfaces\nNo release-critical path category was detected.",
  ...matches.flatMap((category) => [
    `- **${category.id} (${category.severity})**`,
    ...category.files.map((file) => `  - \`${file}\``)
  ]),
  "",
  "### Required evidence",
  ...gates.map((gate) => `- [ ] ${gate}`),
  "",
  "### Review constraints",
  "- Do not mark production readiness from source or build success alone.",
  "- Record commands and exit codes; use `NOT_PROVEN` for missing runtime evidence.",
  "- Do not deploy, change production configuration or perform destructive cloud operations from this automation.",
  ...(uncategorized.length ? ["", "### Other changed files", ...uncategorized.map((file) => `- \`${file}\``)] : []),
  ""
].join("\n");

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, report, "utf8");

console.log("PR_RISK_AGENT=PASS");
console.log(`RISK_LEVEL=${highestSeverity}`);
console.log(`CATEGORY_COUNT=${matches.length}`);
console.log(`CHANGED_FILE_COUNT=${files.length}`);
