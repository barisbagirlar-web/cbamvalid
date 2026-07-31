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

    expect(result.totalDirectEmissions).toBe("150.55"); // C — total direct
    expect(result.totalIndirectEmissions).toBe("25"); // F — total indirect
    expect(result.emissionsByCategory.C_TOTAL_DIRECT_EMBEDDED).toBe("150.55");
    expect(result.emissionsByCategory.F_TOTAL_DISCLOSED_INDIRECT).toBe("25");
    expect(result.emissionsByCategory.H_TOTAL_INFORMATIONAL_EMBEDDED).toBe("175.55"); // C + F
    // FAZ 4 G/H segregation: `totalEmbeddedEmissions` is the certificate-relevant
    // priced total (G). The fixture sector is Annex II (iron & steel), so indirect
    // is disclosed but not priced — G excludes it. See golden-dossier-matrix.
    expect(result.emissionsByCategory.G_CERTIFICATE_RELEVANT_EMBEDDED).toBe("150.55");
    expect(result.totalEmbeddedEmissions).toBe("150.55");
    expect(result.productionVolume).toBe("100");
    expect(result.specificEmbeddedEmissions).toBe("1.5055"); // G / volume
  });
});
