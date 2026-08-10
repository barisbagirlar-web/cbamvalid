import { PRICE_CLAIM, assertVerifiedClaim } from "./claims";
import type { JsonLdNode } from "./schema";

function findProductNode(document: JsonLdNode): JsonLdNode | null {
  if (document["@type"] === "Product") return document;
  const graph = document["@graph"];
  if (!Array.isArray(graph)) return null;
  for (const node of graph) {
    if (node && typeof node === "object" && (node as JsonLdNode)["@type"] === "Product") {
      return node as JsonLdNode;
    }
  }
  return null;
}

export function validateProductSchemaClaimParity(document: JsonLdNode): string[] {
  const blocks: string[] = [];
  const product = findProductNode(document);
  if (!product) return ["INV-6.1 Product schema node missing"];
  const verified = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  if (product.name !== verified.packName) blocks.push("INV-6.1 Product schema name drifted from verified commercial SSOT");
  if (product.description !== verified.description) blocks.push("INV-6.1 Product schema description drifted from visible commercial SSOT");
  const offers = product.offers;
  if (!offers || typeof offers !== "object") {
    blocks.push("INV-6.1 Product schema Offer missing");
    return blocks;
  }
  const offer = offers as JsonLdNode;
  if (offer.price !== verified.amount) blocks.push("INV-6.1 Product schema price drifted from visible commercial SSOT");
  if (offer.priceCurrency !== verified.currency) blocks.push("INV-6.1 Product schema currency drifted from visible commercial SSOT");
  return blocks.sort();
}

export function countEntityId(document: JsonLdNode, id: string): number {
  const graph = document["@graph"];
  if (!Array.isArray(graph)) return document["@id"] === id ? 1 : 0;
  return graph.filter(
    (node) => node && typeof node === "object" && (node as JsonLdNode)["@id"] === id,
  ).length;
}
