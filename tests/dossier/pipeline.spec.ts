import { describe, expect, it } from "vitest";
import {
  energyTimesFactor,
  mwh,
  tco2ePerMWh,
  formatCoverage,
  quantity,
  Decimal,
  tco2e,
} from "../../src/dossier/00-schema/units";
import { parseRawCaseInput } from "../../src/dossier/00-schema/case.schema";
import { normalizeCase } from "../../src/dossier/10-normalize/normalizeCase";
import { buildCalcGraph, recomputeGraphHashes } from "../../src/dossier/20-kernel/graph";
import { assembleDossier } from "../../src/dossier/50-model/assembleDossier";
import { applicableActStack, cite } from "../../src/dossier/01-ruleset/regulations.registry";
import { computeHonestScores } from "../../src/dossier/40-readiness/score";
import { attributeInstallationToProcesses } from "../../src/dossier/20-kernel/attribution";

const steelFixture = {
  caseId: "CASE-STEEL-001",
  operatorLegalName: "Third Country Steel A.S.",
  installationName: "Plant A",
  installationCountry: "TR",
  reportingPeriod: { type: "DEFINITIVE_ANNUAL" as const, year: 2026 },
  directEmissionsTco2e: "80",
  electricityMwh: "100",
  gridFactorTco2ePerMwh: "0.4",
  goods: [
    {
      cnCode: "72011011",
      sector: "IRON_AND_STEEL",
      netMassTonnes: "60",
      allocationShare: "0.6",
      allocationJustification: "Mass share pending process-level meters — documented simplification.",
    },
    {
      cnCode: "72011019",
      sector: "IRON_AND_STEEL",
      netMassTonnes: "40",
      allocationShare: "0.4",
      allocationJustification: "Mass share pending process-level meters — documented simplification.",
    },
  ],
  productionProcesses: [],
  signOffs: [
    {
      role: "OPERATOR_PREPARER" as const,
      name: "Ayse Preparer",
      title: "Data Preparer",
      signedAt: "2026-04-01",
    },
    {
      role: "INTERNAL_REVIEWER" as const,
      name: "Mehmet Reviewer",
      title: "Internal Reviewer",
      signedAt: "2026-04-02",
    },
    {
      role: "DATA_OWNER" as const,
      name: "Fatma Manager",
      title: "Installation Manager",
      signedAt: "2026-04-03",
    },
  ],
  evidenceIds: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
};

describe("WP-00 branded units acceptance", () => {
  it("100 MWh × 0.4 tCO2e/MWh → exact 40 at 28 dp", () => {
    const result = energyTimesFactor(mwh("100"), tco2ePerMWh("0.4"));
    expect(result.toFixed(28)).toBe(new Decimal("40").toFixed(28));
  });

  it("coverage always prints basis", () => {
    expect(
      formatCoverage({
        numerator: new Decimal(365),
        denominator: new Decimal(365),
        basis: "DAYS",
      })
    ).toBe("365 / 365 days");
    expect(
      formatCoverage({
        numerator: new Decimal(1),
        denominator: new Decimal(1),
        basis: "BOOLEAN",
      })
    ).toBe("1 / 1 boolean");
  });

  it("Quantity requires sourceNodeId (INV-3)", () => {
    expect(() => quantity(tco2e(1), "tCO2e", "")).toThrow(/SOURCE_NODE/);
    const q = quantity(tco2e(40), "tCO2e", "CBAM.IND.INSTALLATION");
    expect(q.sourceNodeId).toBe("CBAM.IND.INSTALLATION");
  });
});

describe("WP-01 legal registry", () => {
  it("cite() resolves without template literals in registry consumers", () => {
    expect(cite("CBAM_BASE")).toContain("2023/956");
    expect(cite("IR_METHODOLOGY")).toContain("2025/2547");
  });

  it("applicableActStack only includes complete bibliography", () => {
    const stack = applicableActStack();
    expect(stack.some((a) => a.key === "CBAM_BASE")).toBe(true);
    expect(stack.some((a) => a.key === "IR_METHODOLOGY")).toBe(true);
    expect(stack.some((a) => a.key === "IR_FREE_ALLOCATION")).toBe(false);
    expect(stack.some((a) => a.key === "IR_VERIFICATION")).toBe(false);
  });
});

