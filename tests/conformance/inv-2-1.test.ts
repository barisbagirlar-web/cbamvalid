import { describe, expect, it } from "vitest";
import { validateSingleHopRedirects, type RedirectRule } from "../../scripts/seo/redirect-audit-v6";

const brokenRules: RedirectRule[] = [
  { source: "/credits", destination: "/credits/buy", permanent: true, has: [] },
  { source: "/cbam-methodology", destination: "/methodology", permanent: true, has: [] },
  {
    source: "/:path*",
    destination: "https://cbamvalid.com/:path*",
    permanent: true,
    has: [{ type: "host", value: "www.cbamvalid.com" }],
  },
];

describe("INV-2.1 negative fixture", () => {
  it("blocks a canonical redirect that needs more than one application hop", () => {
    const blocks = validateSingleHopRedirects(brokenRules, "https://cbamvalid.com", "cbamvalid.com");
    expect(blocks.some((block) => block.includes("INV-2.1") && block.includes("www.cbamvalid.com/credits"))).toBe(true);
  });
});
