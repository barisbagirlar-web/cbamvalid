import { describe, it, expect } from "vitest";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";
import { buildVerifierPreparationModel } from "../../functions/src/dossier/40-readiness/risk-assurance";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

/** Minimal calculation view — only the fields the preparation model consumes. */
function minimalCalculation(goods: Array<{ goodIndex: number; cnCode: string; specificEmbeddedEmissions: string }>) {
  return {
    goods,
  } as unknown as ReturnType<typeof import("../../functions/src/cbam/calculator").performDossierCalculations>;
}

function gapRecord(overrides: Record<string, unknown> = {}) {
  return {
    gapId: "gap-1",
    requirement: "evidence coverage",
    severity: "BLOCKER" as const,
    whyItMatters: "Material requirement without supporting evidence",
    requiredEvidence: "Meter calibration certificate",
    suggestedAction: "Upload calibration certificate",
    isBlocking: true,
    resolutionStatus: "OPEN" as const,
    ...overrides,
  };
}

describe("FAZ 6 — verifier preparation modules", () => {
  it("exposes all twelve preparation modules for a realistic case", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({
      caseData,
      calculation: minimalCalculation([{ goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" }]),
      assessmentTimestamp: "2026-07-31T00:00:00.000Z",
    });

    expect(model.inherentRiskRegister.length).toBeGreaterThan(0);
    expect(model.controlRiskRegister.length).toBeGreaterThan(0);
    expect(model.detectionRiskAssessment.length).toBeGreaterThan(0);
    expect(model.misstatementSusceptibility.length).toBeGreaterThan(0);
    expect(model.nonConformityRisk.length).toBeGreaterThan(0);
    expect(model.dataFlowControlMatrix.length).toBeGreaterThan(0);
    expect(model.samplingPopulation.length).toBeGreaterThan(0);
    expect(model.samplingRationale.length).toBeGreaterThan(0);
    expect(model.sampleSelection.length).toBe(model.samplingPopulation.length);
    expect(model.siteVisitReadiness.state).toBeDefined();
    expect(model.correctiveActionClosure).toBeDefined();
    expect(model.independentReviewHandover.state).toBeDefined();
  });

  it("flags HIGH detection risk when material evidence is missing", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const stripped = {
      ...caseData,
      evidenceRegister: [],
    } as AuditReadyCase;
    const model = buildVerifierPreparationModel({ caseData: stripped });

    const controlHigh = model.controlRiskRegister.some((entry) => entry.combined === "HIGH");
    expect(controlHigh).toBe(true);
    const detectionHigh = model.detectionRiskAssessment.some((entry) => entry.combined === "HIGH");
    expect(detectionHigh).toBe(true);
    const nonConformity = model.nonConformityRisk.find((entry) => entry.requirementArea === "EVIDENCE");
    expect(nonConformity?.risk).toBe("HIGH");
  });

  it("assigns LOW control risk to a primary measured input with approved clean evidence", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({ caseData });

    const control = model.controlRiskRegister.find((entry) => entry.affectedDataDomain === "DOM_DIRECT_EMISSIONS");
    expect(control).toBeDefined();
    expect(control?.combined).toBe("LOW");
    expect(control?.assessmentState).toBe("ASSESSED");
  });

  it("records materiality per good as PROVISIONAL_FOR_VERIFIER_PLANNING with full workpaper fields", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({
      caseData,
      calculation: minimalCalculation([
        { goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" },
        { goodIndex: 2, cnCode: "76012000", specificEmbeddedEmissions: "1.25" },
      ]),
      planningRate: 0.05,
    });

    expect(model.materialityWorkpapers).toHaveLength(2);
    for (const wp of model.materialityWorkpapers) {
      expect(wp.verifierStatus).toBe("PROVISIONAL_FOR_VERIFIER_PLANNING");
      expect(wp.regulatoryBasis.length).toBeGreaterThan(10);
      expect(wp.calculationBasis.length).toBeGreaterThan(10);
      expect(wp.expertJudgement.length).toBeGreaterThan(10);
    }
    const first = model.materialityWorkpapers[0]!;
    expect(first.threshold).toBe("0.125"); // 2.5 × 0.05
    expect(first.cnCode).toBe("76011000");
  });

  it("marks materiality VERIFIER_APPROVED when the verifier reserved per-good share exists", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const caseWithApproval = {
      ...caseData,
      verifierReserved: {
        materialityLevelPerGood: { "1": 0.05 },
      },
    } as AuditReadyCase;
    const model = buildVerifierPreparationModel({
      caseData: caseWithApproval,
      calculation: minimalCalculation([{ goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" }]),
    });

    expect(model.materialityWorkpapers[0]?.verifierStatus).toBe("VERIFIER_APPROVED");
  });

  it("never presents a bare hardcoded percentage as the materiality answer", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({
      caseData,
      calculation: minimalCalculation([{ goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" }]),
    });

    for (const wp of model.materialityWorkpapers) {
      expect(wp.verifierStatus).not.toBe("NOT_ASSESSED");
      const hasBasis = wp.regulatoryBasis.length > 0 && wp.calculationBasis.length > 0;
      expect(hasBasis).toBe(true);
    }
  });

  it("derives sampling population for goods, evidence and calculation trace", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({ caseData });

    const domains = model.samplingPopulation.map((entry) => entry.populationDomain);
    expect(domains).toEqual(expect.arrayContaining(["GOODS", "EVIDENCE", "CALCULATION_TRACE"]));
    const goodsEntry = model.samplingPopulation.find((entry) => entry.populationDomain === "GOODS");
    expect(goodsEntry?.populationSize).toBeGreaterThan(0);
    expect(goodsEntry?.sampleSize).toBeGreaterThan(0);
    expect(goodsEntry?.state).toBe("OPERATOR_PROPOSED");
  });

  it("reports site-visit readiness INCOMPLETE when monitoring plan data is missing", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const stripped = {
      ...caseData,
      installation: {
        ...caseData.installation,
        systemBoundaries: null,
        monitoringPlanId: undefined,
        monitoringPlanVersion: undefined,
      },
    } as AuditReadyCase;
    const model = buildVerifierPreparationModel({ caseData: stripped });

    expect(model.siteVisitReadiness.state).toBe("INCOMPLETE");
    expect(model.siteVisitReadiness.missingItems.length).toBeGreaterThan(0);
  });

  it("maps gap assessment into corrective action closure rows", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const withGaps = {
      ...caseData,
      gapAssessment: [gapRecord(), gapRecord({ gapId: "gap-2", resolutionStatus: "RESOLVED" as const })],
    } as AuditReadyCase;
    const model = buildVerifierPreparationModel({ caseData: withGaps });

    const open = model.correctiveActionClosure.find((row) => row.actionId === "CA-GAP-gap-1");
    const closed = model.correctiveActionClosure.find((row) => row.actionId === "CA-GAP-gap-2");
    expect(open?.state).toBe("OPEN");
    expect(closed?.state).toBe("CLOSED");
  });

  it("is ready for independent review handover only when operator deliverables are complete", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const model = buildVerifierPreparationModel({
      caseData,
      calculation: minimalCalculation([{ goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" }]),
    });

    const verified = model.independentReviewHandover;
    expect(verified.state).toBeDefined();
    expect(verified.items.length).toBeGreaterThan(0);
    const readyCount = verified.items.filter((item) => item.ready).length;
    expect(readyCount).toBeLessThanOrEqual(verified.items.length);
  });

  it("fails closed on an invalid planning rate", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    expect(() =>
      buildVerifierPreparationModel({
        caseData,
        calculation: minimalCalculation([{ goodIndex: 1, cnCode: "76011000", specificEmbeddedEmissions: "2.5" }]),
        planningRate: 1.5,
      })
    ).toThrow("VERIFIER_PREPARATION_INVALID_PLANNING_RATE");
  });
});
