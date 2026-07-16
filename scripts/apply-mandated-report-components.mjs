import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const builderPath = path.join(root, "functions/src/cbam/report/verifier-package-builder.ts");
const testPath = path.join(root, "tests/reports/verifier-grade-deliverables.test.ts");
const guardPath = path.join(root, "scripts/guard-verifier-grade-deliverables.mjs");

const required = [
  "24_Executive_Verification_Readiness_Summary.pdf",
  "25_Per_Good_Embedded_Emissions_Schedule.csv",
  "26_Carbon_Price_Paid_Schedule.csv",
  "27_Read_Me_and_Verifier_Navigation_Guide.pdf",
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`MANDATE_FILE_MISSING:${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function replaceOnce(source, search, replacement, label) {
  const occurrences = source.split(search).length - 1;
  if (occurrences === 0) {
    if (source.includes(replacement)) return source;
    throw new Error(`MANDATE_MARKER_MISSING:${label}`);
  }
  if (occurrences !== 1) throw new Error(`MANDATE_MARKER_AMBIGUOUS:${label}:${occurrences}`);
  return source.replace(search, replacement);
}

let builder = read(builderPath);

builder = replaceOnce(
  builder,
  'pdfFile("Operator Summary Statement.pdf", "Operator Summary Statement", "Executive control statement for the sealed verifier-preparation package", [',
  'pdfFile("24_Executive_Verification_Readiness_Summary.pdf", "Executive Verification Readiness Summary", "Executive readiness decision and independent-verifier handoff for the sealed package", [',
  "executive-readiness-pdf"
);
builder = builder.replaceAll('"Operator Summary Statement.pdf"', '"24_Executive_Verification_Readiness_Summary.pdf"');
builder = builder.replaceAll('"Activity Data Ledger.csv"', '"25_Per_Good_Embedded_Emissions_Schedule.csv"');
builder = builder.replaceAll('"Carbon Price Register.csv"', '"26_Carbon_Price_Paid_Schedule.csv"');

if (!builder.includes('"27_Read_Me_and_Verifier_Navigation_Guide.pdf"')) {
  const lines = builder.split("\n");
  const index = lines.findIndex((line) => line.includes('artifact("O3CI Field Mapping.csv"'));
  if (index < 0) throw new Error("MANDATE_MARKER_MISSING:navigation-guide-source");
  lines.splice(index, 1, `    artifact(
      "27_Read_Me_and_Verifier_Navigation_Guide.pdf",
      buildProfessionalPdf({
        title: "Read Me and Verifier Navigation Guide",
        subtitle: "Controlled review sequence, trust verification and independent-verifier handoff",
        model,
        sections: [
          {
            heading: "Start Here",
            paragraphs: [
              "Open this guide first. Review the executive readiness summary, then the operator emissions report, verifier workspace, evidence index and calculation trace before reaching any independent conclusion.",
              "CBAMValid performs automated preparation controls only. Independent accredited verification remains outside the software boundary and is recorded as NOT_REVIEWED until completed by the appointed verifier."
            ]
          },
          {
            heading: "Recommended Review Order",
            table: {
              headers: ["Order", "Component", "Purpose"],
              widths: [12, 72, 96],
              rows: [
                [1, "24 Executive Verification Readiness Summary", "Executive blockers, automated readiness and verifier handoff"],
                [2, "Operator Emissions Report", "Declared scope, totals, intensity, materiality and limitations"],
                [3, "Verifier Workspace", "Controlled review sheets, sign-off fields and challenge notes"],
                [4, "25 Per-Good Embedded Emissions Schedule", "Per-CN-code production, allocation and embedded-emissions reconciliation"],
                [5, "26 Carbon Price Paid Schedule", "Eligible carbon-price records and supporting evidence links"],
                [6, "Evidence Index and Supporting Evidence", "Hash-linked source documents and coverage"],
                [7, "Calculation Trace and Data Integrity Manifest", "Formula lineage, file hashes and trust-chain verification"]
              ]
            }
          },
          {
            heading: "Trust Verification",
            paragraphs: [
              "Recompute SHA-256 for every file listed in Data Integrity Manifest.json, verify Manifest Signature.sig against the embedded public key and confirm the package hash shown in the sealed report record.",
              "Any missing file, hash mismatch, signature failure, altered evidence object or inconsistent release sequence is a hard stop and must not be silently accepted."
            ]
          },
          {
            heading: "Independent Verifier Boundary",
            callout: {
              label: "Status",
              value: model.independentVerifierStatus
            },
            paragraphs: [model.disclaimer]
          }
        ]
      }),
      "application/pdf"
    ),`);
  builder = lines.join("\n").replaceAll('"O3CI Field Mapping.csv"', '"27_Read_Me_and_Verifier_Navigation_Guide.pdf"');
}

for (const name of required) {
  if (!builder.includes(`"${name}"`)) throw new Error(`MANDATE_COMPONENT_NOT_EMITTED:${name}`);
}
for (const legacy of [
  "Operator Summary Statement.pdf",
  "Activity Data Ledger.csv",
  "Carbon Price Register.csv",
  "O3CI Field Mapping.csv",
]) {
  if (builder.includes(legacy)) throw new Error(`MANDATE_LEGACY_COMPONENT_REMAINS:${legacy}`);
}
write(builderPath, builder);

let tests = read(testPath);
tests = replaceOnce(tests, "expect(pdfArtifacts).toHaveLength(11);", "expect(pdfArtifacts).toHaveLength(12);", "pdf-count");
const componentAnchor = "expect(topLevel(artifacts.map((item) => item.path))).toHaveLength(25);";
const componentAssertions = `${componentAnchor}\n    for (const requiredComponent of ${JSON.stringify(required)}) {\n      expect(artifacts.some((item) => item.path === requiredComponent)).toBe(true);\n    }`;
if (!tests.includes(required[0])) {
  tests = replaceOnce(tests, componentAnchor, componentAssertions, "mandated-component-test");
}
const navigationAnchor = 'const operator = artifacts.find((item) => item.path === "Operator Emissions Report.pdf");';
const navigationAssertions = `const navigationGuide = artifacts.find((item) => item.path === "27_Read_Me_and_Verifier_Navigation_Guide.pdf");\n    expect(navigationGuide).toBeDefined();\n    const navigationPdf = await pdfText(navigationGuide!.bytes);\n    expect(navigationPdf.text).toContain("Recommended Review Order");\n    expect(navigationPdf.text).toContain("Trust Verification");\n    expect(navigationPdf.text).toContain("NOT_REVIEWED");\n\n    ${navigationAnchor}`;
if (!tests.includes("const navigationGuide =")) {
  tests = replaceOnce(tests, navigationAnchor, navigationAssertions, "navigation-pdf-test");
}
write(testPath, tests);

let guard = read(guardPath);
const guardAnchor = "if (requiredComponents.length !== 27) failures.push(`Verifier package must define exactly 27 top-level components; found ${requiredComponents.length}`);";
const guardBlock = `${guardAnchor}\nfor (const requiredComponent of ${JSON.stringify(required)}) {\n  requireText(packageBuilder, requiredComponent, "Mandated verifier package component");\n}\nfor (const legacyComponent of ${JSON.stringify([
  "Operator Summary Statement.pdf",
  "Activity Data Ledger.csv",
  "Carbon Price Register.csv",
  "O3CI Field Mapping.csv",
])}) {\n  rejectText(packageBuilder, legacyComponent, "Legacy package component");\n}`;
if (!guard.includes(required[0])) {
  guard = replaceOnce(guard, guardAnchor, guardBlock, "mandated-component-guard");
}
write(guardPath, guard);

console.log("MANDATED_REPORT_COMPONENTS_APPLIED=PASS");
for (const component of required) console.log(`COMPONENT=${component}`);
