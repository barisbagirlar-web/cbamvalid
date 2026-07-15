import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

// Prevent deployment of these prohibited claims
const PROHIBITED_CLAIMS = [
  "eu certified",
  "accredited verification",
  "official eu submission",
  "guaranteed compliance"
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
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

describe("Compliance Guard Regression", () => {
  it("should not contain any prohibited claims in the source code", () => {
    const rootDir = path.resolve(__dirname, "..");
    const files = [
      ...getAllFiles(path.join(rootDir, "lib")),
      ...getAllFiles(path.join(rootDir, "app")),
      ...getAllFiles(path.join(rootDir, "functions", "src")),
    ];

    let foundViolations = false;
    let violationDetails = "";

    files.forEach((file) => {
      // Exclude this test file itself
      if (file.includes("compliance-guard.test.ts")) return;
      
      const content = fs.readFileSync(file, "utf8").toLowerCase();
      PROHIBITED_CLAIMS.forEach((claim) => {
        if (content.includes(claim)) {
          foundViolations = true;
          violationDetails += `\nProhibited claim '${claim}' found in ${file}`;
        }
      });
    });

    if (foundViolations) {
      throw new Error("Compliance violations found: " + violationDetails);
    }
    expect(foundViolations).toBe(false);
  });
});
