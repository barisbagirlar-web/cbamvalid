import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Public Sample Reports Invariants", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const samplePdfPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.pdf");
  const sampleJsonPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.json");
  const sampleXmlPath = path.join(rootDir, "public/sample/cbam-exporter-final-evidence-report-sample.xml");

  it("Asserts that all three public sample files exist", () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    expect(fs.existsSync(sampleJsonPath)).toBe(true);
    expect(fs.existsSync(sampleXmlPath)).toBe(true);
  });

  it("Validates JSON structure properties and mock watermarks", () => {
    const json = JSON.parse(fs.readFileSync(sampleJsonPath, "utf-8"));
    expect(json.status).toBe("success");
    expect(json.classification).toBe("SAMPLE_REPORT");
    expect(json.legalNotice).toContain("SAMPLE REPORT");
    expect(json.data.exporterName).toBe("Global Steel Exporter Ltd");
    expect(json.data.results.netCertificatesDue).toBeDefined();
  });

  it("Validates XML namespace and integrity attributes", () => {
    const xml = fs.readFileSync(sampleXmlPath, "utf-8");
    expect(xml).toContain("https://cbamvalid.com/schema/exporter-evidence/1.0");
    expect(xml).toContain("CBAMDefinitiveDossier");
    expect(xml).toContain("<ProductionVolume");
  });
});
