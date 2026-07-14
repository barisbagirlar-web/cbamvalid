import { describe, it, expect } from "vitest";
import { performDossierCalculations } from "../../lib/cbam/calculator";
import { AuditReadyCase } from "../../lib/cbam/schema";

describe("Dimensional Safety and Decimal Engine", () => {
  it("should prevent NaN or implicit float coercion in calculations", () => {
    const maliciousPayload: any = {
      directEmissions: { value: "invalid_string", unit: "tCO2e" },
      electricityConsumed: { value: 100, unit: "MWh" },
      gridEmissionFactor: { value: 0.25, unit: "tCO2e/MWh" },
      goods: [{ 
        cnCode: { value: "72081000" },
        sector: "IRON_AND_STEEL",
        productionVolume: { value: 100, unit: "t" } 
      }],
      precursors: [],
      carbonPriceRecords: [],
    };

    expect(() => {
      performDossierCalculations(maliciousPayload as AuditReadyCase);
    }).toThrow("CALCULATION_INPUT_INVALID:directEmissions");
  });

  it("should calculate correctly with Decimal strings", () => {
    const validPayload: any = {
      directEmissions: { value: "150.55", unit: "tCO2e" },
      electricityConsumed: { value: "100.0", unit: "MWh" },
      gridEmissionFactor: { value: "0.25", unit: "tCO2e/MWh" },
      goods: [{ 
        cnCode: { value: "72081000" },
        sector: "IRON_AND_STEEL",
        productionVolume: { value: "100", unit: "t" } 
      }],
      precursors: [],
      carbonPriceRecords: [],
    };

    const result = performDossierCalculations(validPayload as AuditReadyCase);
    expect(result.totalEmbeddedEmissions).toBe("1.7555"); // (150.55 + 25) / 100 = 175.55 / 100 = 1.7555
  });
});
