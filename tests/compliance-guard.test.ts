import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

import { LEGAL_IDENTITY, getPublicLegalIdentityLines } from "../lib/legal-identity";

const PLACEHOLDER_ADDRESS_TOKENS = [
  "123 validation way",
  "validation way",
  "tech district",
  "sample address",
  "your company address",
  "123 sample st",
  "123 test st",
];

const OWNER_VERIFIED_ADDRESS = "4th Floor, One Burlington Plaza, Burlington Road, Dublin 4, Ireland";

const PROHIBITED_CLAIMS = [
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

const STALE_COMMERCIAL_CLASSIFICATION = [
  "carbon border compliance validation",
  "exporter verification preparation pack",
  "prepared for independent accredited verification",
  "cbam exporter final evidence report",
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes("node_modules") && !fullPath.includes(".next") && !fullPath.includes(".git")) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (/\.(ts|tsx|md|txt|svg)$/.test(fullPath)) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe("Compliance Guard Regression", () => {
  it("should not contain affirmative prohibited claims in renderable source", () => {
    const rootDir = path.resolve(__dirname, "..");
    const files = [
      ...getAllFiles(path.join(rootDir, "lib")),
      ...getAllFiles(path.join(rootDir, "app")),
      ...getAllFiles(path.join(rootDir, "components")),
      ...getAllFiles(path.join(rootDir, "functions", "src")),
    ];

    let violationDetails = "";
    for (const file of files) {
      if (file.includes("compliance-guard.test.ts")) continue;
      const content = fs.readFileSync(file, "utf8").toLowerCase();
      for (const claim of PROHIBITED_CLAIMS) {
        if (content.includes(claim)) {
          violationDetails += `\nProhibited claim '${claim}' found in ${file}`;
        }
      }
    }

    if (violationDetails) throw new Error("Compliance violations found: " + violationDetails);
    expect(violationDetails).toBe("");
  });

  it("allows accurate independent-review boundaries", () => {
    const allowed = [
      "Independent review may be required for the customer's downstream workflow.",
      "The software does not issue an accredited opinion.",
      "Customers manage third-party review independently.",
    ];
    for (const snippet of allowed) {
      const content = snippet.toLowerCase();
      for (const claim of PROHIBITED_CLAIMS) {
        expect(content.includes(claim), `allowed snippet must not match ${claim}: ${snippet}`).toBe(false);
      }
    }
  });

  it("still catches affirmative accredited-verification claims", () => {
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

  it("treats obsolete commercial classification as blocked", () => {
    const publicCommercialFiles = [
      "cbam_logo.svg",
      "public/cbam_logo.svg",
      "public/brand/cbamvalid-lockup.svg",
      "public/llm.txt",
      "public/llms.txt",
      "public/llms-full.txt",
      "lib/billing/pricing-config.ts",
      "lib/product/customer-language.ts",
      "components/marketing/SoftwareProductHome.tsx",
    ];

    for (const relative of publicCommercialFiles) {
      const content = fs.readFileSync(path.resolve(__dirname, "..", relative), "utf8").toLowerCase();
      for (const phrase of STALE_COMMERCIAL_CLASSIFICATION) {
        expect(content, `${relative} must not contain ${phrase}`).not.toContain(phrase);
      }
    }
  });
});

describe("Legal Identity SSOT Regression", () => {
  it("must expose the owner-verified registered address", () => {
    expect(LEGAL_IDENTITY.registeredAddress).toBe(OWNER_VERIFIED_ADDRESS);
  });

  it("must never expose a placeholder or template address", () => {
    const lower = LEGAL_IDENTITY.registeredAddress?.toLowerCase() ?? "";
    for (const token of PLACEHOLDER_ADDRESS_TOKENS) {
      expect(lower.includes(token), `registeredAddress must not contain placeholder token '${token}'`).toBe(false);
    }
  });

  it("must render the owner-verified address on the public identity block", () => {
    const { mode, lines } = getPublicLegalIdentityLines();
    const rendered = lines.join("\n").toLowerCase();
    expect(mode).toBe("full");
    expect(rendered).toContain(OWNER_VERIFIED_ADDRESS.toLowerCase());
    for (const token of PLACEHOLDER_ADDRESS_TOKENS) {
      expect(rendered.includes(token), `public identity block must not contain placeholder token '${token}'`).toBe(false);
    }
  });

  it("must reject a placeholder address as the registered address", () => {
    const placeholders = [
      "123 Validation Way, Tech District, Ireland",
      "123 Test St, Sample City",
      "Your Company Address",
    ];
    for (const placeholder of placeholders) {
      const lower = placeholder.toLowerCase();
      const hit = PLACEHOLDER_ADDRESS_TOKENS.some((token) => lower.includes(token));
      expect(hit, `placeholder must match a forbidden token: ${placeholder}`).toBe(true);
    }
  });
});
