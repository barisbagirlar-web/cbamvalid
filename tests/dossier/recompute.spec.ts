import { describe, expect, it } from "vitest";
import { normalizeCase } from "../../src/dossier/10-normalize/normalizeCase";
import { buildCalcGraph, recomputeGraphHashes } from "../../src/dossier/20-kernel/graph";

describe("gate:recompute", () => {
  it("merkle root recomputes identically; Annex II SEE_priced=0.8", () => {
    const fixture = {
      caseId: "CASE-RECOMPUTE",
      operatorLegalName: "Third Country Operator A.S.",
      installationName: "Plant A",
      installationCountry: "TR",
      reportingPeriod: { type: "DEFINITIVE_ANNUAL" as const, year: 2026 },
      directEmissionsTco2e: "80",
      electricityMwh: "100",
      gridFactorTco2ePerMwh: "0.4",
      goods: [
        {
          cnCode: "72011011",
          sector: "IRON_AND_STEEL",
          netMassTonnes: "100",
          allocationShare: "1",
          allocationJustification: "Single-good installation share.",
        },
      ],
      productionProcesses: [],
      signOffs: [],
      evidenceIds: [],
    };
    const graph = buildCalcGraph(normalizeCase(fixture));
    const recomputed = recomputeGraphHashes(graph.nodes);
    expect(recomputed.rootHash).toBe(graph.rootHash);
    const see = graph.nodes.find((n) => n.id === "CBAM.GOOD.0.SEE_PRICED");
    expect(see?.value.toString()).toBe("0.8");
  });
});
