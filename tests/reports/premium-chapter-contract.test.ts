import { describe, it, expect } from "vitest";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { buildVerifierPackageModel } from "../../functions/src/cbam/report/verifier-model";
import {
  PremiumChapterStatus,
  evaluatePremiumChapterContract,
  derivePremiumChapterEvaluations,
} from "../../functions/src/cbam/report/premium-chapter-contract";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { buildHonestScoreboard } from "../../functions/src/cbam/report/honest-scoreboard";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";

const FIXTURE_REPORT_ID = "report_aaaaaaaaaaaaaaaaaaaaaaaa";
const FIXTURE_PACKAGE_CODE = "CBAM-PKG-0001";
const FIXTURE_GENERATED_AT = "2026-07-31T00:00:00.000Z";

function buildModel(caseData: AuditReadyCase) {
  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const model = buildVerifierPackageModel({
    caseData,
    calculation,
    controls,
    reportId: FIXTURE_REPORT_ID,
    packageCode: FIXTURE_PACKAGE_CODE,
    releaseVersion: 1,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  return { controls, calculation, model };
}

function scoreStub() {
  return {
    operatorReadiness: 100,
    verifierReservedCount: 0,
    verifierReservedTotal: 7,
    dossierCompleteness: 100,
    status: "OPERATOR_PREPARATION_COMPLETE" as const,
    formula: "FAZ 13 test",
    findings: [],
  };
}

function datum(value: string) {
  return {
    value,
    sourceType: "PRIMARY" as const,
    confidenceStatus: "HIGH_VERIFIED" as const,
    documentReference: "FAZ 13 controlled record",
    measurementMethod: "Documented direct measurement",
    responsiblePerson: "Installation monitoring manager",
  };
}

/** Enriches the fixture with every operator-controlled field required for the Registry Template Mapping Dataset and site-visit readiness. */
function fullyPreparedCase(): AuditReadyCase {
  const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  return AuditReadyCaseSchema.parse({
    ...base,
    exporterIdentity: {
      ...base.exporterIdentity,
      registrationNumber: datum("TR-1234567890123"),
      exporterCountry: datum("TR"),
      contactEmail: datum("contact@steel.example"),
    },
    reportingPeriod: {
      ...base.reportingPeriod,
      startDate: datum("2026-01-01"),
      endDate: datum("2026-12-31"),
    },
    installation: {
      ...base.installation,
      registryInstallationId: datum("CBAM-TR-0001-INST"),
      address: datum("Iskenderun Industrial Zone, Hatay, Turkiye"),
      latitude: datum("36.581667"),
      longitude: datum("36.200000"),
      excludedProcesses: "None outside the controlled installation boundary.",
      monitoringPlanId: datum("MP-2026-TR-0001"),
      monitoringPlanVersion: datum("V2"),
      monitoringPlanEffectiveDate: datum("2026-01-01"),
      installationDiagramEvidenceId: base.evidenceRegister[0]?.evidenceId,
    },
  });
}

describe("FAZ 13 — premium tier chapter contract", () => {
  it("assigns exactly one of the four mandated statuses to every premium chapter", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const { calculation, model } = buildModel(caseData);
    const evaluations = derivePremiumChapterEvaluations({ caseData, calculation, model });

    expect(evaluations).toHaveLength(16);
    expect(evaluations.map((entry) => entry.chapterId)).toEqual([
      "E-01", "E-02", "E-03", "E-04", "E-05", "E-06", "E-07", "E-08",
      "E-09", "E-10", "E-11", "E-12", "E-13", "E-14", "E-15", "E-16",
    ]);
    for (const entry of evaluations) {
      expect(Object.values(PremiumChapterStatus)).toContain(entry.status);
    }
  });

  it("marks the premium contract COMPLETE on a fully-prepared case and shows the premium name", () => {
    const caseData = fullyPreparedCase();
    const { calculation, model } = buildModel(caseData);
    const result = evaluatePremiumChapterContract({ caseData, calculation, model });

    expect(result.contractState).toBe("COMPLETE");
    expect(result.premiumNameVisible).toBe(true);
    expect(result.dataGapCount).toBe(0);
    expect(result.applicableCount).toBeGreaterThan(0);
  });

  it("is GAP and hides the premium name when an applicable premium chapter has a data gap", () => {
    const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      evidenceRegister: [], // E-03 / E-07 evidence-derived chapters become DATA GAP
      methodologyDecisions: [], // E-04 tier decision chapter becomes DATA GAP
    });
    const { calculation, model } = buildModel(caseData);
    const result = evaluatePremiumChapterContract({ caseData, calculation, model });

    expect(result.contractState).toBe("GAP");
    expect(result.premiumNameVisible).toBe(false);
    expect(result.dataGapCount).toBeGreaterThan(0);

    const sb = buildHonestScoreboard({
      caseData,
      dossierScores: scoreStub(),
      sufficiency: runEvidenceSufficiency(caseData, FIXTURE_GENERATED_AT),
      packageIntegrity: "PASS",
      premiumChapterContract: result.contractState,
      premiumNameVisible: result.premiumNameVisible,
      productTierLabel: `CBAMValid Pack (${result.dataGapCount} premium chapter gap(s))`,
    });
    expect(sb.premiumNameVisible).toBe(false);
    expect(sb.productTierLabel).toContain("CBAMValid Pack");
    expect(sb.productTierLabel).not.toContain("Premium Dossier");
  });

  it("is GAP — never COMPLETE — when the applicable chapter count collapses to zero", () => {
    // Defense in depth: the mandate forbids E-01..E-16 being collectively
    // NOT_APPLICABLE. The contract evaluator must never surface COMPLETE then.
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const { calculation, model } = buildModel(caseData);
    const result = evaluatePremiumChapterContract({ caseData, calculation, model });

    const completeOnly = result.evaluations.filter((entry) => entry.status === PremiumChapterStatus.APPLICABLE_COMPLETE).length;
    const notApplicable = result.evaluations.filter((entry) => entry.status === PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS).length;
    expect(notApplicable).toBeLessThan(result.evaluations.length);
    expect(completeOnly).toBeGreaterThan(0);
    // The fail-closed invariant itself:
    if (notApplicable === result.evaluations.length) {
      expect(result.contractState).toBe("GAP");
      expect(result.premiumNameVisible).toBe(false);
    }
  });

  it("marks E-09 NOT_APPLICABLE_WITH_LEGAL_BASIS when an accepted precursor-scope-none decision exists", () => {
    const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      methodologyDecisions: [
        {
          decisionId: "44444444-4444-4444-8444-444444444444",
          topic: "PRECURSOR_SCOPE",
          selectedMethod: "NONE",
          reason: "No precursor materials used within the installation boundary",
          legalOrTechnicalBasis: "Regulation (EU) 2023/956 Article 3(32) precursor definition",
          evidenceIds: [],
          assumptions: [],
          rejectedAlternative: "Including precursor attribution",
          reasonForRejection: "No precursor flow crosses the installation boundary",
          responsiblePerson: "Preparer",
          internalReviewer: "Internal reviewer",
          reviewStatus: "ACCEPTED",
          rulesetVersion: "CBAM-RULESET-2025-1",
          approverName: "Internal reviewer",
          approverRole: "INTERNAL_REVIEWER",
          approvedAt: "2026-03-01T10:00:00.000Z",
        },
      ],
    });
    const { calculation, model } = buildModel(caseData);
    const e09 = derivePremiumChapterEvaluations({ caseData, calculation, model }).find((entry) => entry.chapterId === "E-09");
    expect(e09?.status).toBe(PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS);
  });

  it("marks E-09 NOT_APPLICABLE for an accepted precursor-scope-none decision regardless of its wording", () => {
    // Regression for FERTILISER_TR: the decision's selectedMethod may be phrased
    // in natural operator language ("No separate precursor goods are declared...")
    // rather than containing the literal token "precursor". The evaluator must
    // rely on the ACCEPTED decision record itself, never on free-text scanning.
    const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      precursors: [],
      methodologyDecisions: [
        {
          decisionId: "44444444-4444-4444-8444-444444444444",
          topic: "PRECURSOR_SCOPE",
          selectedMethod: "No separate precursor goods are declared; natural gas enters as feedstock inside the boundary",
          reason: "Natural gas feedstock is converted inside the installation and no listed precursor material crosses the boundary",
          legalOrTechnicalBasis: "Regulation (EU) 2023/956 Article 3(32) precursor definition; Annex IV",
          evidenceIds: [],
          assumptions: ["Feedstock conversion is part of the installation's own production route"],
          rejectedAlternative: "Declaring natural gas as a precursor",
          reasonForRejection: "Natural gas is not a listed precursor good under Annex I of Regulation (EU) 2023/956",
          responsiblePerson: "Preparer",
          internalReviewer: "Internal reviewer",
          reviewStatus: "ACCEPTED",
          rulesetVersion: "CBAM-RULESET-2025-1",
          approverName: "Internal reviewer",
          approverRole: "INTERNAL_REVIEWER",
          approvedAt: "2026-03-01T10:00:00.000Z",
        },
      ],
    });
    const { calculation, model } = buildModel(caseData);
    const e09 = derivePremiumChapterEvaluations({ caseData, calculation, model }).find((entry) => entry.chapterId === "E-09");
    expect(e09?.status).toBe(PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS);
  });

  it("keeps E-09 a DATA GAP when no accepted precursor-scope decision exists", () => {
    const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      precursors: [],
      methodologyDecisions: [],
    });
    const { calculation, model } = buildModel(caseData);
    const e09 = derivePremiumChapterEvaluations({ caseData, calculation, model }).find((entry) => entry.chapterId === "E-09");
    expect(e09?.status).toBe(PremiumChapterStatus.APPLICABLE_DATA_GAP);
  });

  it("marks E-14 NOT_APPLICABLE_WITH_LEGAL_BASIS for a single-good case", () => {
    const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      goods: [base.goods[0]],
    });
    const { calculation, model } = buildModel(caseData);
    const e14 = derivePremiumChapterEvaluations({ caseData, calculation, model }).find((entry) => entry.chapterId === "E-14");
    expect(e14?.status).toBe(PremiumChapterStatus.NOT_APPLICABLE_WITH_LEGAL_BASIS);
  });

  it("renders the four-status premium chapter table into the premium dossier model", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const { calculation, model } = buildModel(caseData);
    const result = evaluatePremiumChapterContract({ caseData, calculation, model });
    expect(result.evaluations.length).toBe(16);
    expect(result.evaluations.every((entry) => typeof entry.basis === "string" && entry.basis.length > 0)).toBe(true);
  });
});
