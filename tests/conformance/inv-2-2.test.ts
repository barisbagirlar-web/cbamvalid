import { describe, expect, it } from "vitest";
import { detectRedirectChains, type RedirectRule } from "../../scripts/seo/redirect-audit-v6";

const chainedRules: RedirectRule[] = [
  { source: "/credits", destination: "/credits/buy", permanent: true, has: [] },
  { source: "/cbam-methodology", destination: "/methodology", permanent: true, has: [] },
  {
    source: "/:path*",
    destination: "https://cbamvalid.com/:path*",
    permanent: true,
    has: [{ type: "host", value: "www.cbamvalid.com" }],
  },
];

describe("INV-2.2 negative fixture", () => {
  it("blocks a redirect chain created by path consolidation followed by host normalization", () => {
    const blocks = detectRedirectChains(chainedRules, "https://cbamvalid.com", "cbamvalid.com");
    expect(blocks.some((block) => block.includes("INV-2.2") && block.includes("www.cbamvalid.com/credits"))).toBe(true);
  });
});
