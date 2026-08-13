import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderRobotsTxt } from "../../scripts/seo/sitemap-robots-sync-v6";

describe("robots.txt public surface", () => {
  it("keeps static robots free of internal SSOT/path comments", () => {
    const staticRobots = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
    const rendered = renderRobotsTxt();
    expect(staticRobots).toBe(rendered);
    expect(staticRobots).not.toMatch(/#/);
    expect(staticRobots).not.toMatch(/source of truth/i);
    expect(staticRobots).not.toMatch(/app\/robots\.ts/i);
    expect(staticRobots).not.toMatch(/SSOT/i);
  });
});
