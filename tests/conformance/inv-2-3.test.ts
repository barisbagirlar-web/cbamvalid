import { describe, expect, it } from "vitest";
import { validateHsts } from "../../scripts/seo/redirect-audit-v6";

describe("INV-2.3 negative fixture", () => {
  it("blocks HSTS preload when no irreversible preload approval exists", () => {
    const blocks = validateHsts(
      "max-age=63072000; includeSubDomains; preload",
      false,
      "max-age=63072000; includeSubDomains",
    );
    expect(blocks.some((block) => block.includes("INV-2.3") && block.includes("preload"))).toBe(true);
  });
});
