import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  PREVIEW_ENGINE_VERSION,
  PREVIEW_RULESET,
  performDossierCalculations as performBrowserCalculation,
} from "../../lib/cbam/calculator";
import { AuditReadyCaseSchema as BrowserCaseSchema } from "../../lib/cbam/schema";
import {
  CALCULATION_ENGINE_VERSION,
  CALCULATION_RULESET,
  performDossierCalculations as performServerCalculation,
} from "../../functions/src/cbam/calculator";
import {
  CALCULATION_CONTRACT,
  EMISSIONS_RECONCILIATION_TOLERANCE,
  allocationReconciliationDelta,
} from "../../src/dossier/01-ruleset/calculation.rules";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";
import { runQualityControls as runServerQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

describe("browser/server calculation parity", () => {
  it("uses one canonical ruleset and engine identity", () => {
    expect(PREVIEW_RULESET).toBe(CALCULATION_CONTRACT.rulesetIdentity);
    expect(CALCULATION_RULESET).toBe(CALCULATION_CONTRACT.rulesetIdentity);
    expect(PREVIEW_ENGINE_VERSION).toBe(CALCULATION_CONTRACT.engineVersion);
    expect(CALCULATION_ENGINE_VERSION).toBe(CALCULATION_CONTRACT.engineVersion);
  });

  it("normalizes kilograms to tonnes identically in browser and server", () => {
    const serverCase = createVerifierGradeCase();
    serverCase.goods[0].productionVolume.value = "60000";
    serverCase.goods[0].productionVolume.canonicalUnit = "kg";
    serverCase.goods[1].productionVolume.value = "40000";
    serverCase.goods[1].productionVolume.canonicalUnit = "kg";

    const browser = performBrowserCalculation(BrowserCaseSchema.parse(serverCase));
    const server = performServerCalculation(serverCase);

    expect(browser.productionVolume).toBe("100");
    expect(browser.productionVolume).toBe(server.productionVolume);
    expect(browser.specificEmbeddedEmissions).toBe(server.specificEmbeddedEmissions);
    expect(browser.goods.map((good) => good.productionVolume)).toEqual(
      server.goods.map((good) => good.productionVolume)
    );
    expect(browser.goods.map((good) => good.allocatedEmbeddedEmissions)).toEqual(
      server.goods.map((good) => good.allocatedEmbeddedEmissions)
    );
  });

  it("preserves output parity across deterministic valid input properties", () => {
    const samples = [
      { direct: "0", electricity: "0", factor: "0", unit: "t", scale: "1" },
      { direct: "0.000001", electricity: "0.3", factor: "0.4344", unit: "kg", scale: "1000" },
      { direct: "987654.321", electricity: "123456.789", factor: "1.234567", unit: "t", scale: "1" },
    ] as const;

    for (const sample of samples) {
      const serverCase = createVerifierGradeCase();
      serverCase.directEmissions.value = sample.direct;
      serverCase.electricityConsumed.value = sample.electricity;
      serverCase.gridEmissionFactor.value = sample.factor;
      serverCase.goods[0].productionVolume.value = new Decimal(60)
        .times(sample.scale)
        .toString();
      serverCase.goods[0].productionVolume.canonicalUnit = sample.unit;
      serverCase.goods[1].productionVolume.value = new Decimal(40)
        .times(sample.scale)
        .toString();
      serverCase.goods[1].productionVolume.canonicalUnit = sample.unit;

      const browser = performBrowserCalculation(BrowserCaseSchema.parse(serverCase));
      const server = performServerCalculation(serverCase);

      expect({
        totalDirectEmissions: browser.totalDirectEmissions,
        totalIndirectEmissions: browser.totalIndirectEmissions,
        totalEmbeddedEmissions: browser.totalEmbeddedEmissions,
        productionVolume: browser.productionVolume,
        specificEmbeddedEmissions: browser.specificEmbeddedEmissions,
        allocationShareTotal: browser.allocationShareTotal,
        allocationReconciliationDelta: browser.allocationReconciliationDelta,
      }).toEqual({
        totalDirectEmissions: server.totalDirectEmissions,
        totalIndirectEmissions: server.totalIndirectEmissions,
        totalEmbeddedEmissions: server.totalEmbeddedEmissions,
        productionVolume: server.productionVolume,
        specificEmbeddedEmissions: server.specificEmbeddedEmissions,
        allocationShareTotal: server.allocationShareTotal,
        allocationReconciliationDelta: server.allocationReconciliationDelta,
      });
    }
  });
});

describe("authoritative allocation reconciliation", () => {
  it("checks independently expected emissions instead of comparing a sum to itself", () => {
    const delta = allocationReconciliationDelta({
      totalDirect: new Decimal("80"),
      totalIndirect: new Decimal("40"),
      allocations: [
        {
          share: new Decimal("0.6"),
          indirectPriced: false,
          actualAllocated: new Decimal("48"),
        },
        {
          share: new Decimal("0.4"),
          indirectPriced: false,
          actualAllocated: new Decimal("31.5"),
        },
      ],
    });

    expect(delta.toString()).toBe("0.5");
    expect(delta.gt(EMISSIONS_RECONCILIATION_TOLERANCE)).toBe(true);
  });

  it("reconciles generated allocations against an independently recomputed property", () => {
    for (const shares of [
      ["0.5", "0.5"],
      ["0.333333", "0.666667"],
      ["0.000001", "0.999999"],
    ]) {
      const caseData = createVerifierGradeCase();
      caseData.goods[0].allocationShare!.value = shares[0];
      caseData.goods[1].allocationShare!.value = shares[1];
      const result = performServerCalculation(caseData);
      const direct = new Decimal(result.totalDirectEmissions);
      const indirect = new Decimal(result.totalIndirectEmissions);
      const independentlyExpected = result.goods.reduce((total, good) => {
        const pricedBase = good.indirectPriced ? direct.plus(indirect) : direct;
        return total.plus(pricedBase.times(good.allocationShare));
      }, new Decimal(0));
      const actual = result.goods.reduce(
        (total, good) => total.plus(good.allocatedEmbeddedEmissions),
        new Decimal(0)
      );

      expect(actual.minus(independentlyExpected).abs().toString()).toBe("0");
      expect(result.allocationReconciliationDelta).toBe("0");
    }
  });
});

describe("carbon-price fail-closed controls", () => {
  it("does not grant a reduction from partially supported evidence", () => {
    const caseData = createVerifierGradeCase();
    caseData.carbonPriceRecords[0].eligibleCertificateReduction = "10";
    const paymentEvidence = caseData.evidenceRegister.find(
      (evidence) =>
        evidence.evidenceId === caseData.carbonPriceRecords[0].proofOfPaymentEvidenceId
    )!;
    paymentEvidence.supportStatus = "PARTIALLY_SUPPORTED";

    expect(() => performServerCalculation(caseData)).toThrow(
      "CALCULATION_CARBON_PRICE_EVIDENCE_NOT_FULLY_SUPPORTED"
    );
    for (const controls of [
      runQualityControls(BrowserCaseSchema.parse(caseData)),
      runServerQualityControls(caseData),
    ]) {
      expect(controls.find((control) => control.ruleId.startsWith("QC_11_"))?.status)
        .toBe("BLOCKER");
    }
  });

  it("fails closed when the formula and currency policy are not proven", () => {
    expect(CALCULATION_CONTRACT.carbonPricePolicy.status).toBe("NOT_PROVEN");
    expect(CALCULATION_CONTRACT.carbonPricePolicy.adoptionStatus)
      .toBe("AWAITING_FINAL_IMPLEMENTING_ACT");
    expect(CALCULATION_CONTRACT.carbonPricePolicy.lastPrimarySourceReview)
      .toBe("2026-07-29");
    expect(CALCULATION_CONTRACT.carbonPricePolicy.legalBasis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://eur-lex.europa.eu/eli/reg/2023/956",
        }),
        expect.objectContaining({
          url: "https://taxation-customs.ec.europa.eu/news/carbon-price-paid-third-countries-2026-05-13_en",
        }),
      ])
    );
    for (const currency of ["EUR", "USD", "GBP", "TRY"] as const) {
      const caseData = createVerifierGradeCase();
      caseData.carbonPriceRecords[0].eligibleCertificateReduction = "10";
      caseData.carbonPriceRecords[0].currency = currency;

      expect(() => performServerCalculation(caseData)).toThrow(
        "CALCULATION_CARBON_PRICE_POLICY_NOT_PROVEN"
      );
      expect(
        runServerQualityControls(caseData).find((control) =>
          control.ruleId.startsWith("QC_11_")
        )?.remediationCode
      ).toBe("REM_WAIT_FOR_VERIFIED_CARBON_PRICE_POLICY");
    }
  });

  it("permits a zero claimed reduction without applying an unproven policy", () => {
    const result = performServerCalculation(createVerifierGradeCase());
    expect(result.eligibleCertificateReduction).toBe("0");
  });
});
