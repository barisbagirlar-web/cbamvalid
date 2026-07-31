import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

// Prevent deployment of affirmative claims that the product performs
// accredited verification or guarantees EU compliance. The bare phrase
// "accredited verification" is the canonical positioning ("Prepared for
// Independent Accredited Verification") and the mandatory fail-closed
// disclaimers ("Not an accredited verification opinion"), so the scan targets
// affirmative capability claims only.
const PROHIBITED_CLAIMS = [
  // Affirmative accredited-verification capability claims.
  "provides accredited verification",
  "provide accredited verification",
  "performs accredited verification",
  "perform accredited verification",
  "offers accredited verification",
  "offer accredited verification",
  "we are an accredited verifier",
  "we're an accredited verifier",
  "our accredited verification",
  "accredited verification service",
  "accredited verification provider",
  // Affirmative EU-compliance claims.
  "we are eu certified",
  "we're eu certified",
  "eu certified company",
  "eu certified software",
  "eu certified service",
  "eu certified platform",
  "eu certified product",
  "eu certified tool",
  "eu certified solution",
  "official eu submission",
  "guaranteed compliance",
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

  it("must not flag the canonical positioning or the mandatory fail-closed disclaimers", () => {
    const allowed = [
      "CBAMValid Exporter Verification Preparation Pack — Prepared for Independent Accredited Verification",
      "Not an accredited verification opinion.",
      "without pretending the software issued an accredited verification opinion",
      "Prepared for independent accredited verification",
    ];
    for (const snippet of allowed) {
      const content = snippet.toLowerCase();
      for (const claim of PROHIBITED_CLAIMS) {
        expect(content.includes(claim), `allowed snippet must not match ${claim}: ${snippet}`).toBe(false);
      }
    }
  });

  it("must still catch affirmative claims of performing accredited verification", () => {
    const blocked = [
      "We provide accredited verification for importers.",
      "The software performs accredited verification of emissions.",
      "Choose our accredited verification service today.",
      "We are an accredited verifier for CBAM.",
    ];
    for (const snippet of blocked) {
      const content = snippet.toLowerCase();
      const hit = PROHIBITED_CLAIMS.some((claim) => content.includes(claim));
      expect(hit, `blocked snippet must match a prohibited claim: ${snippet}`).toBe(true);
    }
  });
});
