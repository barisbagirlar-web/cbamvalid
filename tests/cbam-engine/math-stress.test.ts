import { describe, it, expect } from "vitest";
import { orchestrateCalculation } from "../../lib/cbam/engine/calculation-orchestrator";
import { resolveCertificatePrice } from "../../lib/cbam/engine/certificate-engine";
import { determineApplicability } from "../../lib/cbam/engine/applicability-engine";

describe("CBAM Math & Boundary Stress Test Suite", () => {

  it("1. Handles zero values and degenerate states without crash or division by zero", () => {
    const result = orchestrateCalculation({
      role: "IMPORTER",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72011011",
      productionVolume: 0,
      installationName: "Zero Install",
      hasActualData: true,
      isVerified: true,
      directEmissionsInput: 0,
      electricityConsumedInput: 0,
      gridEmissionFactorInput: 0.45,
      isComplexGood: false,
      carbonPricePaidInput: 0,
    });

    expect(result.totalDirectEmissions).toBe(0);
    expect(result.totalIndirectEmissions).toBe(0);
    expect(result.totalEmbeddedEmissions).toBe(0);
    expect(result.freeAllocationAdjustment).toBe(0);
    expect(result.netCertificatesDue).toBe(0);
    expect(result.estimatedCertificateCostEur).toBe(0);
    expect(result.costPerTonneProductEur).toBe(0);
  });

  it("2. Bypasses threshold checks for electricity and hydrogen even with low masses", () => {
    const elResult = determineApplicability({
      cnCode: "27160000",
      totalMassTonnes: 0.0001,
      role: "IMPORTER",
    });
    expect(elResult.isApplicable).toBe(true);

    const hyResult = determineApplicability({
      cnCode: "28041000",
      totalMassTonnes: 0.0001,
      role: "IMPORTER",
    });
    expect(hyResult.isApplicable).toBe(true);
  });

  it("3. Enforces that carbon price paid reduction cannot exceed certificates before reduction", () => {
    const result = orchestrateCalculation({
      role: "IMPORTER",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72011011",
      productionVolume: 100, // Above 50 tonnes threshold
      installationName: "Heavy Subsidy Install",
      hasActualData: true,
      isVerified: true,
      directEmissionsInput: 500, // 500 tCO2e direct
      electricityConsumedInput: 0,
      gridEmissionFactorInput: 0,
      isComplexGood: false,
      carbonPricePaidInput: 1000, // Pays 1000 EUR/tCO2e -> very high carbon price paid
    });

    // totalEmbedded = 500.
    // freeAllocationAdjustment = 500 * 0.1 = 50.
    // certificatesBeforeReduction = 500 - 50 = 450.
    // carbonPricePaidCurrency = 500 * 1000 = 500000 EUR.
    // pricing = 75.36 EUR/t.
    // eligibleCertificateReduction = min(450, floor(500000 / 75.36)) = min(450, 6634) = 450.
    // certificatesAfterReduction = 450 - 450 = 0.
    expect(result.certificatesBeforeReduction).toBe(450);
    expect(result.eligibleCertificateReduction).toBe(450);
    expect(result.netCertificatesDue).toBe(0);
    expect(result.estimatedCertificateCostEur).toBe(0);
  });

  it("4. Rejects carbon price relief if claims are unverified", () => {
    const result = orchestrateCalculation({
      role: "IMPORTER",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72011011",
      productionVolume: 100,
      installationName: "Unverified Carbon Price Install",
      hasActualData: true,
      isVerified: false, // Unverified emissions/data
      directEmissionsInput: 200,
      electricityConsumedInput: 0,
      gridEmissionFactorInput: 0,
      isComplexGood: false,
      carbonPricePaidInput: 50,
    });

    // totalEmbedded = 200.
    // freeAllocationAdjustment = 200 * 0.1 = 20.
    // certificatesBeforeReduction = 180.
    // Since isVerified is false, eligibleCertificateReduction must be 0.
    expect(result.certificatesBeforeReduction).toBe(180);
    expect(result.eligibleCertificateReduction).toBe(0);
    expect(result.netCertificatesDue).toBe(180);
  });

  it("5. Correctly handles extreme input values and prevents negative certificates", () => {
    const result = orchestrateCalculation({
      role: "IMPORTER",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72011011",
      productionVolume: 1000000,
      installationName: "Gigantic Install",
      hasActualData: true,
      isVerified: true,
      directEmissionsInput: 15000000,
      electricityConsumedInput: 5000000,
      gridEmissionFactorInput: 0.45,
      isComplexGood: true,
      precursorDirectEmissionsInput: 2000000,
      precursorIndirectEmissionsInput: 1000000,
      carbonPricePaidInput: 200,
    });

    expect(result.totalDirectEmissions).toBe(17000000);
    expect(result.totalIndirectEmissions).toBe(3250000);
    expect(result.totalEmbeddedEmissions).toBe(20250000);
    expect(result.certificatesBeforeReduction).toBe(18225000); // 20250000 * 0.9
  });
});
