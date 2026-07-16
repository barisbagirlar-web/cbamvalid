import fs from "fs";
import path from "path";
import crypto from "crypto";
import { orchestrateCalculation } from "../lib/cbam/engine/calculation-orchestrator.ts";
import { buildPdfDossier } from "../functions/src/cbam/report/pdf-builder.ts";
import { buildXml, buildOfficialRegistryXml } from "../functions/src/cbam/report/xml-builder.ts";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, "..");

const fixturePath = path.join(rootDir, "tests/fixtures/cbam/sample-steel-exporter.fixture.json");
const publicSampleDir = path.join(rootDir, "public/sample");

if (!fs.existsSync(publicSampleDir)) {
  fs.mkdirSync(publicSampleDir, { recursive: true });
}

// 1. Read the golden fixture
const fixtureRaw = fs.readFileSync(fixturePath, "utf-8");
const fixture = JSON.parse(fixtureRaw);

// 2. Perform orchestrateCalculation
const calc = orchestrateCalculation(fixture);

// 3. Calculate deterministic SHA-256 seal hash based on report body payload
const manifestContent = JSON.stringify({
  declarantEORI: fixture.declarantEORI,
  installationName: fixture.installationName,
  totalEmbeddedEmissions: calc.totalEmbeddedEmissions,
  netCertificatesDue: calc.netCertificatesDue,
  datasetVersion: calc.pricing.datasetVersion,
});
const docHash = crypto.createHash("sha256").update(manifestContent).digest("hex");

// 4. Generate & Save PDF
const pdfBuffer = buildPdfDossier(fixture, calc, docHash, true);
fs.writeFileSync(path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample.pdf"), pdfBuffer);

// 5. Generate & Save JSON
const jsonOutput = {
  status: "success",
  classification: "SAMPLE_REPORT",
  legalNotice: "SAMPLE REPORT - Fictional demonstration data - Not valid for regulatory use",
  documentHash: docHash,
  data: {
    exporterName: fixture.exporterName,
    declarantEORI: fixture.declarantEORI,
    importYear: fixture.importYear,
    importQuarter: fixture.importQuarter,
    role: fixture.role,
    installation: {
      name: fixture.installationName,
      cnCode: fixture.cnCode,
      productionVolume: fixture.productionVolume,
      isComplexGood: fixture.isComplexGood,
    },
    emissions: {
      directEmissions: fixture.directEmissions,
      electricityConsumed: fixture.electricityConsumed,
      gridEmissionFactor: fixture.gridEmissionFactor,
      precursorDirectEmissions: fixture.precursorDirectEmissions,
      precursorIndirectEmissions: fixture.precursorIndirectEmissions,
    },
    results: {
      totalEmbeddedEmissions: calc.totalEmbeddedEmissions,
      specificDirectEmissions: calc.specificDirectEmissions,
      specificIndirectEmissions: calc.specificIndirectEmissions,
      freeAllocationAdjustment: calc.freeAllocationAdjustment,
      carbonPriceDeduction: calc.carbonPriceDeduction,
      netCertificatesDue: calc.netCertificatesDue,
      estimatedCertificateCostEur: calc.estimatedCertificateCostEur,
    },
    traces: calc.traces || {},
  },
};
fs.writeFileSync(
  path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample.json"),
  JSON.stringify(jsonOutput, null, 2)
);

// 6. Generate & Save XML
const xmlString = buildXml(fixture, calc, docHash);
fs.writeFileSync(path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample.xml"), xmlString);

const officialXmlString = buildOfficialRegistryXml(fixture, calc, docHash);
fs.writeFileSync(path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample-eu.xml"), officialXmlString);

// 7. Generate & Save Manifest
const manifestData = {
  name: "cbam-exporter-final-evidence-report-sample",
  version: "1.0",
  files: [
    {
      name: "cbam-exporter-final-evidence-report-sample.pdf",
      sha256: crypto.createHash("sha256").update(pdfBuffer).digest("hex")
    },
    {
      name: "cbam-exporter-final-evidence-report-sample.json",
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample.json"))).digest("hex")
    },
    {
      name: "cbam-exporter-final-evidence-report-sample.xml",
      sha256: crypto.createHash("sha256").update(xmlString).digest("hex")
    },
    {
      name: "cbam-exporter-final-evidence-report-sample-eu.xml",
      sha256: crypto.createHash("sha256").update(officialXmlString).digest("hex")
    }
  ]
};
fs.writeFileSync(
  path.join(publicSampleDir, "cbam-exporter-final-evidence-report-sample-manifest.json"),
  JSON.stringify(manifestData, null, 2)
);

console.log("[SAMPLE-GEN] Public sample reports and manifest successfully generated and verified.");
