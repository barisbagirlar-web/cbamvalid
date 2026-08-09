import { describe, expect, it } from "vitest";
import { validateRobotsSitemapConflict } from "../../scripts/seo/sitemap-audit-v6";

describe("INV-3.2 negative fixture", () => {
  it("blocks a sitemap URL that robots disallows", () => {
    const blocks = validateRobotsSitemapConflict(
      {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/private/"] }],
        sitemap: "https://cbamvalid.com/sitemap.xml",
      },
      [{ url: "https://cbamvalid.com/private/page" }],
    );
    expect(blocks.some((block) => block.includes("INV-3.2"))).toBe(true);
  });
});
