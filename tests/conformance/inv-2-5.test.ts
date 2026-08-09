import { describe, expect, it } from "vitest";
import { validateDuplicateVariantResponses } from "../../scripts/seo/redirect-audit-v6";

describe("INV-2.5 negative fixture", () => {
  it("blocks a non-canonical URL variant that returns a successful 2xx response", () => {
    const blocks = validateDuplicateVariantResponses([
      { id: "https-www", canonical: false, status: 200 },
      { id: "canonical", canonical: true, status: 200 },
    ]);
    expect(blocks.some((block) => block.includes("INV-2.5") && block.includes("https-www"))).toBe(true);
  });
});
