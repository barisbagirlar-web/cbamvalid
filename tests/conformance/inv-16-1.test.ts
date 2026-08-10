import { describe, expect, it } from "vitest";
import { assertTamEvidence } from "../../scripts/seo/tam-growth";

describe("INV-16.1", () => {
  it("blocks TAM cells without evidence", () => {
    expect(() => assertTamEvidence([{ cellId: "x", vertical: "saas", intent: "commercial", geography: "GLOBAL", evidenceIds: [] }])).toThrow(/INV-16\.1/);
  });
  it("accepts evidence-backed cells", () => {
    expect(() => assertTamEvidence([{ cellId: "x", vertical: "saas", intent: "commercial", geography: "GLOBAL", evidenceIds: ["repo-cluster-inventory"] }])).not.toThrow();
  });
});