describe("WP-04 calc graph", () => {
  it("builds deterministic node IDs and merkle root; recompute matches", () => {
    const canonical = normalizeCase(steelFixture);
    const graph = buildCalcGraph(canonical);
    expect(graph.nodes.some((n) => n.id === "CBAM.DIR.INSTALLATION")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "CBAM.GOOD.0.SEE_PRICED")).toBe(true);
    expect(graph.nodes.some((n) => n.id.includes("CBAM_GOOD_"))).toBe(false);
    expect(graph.nodes.some((n) => n.id.endsWith("CBAM.GOOD."))).toBe(false);

    const priced = graph.nodes.find((n) => n.id === "CBAM.GOOD.0.SEE_PRICED");
    expect(priced?.value.toString()).toBe("0.8");

    const recomputed = recomputeGraphHashes(graph.nodes);
    expect(recomputed.rootHash).toBe(graph.rootHash);
  });
});

describe("WP-05 attribution", () => {
  it("reconciles single-process implicit attribution to zero delta", () => {
    const canonical = normalizeCase(steelFixture);
    const result = attributeInstallationToProcesses(canonical);
    expect(result.reconciled).toBe(true);
    expect(result.reconciliationDeltaDirect.abs().toNumber()).toBe(0);
    expect(result.simplifiedAllocationFinding?.code).toBe("SIMPLIFIED_ALLOCATION");
    expect(result.nonAssociated.wasteGasExportedTco2e.toString()).toBe("0");
  });

  it("blocks allocationShare without justification", () => {
    expect(() =>
      normalizeCase({
        ...steelFixture,
        goods: [
          {
            cnCode: "72011011",
            sector: "IRON_AND_STEEL",
            netMassTonnes: "100",
            allocationShare: "1",
          },
        ],
      })
    ).toThrow(/JUSTIFICATION/);
  });
});

describe("WP-08 honest scoring", () => {
  it("S0176-class → OPERATOR READINESS ≤ 65, completeness ≤ 70, NOT_READY", () => {
    const scores = computeHonestScores({
      originInScope: true,
      dimensionScores: [
        { id: "EVIDENCE", weight: 20, score01: 0.35, chapterNonEmpty: true, operatorControllable: true },
        { id: "SCOPE", weight: 15, score01: 0, chapterNonEmpty: false, operatorControllable: true },
        { id: "UNCERTAINTY", weight: 10, score01: 0, chapterNonEmpty: false, operatorControllable: true },
        { id: "CALC", weight: 20, score01: 1, chapterNonEmpty: true, operatorControllable: true },
      ],
      signOffsComplete: false,
      verifierReservedComplete: 0,
      verifierReservedTotal: 5,
      hardBlockers: [],
    });
    expect(scores.operatorReadiness).toBeLessThanOrEqual(65);
    expect(scores.dossierCompleteness).toBeLessThanOrEqual(70);
    expect(scores.status).not.toBe("OPERATOR_PREPARATION_COMPLETE");
    expect(scores.findings).toContain("SIGNOFF_MISSING");
  });
});

describe("WP-13 period discriminated union", () => {
  it("annual period cannot carry quarter", () => {
    expect(() =>
      parseRawCaseInput({
        ...steelFixture,
        reportingPeriod: { type: "DEFINITIVE_ANNUAL", year: 2026, quarter: 1 },
      })
    ).toThrow();
  });
});

describe("WP-06 uncertainty fail-closed", () => {
  it("no instruments → NOT_ASSESSED even when test tiers dataset present", async () => {
    const { assessUncertainty } = await import("../../src/dossier/40-readiness/uncertainty");
    const u = assessUncertainty({
      sourceStreamCount: 0,
      streamsWithInstrument: 0,
      streamsWithCalibrationEvidence: 0,
    });
    expect(u.state).toBe("NOT_ASSESSED");
    expect(u.score01).toBe(0);
    expect(u.findings).toContain("NO_INSTRUMENTS");
  });

  it("test tiers + calibrated instruments → ASSESSED score 1", async () => {
    const { assessUncertainty } = await import("../../src/dossier/40-readiness/uncertainty");
    const u = assessUncertainty({
      sourceStreamCount: 2,
      streamsWithInstrument: 2,
      streamsWithCalibrationEvidence: 2,
    });
    expect(u.state).toBe("ASSESSED");
    expect(u.score01).toBe(1);
    expect(u.chapterRenderable).toBe(true);
  });
});

