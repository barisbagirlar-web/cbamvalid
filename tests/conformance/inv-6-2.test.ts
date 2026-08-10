import { describe, expect, it } from "vitest";
import { buildPageGraph, type JsonLdNode } from "../../lib/seo/schema";

describe("INV-6.2 negative fixture", () => {
  it("blocks conflicting Organization nodes with the same entity id", () => {
    const nodes: JsonLdNode[] = [
      { "@type": "Organization", "@id": "https://cbamvalid.com/#organization", name: "SectorCalc Corporation" },
      { "@type": "Organization", "@id": "https://cbamvalid.com/#organization", name: "Conflicting Organization" },
    ];
    expect(() => buildPageGraph(nodes)).toThrow(/conflicting duplicate @id/);
  });
});
