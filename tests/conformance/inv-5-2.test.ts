import { describe, expect, it } from "vitest";
import { validateSimilarityPairs } from "../../scripts/seo/content-governance-v6";

describe("INV-5.2 negative fixture", () => {
  it("blocks near-duplicate content above configured similarity threshold", () => {
    const result = validateSimilarityPairs(
      [
        { id: "/a", text: "embedded emissions calculation evidence preparation operator data" },
        { id: "/b", text: "embedded emissions calculation evidence preparation operator data guide" },
      ],
      0.7,
    );
    expect(result.blocks.some((block) => block.includes("INV-5.2") && block.includes("/a <> /b"))).toBe(true);
  });
});
