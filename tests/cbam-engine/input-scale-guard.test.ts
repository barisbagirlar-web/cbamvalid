import { describe, expect, it } from "vitest";
import { performDossierCalculations as performBrowserPreview } from "../../lib/cbam/calculator";
import { AuditReadyCaseSchema as BrowserCaseSchema } from "../../lib/cbam/schema";
import {
  GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH as BROWSER_MAX,
  GRID_EMISSION_FACTOR_SCALE_ERROR as BROWSER_ERROR,
} from "../../lib/cbam/input-constraints";
import { performDossierCalculations as performServerCalculation } from "../../functions/src/cbam/calculator";
import {
  GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH as SERVER_MAX,
  GRID_EMISSION_FACTOR_SCALE_ERROR as SERVER_ERROR,
} from "../../functions/src/cbam/input-constraints";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

describe("grid emission-factor scale guard", () => {
  it("keeps browser and authoritative server constraints identical", () => {
    expect(BROWSER_MAX).toBe(SERVER_MAX);
    expect(BROWSER_ERROR).toBe(SERVER_ERROR);
  });

  it("rejects a factor entered at the wrong scale before multiplication", () => {
    const serverCase = createVerifierGradeCase();
    serverCase.gridEmissionFactor.value = "4344";
    const browserCase = BrowserCaseSchema.parse(serverCase);

    expect(() => performBrowserPreview(browserCase)).toThrow(
      "CALCULATION_GRID_FACTOR_SCALE_INVALID"
    );
    expect(() => performServerCalculation(serverCase)).toThrow(
      "CALCULATION_GRID_FACTOR_SCALE_INVALID"
    );
  });

  it("preserves a correctly normalized decimal factor", () => {
    const serverCase = createVerifierGradeCase();
    serverCase.gridEmissionFactor.value = "0.4344";
    const browserCase = BrowserCaseSchema.parse(serverCase);

    const browserResult = performBrowserPreview(browserCase);
    const serverResult = performServerCalculation(serverCase);

    expect(browserResult.totalIndirectEmissions).toBe("43.44");
    expect(browserResult.totalEmbeddedEmissions).toBe("123.44");
    expect(serverResult.electricityIndirectEmissions).toBe("43.44");
    expect(serverResult.totalEmbeddedEmissions).toBe("123.44");
  });
});
