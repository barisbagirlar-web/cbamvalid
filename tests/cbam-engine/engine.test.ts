import { describe, it, expect } from "vitest";
import { determineApplicability } from "../../lib/cbam/engine/applicability-engine";
import { resolveCertificatePrice } from "../../lib/cbam/engine/certificate-engine";
import { orchestrateCalculation } from "../../lib/cbam/engine/calculation-orchestrator";

describe("CBAM Applicability & Mass Threshold Limits", () => {
  it("Exempts steel imports strictly under 50.000 tonnes", () => {
    const result = determineApplicability({
      cnCode: "72011011",
      totalMassTonnes: 49.999,
      role: "IMPORTER",
    });

    expect(result.isApplicable).toBe(false);
    expect(result.underThreshold).toBe(true);
  });

  it("Subjects steel imports to CBAM at exactly 50.000 tonnes limit", () => {
    const result = determineApplicability({
      cnCode: "72011011",
      totalMassTonnes: 50.000,
      role: "IMPORTER",
    });

    // Mass >= 50.0 is not underThreshold
    expect(result.isApplicable).toBe(true);
    expect(result.underThreshold).toBe(false);
  });

  it("Always subjects electricity and hydrogen to CBAM, bypassing de minimis checks", () => {
    const electricityResult = determineApplicability({
      cnCode: "27160000",
      totalMassTonnes: 0.1,
      role: "IMPORTER",
    });

    const hydrogenResult = determineApplicability({
      cnCode: "28041000",
      totalMassTonnes: 0.1,
      role: "IMPORTER",
    });

    expect(electricityResult.isApplicable).toBe(true);
    expect(hydrogenResult.isApplicable).toBe(true);
  });
});

describe("Certificate Pricing Rules", () => {
  it("Uses quarterly cadence in 2026 and returns correct Q1/Q2 pricing", () => {
    const q1 = resolveCertificatePrice({ importYear: 2026, importQuarter: 1 });
    const q2 = resolveCertificatePrice({ importYear: 2026, importQuarter: 2 });

    expect(q1.cadence).toBe("QUARTERLY");
    expect(q1.priceEurPerTonne).toBe(75.36);
    expect(q2.priceEurPerTonne).toBe(75.28);
  });

  it("Enforces weekly pricing cadence starting in 2027", () => {
    const price2027 = resolveCertificatePrice({ importYear: 2027, importWeek: 12 });
    expect(price2027.cadence).toBe("WEEKLY");
    expect(price2027.isProvisional).toBe(true);
  });
});

describe("Emissions Calculation Engine", () => {
  it("Calculates correct direct/indirect emissions and cost obligations", () => {
    const result = orchestrateCalculation({
      role: "IMPORTER",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72011011",
      productionVolume: 100,
      installationName: "Test Install",
      hasActualData: true,
      isVerified: true,
      directEmissionsInput: 150,
      electricityConsumedInput: 50,
      gridEmissionFactorInput: 0.4,
      isComplexGood: true,
      precursorDirectEmissionsInput: 20,
      precursorIndirectEmissionsInput: 10,
      carbonPricePaidInput: 15,
    });

    expect(result.totalDirectEmissions).toBe(170); // 150 + 20
    expect(result.totalIndirectEmissions).toBe(30); // (50 * 0.4) + 10
    expect(result.totalEmbeddedEmissions).toBe(200); // 170 + 30
    
    // Benchmark = 10% for steel -> allocation = 20 tCO2e
    expect(result.freeAllocationAdjustment).toBe(20);
    
    // Decoupled certificate reduction validation:
    // certificatesBeforeReduction = 200 - 20 = 180 certificates
    // carbonPricePaidCurrency = 15 * 200 = 3000 EUR
    // certificatePrice = 75.36 EUR
    // eligibleCertificateReduction = floor(3000 / 75.36) = 39 certificates
    // certificatesAfterReduction = 180 - 39 = 141 certificates
    expect(result.embeddedEmissionsTco2e).toBe(200);
    expect(result.carbonPricePaidCurrency).toBe(3000);
    expect(result.certificatesBeforeReduction).toBe(180);
    expect(result.eligibleCertificateReduction).toBe(39);
    expect(result.certificatesAfterReduction).toBe(141);
    expect(result.netCertificatesDue).toBe(141);
    expect(result.estimatedCertificateCostEur).toBe(10625.76); // 141 * 75.36
  });
});
