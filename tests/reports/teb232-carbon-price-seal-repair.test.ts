import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { assertCarbonPriceSemantics } from "../../functions/src/cbam/report/premium-package-hardening";
import { createFourDossierCase } from "../fixtures/four-dossiers";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("TEB232 carbon-price sealing repair", () => {
  it("keeps monetary amount and certificate-equivalent reduction in different units", () => {
    const steel = createFourDossierCase("STEEL_IN");
    steel.carbonPriceRecords[0].eligibleCertificateReduction = "150000";
    const calculation = performDossierCalculations(steel);

    expect(() => assertCarbonPriceSemantics(steel, calculation)).not.toThrow();
    expect(steel.carbonPriceRecords[0].amountPaid).toBe("1500000");
    expect(steel.carbonPriceRecords[0].applicableEmissions).toBe("150000");
    expect(calculation.eligibleCertificateReduction).toBe("150000");
  });

  it("still rejects the old EUR-as-certificate-equivalent value", () => {
    const steel = createFourDossierCase("STEEL_IN");
    steel.carbonPriceRecords[0].eligibleCertificateReduction = "1500000";
    const calculation = performDossierCalculations(steel);

    expect(() => assertCarbonPriceSemantics(steel, calculation)).toThrow(
      "PREMIUM_PACKAGE_CARBON_PRICE_UNIT_MISMATCH:0:eligible=1500000:applicable=150000"
    );
  });

  it("bypasses sealed-history blocking only for the exact controlled target and still blocks PROCESSING", () => {
    const wrapper = readSource("lib/cbam/qa/prepare-teb232-target-case-for-seal.ts");
    const route = readSource("app/api/qa/reconcile-teb232/route.ts");

    expect(wrapper).toContain('statuses.includes("PROCESSING")');
    expect(wrapper).toContain("TEB232_TARGET_CASE_SEAL_IN_PROGRESS");
    expect(wrapper).toContain('statuses.includes("SEALED")');
    expect(wrapper).toContain("hasSealedHistory && !isExactControlledTarget(initialStored)");
    expect(wrapper).toContain('TARGET_ELIGIBLE_CERTIFICATE_REDUCTION = "150000"');
    expect(wrapper).toContain("assertCarbonPriceSemantics(validated, calculation)");
    expect(route).toContain("prepareTeb232TargetCaseForSeal");
  });
});
