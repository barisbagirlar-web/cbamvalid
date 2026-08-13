import { describe, expect, it } from "vitest";
import {
  ACTUAL_DEFAULT_DEMAND_TRAP,
  DE_MINIMIS_DEMAND_BOUNDARY,
  ENGINE_AUDIT_BOUNDARY,
  RULESET_DRIFT_BOUNDARY,
} from "../../lib/trust/product-boundary-facts";
import { RULESET_PUBLIC_NOTICE } from "../../lib/cbam/registry/public-ruleset-catalog";
import { COMMERCIAL_LEGAL_CLAUSES } from "../../lib/billing/case-commercial-contract";

describe("product boundary honesty (issues 14–17)", () => {
  it("states Omnibus de minimis without inventing a ~90% importer statistic", () => {
    expect(DE_MINIMIS_DEMAND_BOUNDARY.thresholdFact).toMatch(/50 tonnes/i);
    expect(DE_MINIMIS_DEMAND_BOUNDARY.importerScopeFact).toMatch(/vast majority of importers/i);
    expect(DE_MINIMIS_DEMAND_BOUNDARY.importerScopeFact).toMatch(/99%/);
    expect(DE_MINIMIS_DEMAND_BOUNDARY.importerScopeFact).toMatch(/does not invent/i);
    expect(DE_MINIMIS_DEMAND_BOUNDARY.productBoundary).toMatch(/not positioned as a mass-market/i);
  });

  it("pins verification to actual values per EUR-Lex recital (19)", () => {
    expect(ACTUAL_DEFAULT_DEMAND_TRAP.verificationFact).toMatch(/actual values/i);
    expect(ACTUAL_DEFAULT_DEMAND_TRAP.verificationFact).toMatch(/not to default/i);
    expect(ACTUAL_DEFAULT_DEMAND_TRAP.demandFact).toMatch(/can disappear/i);
  });

  it("separates ruleset pin from perpetual currency and unlimited free remakes", () => {
    expect(RULESET_DRIFT_BOUNDARY.pinFact).toMatch(/immutable/i);
    expect(RULESET_DRIFT_BOUNDARY.monitoringFact).toMatch(/does not claim 24\/7/i);
    expect(RULESET_DRIFT_BOUNDARY.reLockFact).toMatch(/not an unlimited free/i);
    expect(RULESET_PUBLIC_NOTICE).toMatch(/not a promise of perpetual/i);
    const corrections = COMMERCIAL_LEGAL_CLAUSES.find((row) => row.title.includes("Corrections"));
    expect(corrections?.body).toMatch(/not an unlimited free obligation/i);
  });

  it("keeps deterministic claim free of invented third-party engine audit", () => {
    expect(ENGINE_AUDIT_BOUNDARY.deterministicFact).toMatch(/reproducibility/i);
    expect(ENGINE_AUDIT_BOUNDARY.auditGap).toMatch(/No independent third-party/i);
  });
});
