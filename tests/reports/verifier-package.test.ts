import { describe, expect, it } from "vitest";
import { buildVerifierPreparationPackage, REQUIRED_TOP_LEVEL_COMPONENTS, verifyVerifierPreparationPackage } from "../../functions/src/cbam/report/verifier-package-builder";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";

function input(value: string, unit?: string, evidenceId?: string) {
  return {
    value,
    canonicalUnit: unit,
    sourceType: evidenceId ? "PRIMARY" as const : "DEFAULT" as const,
    confidenceStatus: evidenceId ? "HIGH_VERIFIED" as const : "DEFAULT_ASSIGNED" as const,
    evidenceId,
  };
}

function fixture(): AuditReadyCase {
  const evidenceId = "d81bb1d1-7f34-4ec9-a168-0cbe184cb037";
  return {
    caseId: "case_fixture_001",
    status: "VERIFICATION_READY",
    version: 1,
    ownerId: "user_fixture_001",
    importerIdentity: {
      legalName: input("Example EU Importer"),
      eoriNumber: input("DE12345678901234", undefined, evidenceId),
    },
    exporterIdentity: { legalName: input("Example Exporter") },
    reportingPeriod: { year: input("2026"), quarter: input("Annual") },
    goods: [{
      cnCode: input("72081000", undefined, evidenceId),
      sector: "IRON_AND_STEEL",
      productionVolume: input("100", "t", evidenceId),
      shipmentRecords: input("100", "t", evidenceId),
    }],
    installation: {
      name: input("Example Mill"),
      country: input("TR"),
      productionRoute: input("Electric arc furnace"),
      systemBoundaries: "Melting, casting and rolling",
    },
    directEmissions: input("40", "tCO2e", evidenceId),
    electricityConsumed: input("100", "MWh", evidenceId),
    gridEmissionFactor: input("0.4", "tCO2e/MWh", evidenceId),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [{
      evidenceId,
      documentType: "UTILITY_INVOICE",
      fileName: "invoice.pdf",
      storagePath: `evidence/user_fixture_001/case_fixture_001/${evidenceId}/invoice.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 19,
      issuer: "Example Utility",
      issueDate: "2026-12-31",
      reportingPeriod: "2026",
      fileHash: "e775744da9af6520849c0c1ed66948f60ff137cb8df0db89f7e2a2530ce3cecd",
      uploadTimestamp: "2026-12-31T00:00:00.000Z",
      uploader: "user_fixture_001",
      reviewStatus: "APPROVED",
      supportStatus: "SUPPORTED",
      confidentiality: "CONFIDENTIAL",
      linkedInputs: ["directEmissions"],
      linkedCalculations: [],
    }],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: [],
  };
}

describe("verifier preparation package", () => {
  it("generates and verifies all 23 top-level components", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);
    const evidence = Buffer.from("fixture-pdf-content");

    const result = await buildVerifierPreparationPackage({
      releaseId: "rel_fixture_001",
      caseData,
      calculation,
      qualityControls: [{ ruleId: "QC_FIXTURE", name: "Fixture", status: "PASS" }],
      evidenceFiles: [{
        evidenceId: caseData.evidenceRegister[0].evidenceId,
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        sourceHash: caseData.evidenceRegister[0].fileHash,
        buffer: evidence,
      }],
    });

    const verified = await verifyVerifierPreparationPackage(result.zipBuffer);
    expect(REQUIRED_TOP_LEVEL_COMPONENTS).toHaveLength(23);
    expect(verified.topLevelComponentCount).toBe(23);
    expect(verified.manifestHash).toBe(result.manifestHash);
    expect(verified.verifiedFileCount).toBe(result.manifest.files.length);
    expect(result.manifest.files.some((file) => file.filename.startsWith("23_Supporting_Evidence/"))).toBe(true);
  });

  it("rejects an evidence file whose bytes do not match the registered hash", async () => {
    const caseData = fixture();
    const calculation = performDossierCalculations(caseData);

    await expect(buildVerifierPreparationPackage({
      releaseId: "rel_fixture_002",
      caseData,
      calculation,
      qualityControls: [{ ruleId: "QC_FIXTURE", name: "Fixture", status: "PASS" }],
      evidenceFiles: [{
        evidenceId: caseData.evidenceRegister[0].evidenceId,
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        sourceHash: caseData.evidenceRegister[0].fileHash,
        buffer: Buffer.from("tampered"),
      }],
    })).rejects.toThrow("VERIFIER_PACKAGE_EVIDENCE_HASH_MISMATCH");
  });
});