describe("WP-07 evidence binder S0176-class", () => {
  it("one .txt file for 18 requirements → score ≤ 0.35 + concentration/diversity findings", async () => {
    const { bindEvidence } = await import("../../src/dossier/30-evidence/bindEvidence");
    const result = bindEvidence({
      requirementCount: 18,
      documents: [
        {
          evidenceId: "11111111-1111-4111-8111-111111111111",
          mimeType: "text/plain",
          evidenceClass: "DIRECT_EMISSIONS",
          requirementIds: Array.from({ length: 18 }, (_, i) => `REQ-${i}`),
        },
      ],
    });
    expect(result.evidenceScore01).toBeLessThanOrEqual(0.35);
    expect(result.findings).toContain("SINGLE_SOURCE_CONCENTRATION");
    expect(result.findings).toContain("EVIDENCE_DIVERSITY_INSUFFICIENT");
    expect(result.findings).toContain("EVIDENCE_CLASS_MIME_INADMISSIBLE");
  });
});

describe("WP-09 empty chapter contract", () => {
  it("system boundary placeholder → DATA GAP, not Boundaries defined.", async () => {
    const {
      evaluateContentContract,
      SYSTEM_BOUNDARY_CONTRACT,
    } = await import("../../src/dossier/40-readiness/content-contracts");
    const outcome = evaluateContentContract(SYSTEM_BOUNDARY_CONTRACT, {
      physicalBoundaryDescription: "Boundaries defined.",
      records: [],
    });
    expect(outcome.status).toBe("INSUFFICIENT");
    if (outcome.status === "INSUFFICIENT") {
      expect(outcome.dataGapMessage).toContain("DATA GAP");
      expect(outcome.dataGapMessage).not.toBe("Boundaries defined.");
    }
  });
});

describe("WP-11 TSA + WP-02 delta + Part D chapters", () => {
  it("TSA absent → may not claim trusted timestamp", async () => {
    const { bindRfc3161Timestamp, mayClaimTrustedTimestamp } = await import(
      "../../src/dossier/70-seal/tsa"
    );
    const binding = bindRfc3161Timestamp({ tsrBytes: null });
    expect(binding.status).toBe("ABSENT");
    expect(mayClaimTrustedTimestamp(binding)).toBe(false);
  });

  it("sealed delta detects SEE change → reissue action", async () => {
    const { diffSealedSnapshots } = await import("../../src/dossier/90-verify/sealed-delta");
    const delta = diffSealedSnapshots(
      {
        packageId: "A",
        calculationRootHash: "a".repeat(64),
        seePricedByGood: { "0": "1.2" },
        totalPriced: "120",
      },
      {
        packageId: "A",
        calculationRootHash: "b".repeat(64),
        seePricedByGood: { "0": "0.8" },
        totalPriced: "80",
      }
    );
    expect(delta.changed).toBe(true);
    expect(delta.customerAction).toBe("NOTIFY_AND_REISSUE_FREE_OF_CHARGE");
  });

  it("Enterprise chapters block when content missing", async () => {
    const { evaluateEnterpriseChapters } = await import(
      "../../src/dossier/50-model/enterprise-chapters"
    );
    const result = evaluateEnterpriseChapters({
      tier: "ENTERPRISE",
      providedByChapterId: {},
    });
    expect(result.blockingGaps.length).toBeGreaterThan(0);
    expect(result.evaluations.some((e) => e.id === "E-09" && e.required)).toBe(true);
  });

  it("Exclusive requires E-16", async () => {
    const { evaluateEnterpriseChapters } = await import(
      "../../src/dossier/50-model/enterprise-chapters"
    );
    const result = evaluateEnterpriseChapters({
      tier: "EXCLUSIVE",
      providedByChapterId: {
        "E-16": {
          cliUsage: "node Supporting_Evidence/verify/cli.js --package . --strict",
          verificationReportPath: "VERIFICATION_REPORT.txt",
          records: [{}],
        },
      },
    });
    const e16 = result.evaluations.find((e) => e.id === "E-16");
    expect(e16?.required).toBe(true);
    expect(e16?.outcome.status).toBe("SATISFIED");
  });

  it("test-complete Exclusive payloads from steel fixture have zero blocking gaps", async () => {
    const { buildChapterPayloadsFromDossier } = await import(
      "../../src/dossier/50-model/chapter-payloads"
    );
    const { evaluateEnterpriseChapters } = await import(
      "../../src/dossier/50-model/enterprise-chapters"
    );
    const exclusiveFixture = {
      ...steelFixture,
      productionProcesses: [
        {
          processId: "PROC-BF-BOF-001",
          name: "Blast furnace / BOF integrated steelmaking",
          producedGoodIndexes: [0, 1],
          attributedDirectTco2e: "80",
          attributedIndirectTco2e: "40",
        },
      ],
    };
    const model = assembleDossier(exclusiveFixture, {
      evidenceDimensionScore01: 0.9,
      chapterNonEmpty: {
        EVIDENCE: true,
        SCOPE_METHODOLOGY: true,
        DATA_QUALITY_UNCERTAINTY: true,
      },
      signOffsComplete: true,
    });
    const payloads = buildChapterPayloadsFromDossier(model, {
      systemBoundary:
        "Coke preparation, sinter plant, blast furnace, basic oxygen furnace, casting and finishing operations within the controlled installation boundary.",
      monitoringPlanEvidenceId: "ev-1",
      evidenceCount: 5,
      goodsCount: 2,
      carbonPriceRecords: [{ id: "cp-1", amountPaid: "1200" }],
      sourceStreams: [
        {
          name: "Process fuel / combustion stream",
          category: "MAJOR",
          instrumentId: "TEST-METER-FUEL-001",
          calibrationEvidenceId: "ev-4",
        },
        {
          name: "Electricity import meter",
          category: "MAJOR",
          instrumentId: "TEST-METER-EL-001",
          calibrationEvidenceId: "ev-4",
        },
      ],
      emissionSources: [
        { name: "Blast furnace / process stack", gas: "CO2" },
        { name: "Combustion units", gas: "CO2" },
      ],
      meters: [
        { id: "TEST-METER-FUEL-001", calibrationValidity: "2027-01-14", evidenceId: "ev-4" },
        { id: "TEST-METER-EL-001", calibrationValidity: "2027-01-14", evidenceId: "ev-4" },
      ],
    });
    const result = evaluateEnterpriseChapters({
      tier: "EXCLUSIVE",
      providedByChapterId: payloads,
    });
    expect(result.blockingGaps).toEqual([]);
    expect(JSON.stringify(payloads["E-06"].processes)).toContain("PROC-BF-BOF-001");
    expect(JSON.stringify(payloads["E-06"].processes)).not.toContain("IMPLICIT_INSTALLATION");
    expect(model.scores.findings).not.toContain("SIGNOFF_MISSING");
    expect(model.scores.findings).not.toContain("DIMENSION_CHAPTER_EMPTY:DATA_QUALITY_UNCERTAINTY");
  });
});

