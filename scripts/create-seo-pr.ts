/**
 * §30 / Ek Kod-12: PR Automation (GitHub API)
 *
 * Protocol: Creates automated PRs from n8n SEO workflows
 * or standalone scripts for striking-distance opportunities,
 * content decay fixes, schema updates, etc.
 *
 * [INTERNAL] Quality-of-life automation — human reviews every PR.
 *
 * Usage: npx ts-node scripts/create-seo-pr.ts --title "Update CN code benchmarks" --body "..." --branch feature/cn-benchmarks
 *
 * Env: GITHUB_TOKEN (required for API access)
 */

import { execSync } from "child_process";

interface PrOptions {
  title: string;
  body: string;
  branch: string;
  base?: string;
  labels?: string[];
}

function createPr(options: PrOptions): boolean {
  const { title, body, branch, base = "main", labels = ["seo", "automated"] } = options;

  console.log("[PR-AUTOMATION] ========================================");
  console.log("[PR-AUTOMATION] §24/§30: SEO PR Automation (Ek Kod-12)");
  console.log("[PR-AUTOMATION] ========================================\n");

  // Check gh CLI is available
  try {
    execSync("gh --version", { stdio: "pipe" });
  } catch {
    console.error("[PR-AUTOMATION] ❌ GitHub CLI (gh) not installed.");
    console.error("[PR-AUTOMATION] ℹ️ Install: brew install gh && gh auth login");
    return false;
  }

  // Check branch exists and is pushed
  try {
    execSync(`git rev-parse --verify ${branch}`, { stdio: "pipe" });
  } catch {
    console.error(`[PR-AUTOMATION] ❌ Branch "${branch}" does not exist locally.`);
    console.error("[PR-AUTOMATION] ℹ️ Create and push the branch first:");
    console.error(`[PR-AUTOMATION] ℹ️   git checkout -b ${branch}`);
    console.error(`[PR-AUTOMATION] ℹ️   git push -u origin ${branch}`);
    return false;
  }

  // Check branch is pushed to remote
  try {
    execSync(`git ls-remote --heads origin ${branch}`, { stdio: "pipe" });
  } catch {
    console.error(`[PR-AUTOMATION] ❌ Branch "${branch}" not pushed to remote.`);
    console.error(`[PR-AUTOMATION] ℹ️ Run: git push -u origin ${branch}`);
    return false;
  }

  // Create PR via gh CLI
  try {
    const labelArg = labels.map(l => `--label "${l}"`).join(" ");
    const cmd = `gh pr create --title "${title}" --body "${body}" --base ${base} --head ${branch} ${labelArg}`;
    console.log(`[PR-AUTOMATION] Running: ${cmd}`);

    const output = execSync(cmd, { encoding: "utf-8", stdio: "pipe" });
    console.log(`[PR-AUTOMATION] ✅ PR created: ${output.trim()}`);
    return true;
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string };
    if (err.stderr?.includes("already exists")) {
      const existingPr = execSync(`gh pr list --head ${branch} --json url --jq '.[0].url'`, { encoding: "utf-8" }).trim();
      console.log(`[PR-AUTOMATION] ⚠️ PR already exists: ${existingPr}`);
      return true;
    }
    console.error(`[PR-AUTOMATION] ❌ Failed to create PR: ${err.stderr || err.message}`);
    return false;
  }
}

// ─── MAIN ───

function parseArgs(): PrOptions {
  const args = process.argv.slice(2);
  const options: Partial<PrOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--title":
        options.title = args[++i];
        break;
      case "--body":
        options.body = args[++i];
        break;
      case "--branch":
        options.branch = args[++i];
        break;
      case "--base":
        options.base = args[++i];
        break;
      case "--labels":
        options.labels = args[++i].split(",");
        break;
    }
  }

  if (!options.title || !options.body || !options.branch) {
    console.error("[PR-AUTOMATION] ❌ Required: --title, --body, --branch");
    console.error("[PR-AUTOMATION] Usage: npx ts-node scripts/create-seo-pr.ts --title \"TITLE\" --body \"BODY\" --branch BRANCH");
    process.exit(1);
  }

  return options as PrOptions;
}

// ─── ESM entry-point guard ───
const isMainModule = process.argv[1]?.endsWith("create-seo-pr.ts") || process.argv[1]?.endsWith("create-seo-pr");

if (isMainModule) {
  const options = parseArgs();
  const success = createPr(options);
  process.exit(success ? 0 : 1);
}

export { createPr }; export type { PrOptions };
