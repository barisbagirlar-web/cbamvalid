import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("=== STARTING PREMIUM DOSSIER RELEASE GUARD ===");

function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    const output = execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

// 1. Compliance Claim check
const PROHIBITED_CLAIMS = [
  "eu certified",
  "accredited verification",
  "official eu submission",
  "guaranteed compliance"
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes("node_modules") && !fullPath.includes(".next") && !fullPath.includes(".git")) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") || fullPath.endsWith(".md")) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

console.log("Running compliance checks...");
const rootDir = process.cwd();
const files = [
  ...getAllFiles(path.join(rootDir, "lib")),
  ...getAllFiles(path.join(rootDir, "app")),
  ...getAllFiles(path.join(rootDir, "functions", "src")),
];

let violations = [];
files.forEach((file) => {
  if (file.includes("compliance-guard.test.ts") || file.includes("guard-premium-dossier-release.mjs")) return;
  const content = fs.readFileSync(file, "utf8").toLowerCase();
  PROHIBITED_CLAIMS.forEach((claim) => {
    if (content.includes(claim)) {
      violations.push(`Found '${claim}' in ${file}`);
    }
  });
});

if (violations.length > 0) {
  console.error("Compliance violations found:", violations.join("\n"));
  process.exit(1);
}
console.log("Compliance checks: PASS");

// 1.1 Truncation and section checks
console.log("Checking PDF renderer code invariants...");
const pdfRendererPath = path.join(rootDir, "functions", "src", "cbam", "report", "premium-dossier-pdf.ts");
if (fs.existsSync(pdfRendererPath)) {
  const pdfRendererContent = fs.readFileSync(pdfRendererPath, "utf8");
  if (pdfRendererContent.includes("slice(0, 6)") || pdfRendererContent.includes("slice(0,6)")) {
    console.error("FAIL: Renderer contains 'slice(0, 6)' truncation!");
    process.exit(1);
  }
  if (pdfRendererContent.includes("Math.min(lines.length, 6)") || pdfRendererContent.includes("Math.min(lines.length,6)")) {
    console.error("FAIL: Renderer contains line-count truncation 'Math.min(lines.length, 6)'!");
    process.exit(1);
  }
}
console.log("PDF renderer code invariants: PASS");


// 2. Run TypeScript check
if (!runCommand("npm run typecheck")) {
  process.exit(1);
}

// 3. Run functions compilation check
if (!runCommand("npm run build --prefix functions")) {
  process.exit(1);
}

// 4. Run Vitest Premium Dossier & Deliverables tests
if (!runCommand("npx vitest run tests/reports/premium-dossier-v5.test.ts tests/reports/verifier-grade-deliverables.test.ts tests/compliance-guard.test.ts")) {
  process.exit(1);
}

console.log("=== PREMIUM DOSSIER RELEASE GUARD: PASS ===");
process.exit(0);