describe("CN registry + selfVerify", () => {
  it("resolves pig iron CN to IRON_AND_STEEL", async () => {
    const { resolveCn } = await import("../../src/dossier/01-ruleset/cn.registry");
    const r = resolveCn("72011011");
    expect(r.inScope).toBe(true);
    expect(r.sector).toBe("IRON_AND_STEEL");
    expect(r.functionalUnit).toBe("t");
  });

  it("selfVerify passes for assembled steel model", async () => {
    const { assertSelfVerify } = await import("../../src/dossier/90-verify/selfVerify");
    const model = assembleDossier(steelFixture, {
      evidenceDimensionScore01: 0.35,
      signOffsComplete: false,
      verifierReservedTotal: 5,
      verifierReservedComplete: 0,
    });
    expect(() => assertSelfVerify(model)).not.toThrow();
  });
});

describe("L6 assembleDossier", () => {
  it("produces frozen self-validated model with Annex II priced SEE 0.8", () => {
    const model = assembleDossier(steelFixture, {
      evidenceDimensionScore01: 0.35,
      chapterNonEmpty: {
        EVIDENCE: true,
        SCOPE_METHODOLOGY: false,
        DATA_QUALITY_UNCERTAINTY: false,
      },
      signOffsComplete: false,
      verifierReservedTotal: 5,
      verifierReservedComplete: 0,
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.dto.annexIiSectorsPresent).toBe(true);
    expect(model.scores.operatorReadiness).toBeLessThanOrEqual(65);
    const see = model.calcGraph.nodes.find((n) => n.id === "CBAM.GOOD.0.SEE_PRICED");
    expect(see?.value.toString()).toBe("0.8");
  });

  it("DE origin → NOT_APPLICABLE_CBAM, readiness 0", () => {
    const model = assembleDossier({ ...steelFixture, installationCountry: "DE" });
    expect(model.dto.originInScope).toBe(false);
    expect(model.scores.operatorReadiness).toBe(0);
    expect(model.scores.status).toBe("NOT_APPLICABLE_CBAM");
  });
});
