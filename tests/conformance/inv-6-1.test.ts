import { describe, expect, it } from "vitest";
import { generateProductOfferSchema, type JsonLdNode } from "../../lib/seo/schema";
import { validateProductSchemaClaimParity } from "../../lib/seo/schema-validation";

describe("INV-6.1 negative fixture", () => {
  it("blocks a Product schema claim that drifts from verified visible commercial evidence", () => {
    const document = structuredClone(generateProductOfferSchema()) as JsonLdNode;
    const graph = document["@graph"] as JsonLdNode[];
    const product = graph.find((node) => node["@type"] === "Product");
    expect(product).toBeTruthy();
    if (!product) return;
    product.description = "Managed consulting dossier prepared by experts";
    const blocks = validateProductSchemaClaimParity(document);
    expect(blocks.some((block) => block.includes("INV-6.1") && block.includes("description"))).toBe(true);
  });
});
