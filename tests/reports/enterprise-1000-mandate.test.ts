import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import {
  assessEvidenceVerifiability,
  deriveEnterprise1000Model,
  upgradeArtifactsToEnterprise1000,
} from "../../functions/src/cbam/report/enterprise-1000-value-layer";
import { buildUnsignedVerifierArtifacts } from "../../functions/src/cbam/report/verifier-package-builder";
import {
  REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
  REQUIRED_TOP_LEVEL_COMPONENTS_V5,
} from "../../functions/src/cbam/report/package-components";
import {
  FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
} from "../fixtures/four-dossiers";

const REAL_GENERATED_AT_DURING_OPEN_2026_PERIOD = "2026-08-08T12:00:00.000Z";

async function steelFixture() {
  const rawCase = createFourDossierCase("STEEL_IN");
  const evidenceFiles = await buildFourDossierEvidenceFiles(rawCase);
  const caseData = AuditReadyCaseSchema.parse(rawCase);
  const calculation = performDossierCalculations(caseData);
  const controls = runQualityControls(caseData);
  return { caseData, evidenceFiles, calculation, controls };
}

describe("Enterprise 1,000 USD verifier-ready mandate", () => {
  it("uses one status vocabulary and reduces readiness when the annual period is still open", async () => {
    const { caseData, calculation } = await steelFixture();
    const model = deriveEnterprise1000Model({
      caseData,
      calculation,
      generatedAt: REAL_GENERATED_AT_DURING_OPEN_2026_PERIOD,
    });

    expect(["READY_FOR_VERIFICATION", "CONDITIONAL", "NOT_READY"]).toContain(model.status);
    expect(model.status).toBe("NOT_READY");
    expect(Number(model.preparationScore)).toBeLessThan(100);
    expect(model.reportingPeriod.definitiveAnnualEligible).toBe(false);
    expect(model.statusReasons.join(" ")).toContain("Reporting period is not definitively eligible");
  });

  it("produces deterministic premium scenario, materiality and seven-item handover layers", async () => {
    const { caseData, calculation } = await steelFixture();
    const model = deriveEnterprise1000Model({
      caseData,
      calculation,
      generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    });

    expect(model.status).toBe("READY_FOR_VERIFICATION");
    expect(model.scenarios.map((row) => row.scenarioId)).toEqual([
      "GRID_MINUS_10",
      "BASE",
      "GRID_PLUS_10",
      "PRODUCTION_MINUS_10",
      "PRODUCTION_PLUS_10",
    ]);
    expect(model.materialitySimulation).toHaveLength(caseData.goods.length);
    for (const row of model.materialitySimulation) {
      expect(row.planningThresholdRate).toBe("5");
      expect(Number(row.gridFactorThresholdUtilizationPercent)).toBeGreaterThanOrEqual(0);
      expect(Number(row.productionThresholdUtilizationPercent)).toBeGreaterThanOrEqual(0);
      expect(["BELOW_PLANNING_THRESHOLD", "NEAR_PLANNING_THRESHOLD", "ABOVE_PLANNING_THRESHOLD"]).toContain(row.proximityState);
    }
    expect(model.handoverDrafts).toHaveLength(7);
    expect(model.handoverDrafts.every((draft) => draft.preparedText.trim().length > 40)).toBe(true);
    expect(model.openQuestions.length).toBeGreaterThan(0);
    expect(model.closureConditions.length).toBeGreaterThan(0);
  });

  it("separates A-E evidence quality from independently auditable verifiability", async () => {
    const { caseData } = await steelFixture();
    const strongest = caseData.evidenceRegister.find(
      (record) => Boolean(record.officialReference || record.accreditationReference)
    );
    expect(strongest).toBeDefined();
    const strong = assessEvidenceVerifiability(strongest!);
    expect(strong.metadataIntegrity).toBe("PASS");
    expect(["INDEPENDENTLY_VERIFIABLE", "STRUCTURALLY_VERIFIABLE"]).toContain(strong.verifiabilityState);
    expect(strong.verifiabilityBasis).toContain("SHA256=CHECKED");

    const weak = assessEvidenceVerifiability({
      ...strongest!,
      issuerCategory: undefined,
      documentAuthority: undefined,
      officialReference: undefined,
      accreditationReference: undefined,
      qualityGrade: "PENDING",
      qualityAssessedBy: undefined,
      qualityAssessedAt: undefined,
    });
    expect(weak.verifiabilityState).toBe("WEAK");
    expect(weak.warning).toContain("WEAK_OR_INCOMPLETE_EVIDENCE");
  });

  it("replaces every legacy human PDF with 11 distinct decision/workpaper documents and closure-complete registers", async () => {
    const { caseData, evidenceFiles, calculation, controls } = await steelFixture();
    const reportId = `report_${"a".repeat(64)}`;
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      calculation,
      controls,
      reportId,
      packageCode: "E1000",
      releaseVersion: 1,
      generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      evidenceFiles,
      assessmentContext: {
        generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
        assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
        reportId,
        packageCode: "E1000",
        releaseVersion: 1,
        rulesetVersion: calculation.ruleset,
        productCode: "pack_premium_dossier_v5",
        releaseContractVersion: 5,
      },
    });

    const upgraded = upgradeArtifactsToEnterprise1000({
      artifacts: artifacts.filter((item) => !item.path.toLowerCase().endsWith(".pdf")),
      caseData,
      calculation,
      controls,
      reportId,
      packageCode: "E1000",
      releaseVersion: 1,
      generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    });

    const pdfs = upgraded.artifacts.filter((item) => item.path.endsWith(".pdf"));
    expect(pdfs).toHaveLength(11);
    expect(pdfs.some((item) => item.path === "Complete Dossier Compilation.pdf")).toBe(false);
    expect(pdfs.some((item) => item.path === "Verifier First Meeting & Handover Pack.pdf")).toBe(true);
    const pdfHashes = pdfs.map((item) => createHash("sha256").update(item.bytes).digest("hex"));
    expect(new Set(pdfHashes).size).toBe(11);
    expect(pdfs.every((item) => item.bytes.byteLength > 5000)).toBe(true);

    const evidenceCsv = upgraded.artifacts.find((item) => item.path === "Evidence Register.csv")?.bytes.toString("utf8") || "";
    expect(evidenceCsv).toContain("Independent verifiability");
    expect(evidenceCsv).toContain("Verifiability basis");
    expect(evidenceCsv).toContain("Automatic warning");

    const actionCsv = upgraded.artifacts.find((item) => item.path === "Corrective Action Log.csv")?.bytes.toString("utf8") || "";
    for (const heading of ["Action", "Priority", "Responsible role", "State", "Closure condition"]) {
      expect(actionCsv).toContain(heading);
    }

    const trace = JSON.parse(upgraded.artifacts.find((item) => item.path === "Calculation Trace.json")!.bytes.toString("utf8"));
    expect(trace.enterpriseReadiness.status).toBe("READY_FOR_VERIFICATION");
    expect(trace.verifierModel).toBeUndefined();
    expect(trace.calculation.calculationRootHash).toBe(calculation.calculationRootHash);
  });

  it("keeps the external package contract at 26 while preserving the stable historical download path", () => {
    expect(REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5).toBe(26);
    expect(REQUIRED_TOP_LEVEL_COMPONENTS_V5).toHaveLength(26);
    expect(REQUIRED_TOP_LEVEL_COMPONENTS_V5).toContain("Complete Dossier Compilation.pdf");
    expect(REQUIRED_TOP_LEVEL_COMPONENTS_V5).not.toContain("Verifier First Meeting & Handover Pack.pdf");
  });
});
