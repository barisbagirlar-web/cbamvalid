import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public header layout contract", () => {
  it("keeps topbar and site-header free of overlap-prone flex collisions", () => {
    const header = readFileSync(resolve(process.cwd(), "components/layout/PublicHeader.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "public/assets/css/style.css"), "utf8");

    expect(header).toContain('className="topbar-copy"');
    expect(header).toContain('className="topbar-links"');
    expect(header).not.toMatch(/className="dot"/);

    expect(css).toMatch(/\.site-header \.wrap\{[\s\S]*align-items:center/);
    expect(css).toMatch(/\.header-actions\{[\s\S]*flex:0 0 auto/);
    expect(css).toMatch(/\.main-nav\{[\s\S]*overflow:hidden/);
    expect(css).toMatch(/\.header-actions \.btn-primary:hover[\s\S]*transform:none/);
    expect(css).toMatch(/@media\(max-width:1180px\)[\s\S]*\.main-nav,\.header-actions \.signin/);
  });
});
