import { describe, expect, it } from "vitest";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import type { AuditReadyCase, InputDatum } from "../../functions/src/cbam/schema";

function input(value: string | null, canonicalUnit?: string): InputDatum {
  return {
    value,
    canonicalUnit,
    sourceType: "PRIMARY",
    confidenceStatus: "HIGH_VERIFIED",
  };
}

function baseCase(): AuditReadyCase {
  return {
    caseId: "case_calc_001",
    status: "DRAFT",
    version: 1,
    ownerId: "user_calc_001",
    importerIdentity: { legalName: input("Importer"), eoriNumber: input("DE12345678") },
    exporterIdentity: { legalName: input("Exporter") },
    reportingPeriod: { year: input("2026"), quarter: input("Annual") },
    goods: [{
      cnCode: input("72081000"),
      sector: "IRON_AND_STEEL",
      productionVolume: input("100", "t"),
      shipmentRecords: input("100", "t"),
    }],
    installation: {
      name: input("Mill"),
      country: input("TR"),
      productionRoute: input("EAF"),
      systemBoundaries: "Melting and rolling",
    },
    directEmissions: input("40", "tCO2e"),
    electricityConsumed: input("100", "MWh"),
    gridEmissionFactor: input("0.4", "tCO2e/MWh"),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: [],
  };
}

describe("verifier-grade dossier calculation", () => {
  it("assigns 100% of a single-good installation and returns the independently expected intensity", () => {
    const result = performDossierCalculations(baseCase());

    expect(result.totalDirectEmissions).toBe("40");
    expect(result.totalIndirectEmissions).toBe("40");
    expect(result.totalEmbeddedEmissions).toBe("80");
    expect(result.allocationShareTotal).toBe("1");
    expect(result.allocationReconciliationDelta).toBe("0");
    expect(result.goods).toEqual([
      expect.objectContaining({
        allocationShare: "1",
        allocatedEmbeddedEmissions: "80",
        specificEmbeddedEmissions: "0.8",
      }),
    ]);
  });

  it("allocates a multi-good installation without double counting and reconciles to the installation total", () => {
    const caseData = baseCase();
    caseData.goods = [
      {
        cnCode: input("72081000"),
        sector: "IRON_AND_STEEL",
        productionVolume: input("100", "t"),
        shipmentRecords: input("100", "t"),
        allocationShare: input("0.6", "fraction"),
      },
      {
        cnCode: input("76011000"),
        sector: "ALUMINIUM",
        productionVolume: input("50", "t"),
        shipmentRecords: input("50", "t"),
        allocationShare: input("0.4", "fraction"),
      },
    ];

    const result = performDossierCalculations(caseData);

    expect(result.allocationShareTotal).toBe("1");
    expect(result.allocationReconciliationDelta).toBe("0");
    expect(result.goods[0].allocatedEmbeddedEmissions).toBe("48");
    expect(result.goods[0].specificEmbeddedEmissions).toBe("0.48");
    expect(result.goods[1].allocatedEmbeddedEmissions).toBe("32");
    expect(result.goods[1].specificEmbeddedEmissions).toBe("0.64");
    const allocatedTotal = result.goods.reduce((sum, good) => sum + Number(good.allocatedEmbeddedEmissions), 0);
    expect(allocatedTotal).toBe(80);
    expect(result.totalEmbeddedEmissions).toBe("80");
  });

  it("rejects allocation shares that do not reconcile to one", () => {
    const caseData = baseCase();
    caseData.goods = [
      { ...caseData.goods[0], allocationShare: input("0.7", "fraction") },
      {
        cnCode: input("76011000"),
        sector: "ALUMINIUM",
        productionVolume: input("50", "t"),
        shipmentRecords: input("50", "t"),
        allocationShare: input("0.4", "fraction"),
      },
    ];

    expect(() => performDossierCalculations(caseData)).toThrow("CALCULATION_ALLOCATION_NOT_RECONCILED:1.1");
  });

  it("normalizes kilograms to tonnes before calculating specific embedded emissions", () => {
    const caseData = baseCase();
    caseData.goods[0].productionVolume = input("100000", "kg");

    const result = performDossierCalculations(caseData);

    expect(result.productionVolume).toBe("100");
    expect(result.goods[0].productionVolume).toBe("100");
    expect(result.goods[0].specificEmbeddedEmissions).toBe("0.8");
    expect(result.trace.some((node) => node.conversions?.fromUnit === "kg")).toBe(true);
  });

  it("counts precursor emissions exactly once across direct and indirect totals", () => {
    const caseData = baseCase();
    caseData.precursors = [{
      name: input("Purchased precursor"),
      quantity: input("10", "t"),
      directEmissions: input("10", "tCO2e"),
      indirectEmissions: input("5", "tCO2e"),
      countryOfOrigin: input("TR"),
    }];

    const result = performDossierCalculations(caseData);

    expect(result.totalDirectEmissions).toBe("50");
    expect(result.totalIndirectEmissions).toBe("45");
    expect(result.totalPrecursorEmissions).toBe("15");
    expect(result.totalEmbeddedEmissions).toBe("95");
  });

  it("is deterministic for identical canonical input", () => {
    const first = performDossierCalculations(baseCase());
    const second = performDossierCalculations(baseCase());

    expect(first.calculationRootHash).toBe(second.calculationRootHash);
    expect(first.trace.map((node) => node.calculationHash)).toEqual(second.trace.map((node) => node.calculationHash));
  });

  it("fails closed instead of converting a missing material input to zero", () => {
    const caseData = baseCase();
    caseData.directEmissions.value = null;

    expect(() => performDossierCalculations(caseData)).toThrow("CALCULATION_INPUT_REQUIRED:directEmissions");
  });
});
