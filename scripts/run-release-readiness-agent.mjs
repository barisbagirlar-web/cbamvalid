import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve(process.argv[2] || "artifacts/release-readiness");
fs.mkdirSync(outputDir, { recursive: true });

const checks = [
  ["hosting-architecture", "npm run guard:hosting-architecture"],
  ["workspace-navigation", "npm run guard:workspace-navigation"],
  ["github-actions-policy", "npm run guard:github-actions"],
  ["typecheck", "npm run typecheck"],
  ["lint", "npm run lint"],
  ["auth-tests", "npm run test:auth"],
  ["commerce-tests", "npm run test:commerce"],
  ["cbam-engine-tests", "npm run test:cbam-engine"],
  ["report-tests", "npm run test:reports"],
  ["production-build", "npm run build"],
  ["production-dependency-audit", "npm audit --omit=dev --audit-level=high"]
];

const results = [];

for (const [id, command] of checks) {
  const startedAt = Date.now();
  const run = spawnSync(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const durationMs = Date.now() - startedAt;
  const exitCode = typeof run.status === "number" ? run.status : 1;
  const output = `${run.stdout || ""}${run.stderr || ""}`;
  fs.writeFileSync(path.join(outputDir, `${id}.log`), output, "utf8");
  results.push({ id, command, exitCode, durationMs, result: exitCode === 0 ? "PASS" : "FAIL" });
  console.log(`${id}: ${exitCode === 0 ? "PASS" : "FAIL"} (exit=${exitCode}, durationMs=${durationMs})`);
}

const failed = results.filter((result) => result.exitCode !== 0);
const summary = {
  generatedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || "LOCAL",
  runId: process.env.GITHUB_RUN_ID || "LOCAL",
  result: failed.length === 0 ? "PASS" : "FAIL",
  checks: results
};

fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const markdown = [
  "# CBAMValid Release Readiness Agent",
  "",
  `- Result: **${summary.result}**`,
  `- Commit: \`${summary.commitSha}\``,
  `- Generated: ${summary.generatedAt}`,
  "",
  "| Check | Exit code | Duration | Result |",
  "|---|---:|---:|---|",
  ...results.map((item) => `| ${item.id} | ${item.exitCode} | ${item.durationMs} ms | ${item.result} |`),
  "",
  failed.length ? `Failed checks: ${failed.map((item) => `\`${item.id}\``).join(", ")}` : "All configured source-level readiness checks passed.",
  "",
  "This source-level audit does not prove deployment, live payment, browser E2E, live build SHA or production runtime logs.",
  ""
].join("\n");
fs.writeFileSync(path.join(outputDir, "summary.md"), markdown, "utf8");

const manifestLines = fs.readdirSync(outputDir)
  .filter((file) => file !== "evidence-manifest.txt")
  .sort()
  .map((file) => `${file}\t${fs.statSync(path.join(outputDir, file)).size}`);
fs.writeFileSync(path.join(outputDir, "evidence-manifest.txt"), `${manifestLines.join("\n")}\n`, "utf8");

process.exit(failed.length === 0 ? 0 : 1);
