import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { buildVerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import { buildVerifierWorkbook } from "../../functions/src/cbam/report/xlsx-builder";
import {
  assertCarbonPriceSemantics,
  assertCalculationConsistency,
  assertEvidenceChronology,
  buildCanonicalCalculationGraph,
  hardenVerifierWorkbook,
  prepareCaseForVerifierArtifacts,
} from "../../functions/src/cbam/report/premium-package-hardening";
import {
  FIXTURE_GENERATED_AT,
  FIXTURE_PACKAGE_CODE,
  FIXTURE_REPORT_ID,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";

function buildFixture() {
  const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  const calculation = performDossierCalculations(caseData);
  const controls = runQualityControls(caseData);
  return { caseData, calculation, controls };
}

describe("premium package verifier-grade hardening", () => {
  it("derives Calculation Graph from the canonical Calculation Trace", () => {
    const { calculation } = buildFixture();
    const graph = buildCanonicalCalculationGraph(calculation);

    expect(graph.rootHash).toBe(calculation.calculationRootHash);
    expect(graph.nodes).toHaveLength(calculation.trace.length);

    for (const trace of calculation.trace) {
      const node = graph.nodes.find((item) => item.id === trace.formulaId);
      expect(node, trace.formulaId).toBeTruthy();
      expect(node?.value.toString()).toBe(trace.outputValue);
      expect(node?.unit).toBe(trace.outputUnit);
      expect(node?.hash).toBe(trace.calculationHash);
    }
  });

  it("blocks future-dated evidence before a package can be signed", () => {
    const { caseData } = buildFixture();
    caseData.evidenceRegister[0]!.issueDate = "2028-01-01";
    expect(() => assertEvidenceChronology(caseData, FIXTURE_GENERATED_AT)).toThrow(
      /PREMIUM_PACKAGE_FUTURE_EVIDENCE_TIMESTAMP/
    );
  });

  it("blocks monetary carbon-price amounts being relabelled as certificate-equivalent reductions", () => {
    const { caseData } = buildFixture();
    caseData.carbonPriceRecords[0]!.applicableEmissions = "10";
    caseData.carbonPriceRecords[0]!.eligibleCertificateReduction = "1200";
    const calculation = performDossierCalculations(caseData);
    expect(() => assertCarbonPriceSemantics(caseData, calculation)).toThrow(
      /PREMIUM_PACKAGE_CARBON_PRICE_UNIT_MISMATCH/
    );
  });

  it("fails closed when canonical calculation totals are cross-artifact inconsistent", () => {
    const { calculation } = buildFixture();
    const corrupted = JSON.parse(JSON.stringify(calculation));
    corrupted.totalDirectEmissions = String(Number(corrupted.totalDirectEmissions) + 1);
    expect(() => assertCalculationConsistency(corrupted)).toThrow(
      /PREMIUM_PACKAGE_TOTAL_DIRECT_MISMATCH/
    );
  });

  it("materialises evidence-to-calculation lineage without mutating operator source data", () => {
    const { caseData, calculation } = buildFixture();
    const original = JSON.stringify(caseData);
    const prepared = prepareCaseForVerifierArtifacts(caseData, calculation);

    expect(JSON.stringify(caseData)).toBe(original);
    expect(
      prepared.evidenceRegister.some((item) => item.linkedCalculations.length > 0)
    ).toBe(true);
    const directEvidence = prepared.evidenceRegister.find((item) =>
      item.linkedInputs.includes("directEmissions")
    );
    expect(directEvidence?.linkedCalculations).toContain("CBAM_INSTALLATION_DIRECT_EMISSIONS");
  });

  it("adds a formula-driven verifier recomputation sheet to the workspace", async () => {
    const { caseData, calculation, controls } = buildFixture();
    const prepared = prepareCaseForVerifierArtifacts(caseData, calculation);
    const model = buildVerifierPackageModel({
      caseData: prepared,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      assessmentTimestamp: FIXTURE_GENERATED_AT,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    });
    const base = await buildVerifierWorkbook({
      caseData: prepared,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 1,
      generatedAt: FIXTURE_GENERATED_AT,
      model,
    });
    const hardened = await hardenVerifierWorkbook(base, calculation);
    const zip = await JSZip.loadAsync(hardened, { checkCRC32: true });
    const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
    expect(workbookXml).toContain('name="Verifier Recompute"');

    const sheetEntry = Object.keys(zip.files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/sheet(\d+)/)?.[1]) - Number(b.match(/sheet(\d+)/)?.[1]))
      .at(-1)!;
    const sheetXml = await zip.file(sheetEntry)!.async("string");
    expect(sheetXml).toContain("RECOMPUTATION CONTROL");
    expect(sheetXml).toContain("<f>B4*B5</f>");
    expect(sheetXml).toContain("Certificate-relevant priced emissions");
    expect(sheetXml).toContain("PASS");
  });
});
