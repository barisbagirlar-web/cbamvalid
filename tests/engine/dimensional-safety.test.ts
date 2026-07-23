import { describe, expect, it } from "vitest";
import { performDossierCalculations } from "../../lib/cbam/calculator";
import { AuditReadyCaseSchema } from "../../lib/cbam/schema";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

describe("dimensional safety and decimal engine", () => {
  it("rejects non-decimal input without NaN or implicit coercion", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.directEmissions.value = "invalid_string";

    expect(() => performDossierCalculations(caseData)).toThrow(
      "CALCULATION_INPUT_INVALID:directEmissions"
    );
  });

  it("separates total emissions from product intensity for decimal strings", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.directEmissions.value = "150.55";
    caseData.electricityConsumed.value = "100.0";
    caseData.gridEmissionFactor.value = "0.25";

    const result = performDossierCalculations(caseData);

    expect(result.totalDirectEmissions).toBe("150.55");
    expect(result.totalIndirectEmissions).toBe("25");
    expect(result.totalEmbeddedEmissions).toBe("175.55");
    expect(result.productionVolume).toBe("100");
    expect(result.specificEmbeddedEmissions).toBe("1.7555");
  });
});
